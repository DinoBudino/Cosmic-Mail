import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS } from '../data/marsObjects'
import { useGameStore } from '../store/gameStore'

const MODEL_URL = 'models/astronaut.glb?v=astronaut-mensajero-3'

useGLTF.preload(MODEL_URL)

interface FlightState {
  thrust: number
  vy: number
  airborne: number
}

interface AstronautModelProps {
  motionRef: RefObject<number>
  flightRef: RefObject<FlightState>
  turnRef: RefObject<number>
}

type FlightPhase = 'ground' | 'takeoff' | 'jump' | 'flying' | 'landing'

interface BootEffect {
  group: THREE.Group
  flame: THREE.Mesh
  glow: THREE.Mesh
}

/**
 * Loads the Blender-authored astronaut and drives its authored clips.
 * Movement, camera, collision, gravity and boot physics remain in Player.tsx.
 *
 * The GLB is authored facing Blender -Y, which becomes +Z after glTF Y-up
 * conversion. The controller expects -Z, so the imported scene sits inside a
 * documented 180 degree Y wrapper.
 *
 * Animation selection is a presentation layer over the existing controller:
 * - ground: Idle / Walk / Run
 * - Takeoff -> Flying -> Landing for the existing jet-boot flight
 * - existing site/region/turn events trigger Interact/PickUp/Celebrate/Turn
 * - a long idle triggers Wave
 * Jump remains available as the authored ballistic-jump clip.
 *
 * Thruster flames are runtime-only children of ThrusterSocket_L/R; the GLB
 * contains the integrated nozzles, emissive cores and the sockets themselves.
 */
export function AstronautModel({
  motionRef,
  flightRef,
  turnRef,
}: AstronautModelProps) {
  const modelRef = useRef<THREE.Group>(null)
  const effectsRef = useRef<{ L: BootEffect | null; R: BootEffect | null }>({
    L: null,
    R: null,
  })
  const currentAction = useRef('')
  const flightPhase = useRef<FlightPhase>('ground')
  const phaseStart = useRef(0)
  const gesture = useRef<string | null>(null)
  const gestureStart = useRef(0)
  const wasAirborne = useRef(false)
  const pendingCelebrate = useRef(false)
  const previousSite = useRef<string | null>(null)
  const previousVisitedCount = useRef(0)
  const idleSince = useRef(0)
  const lastWave = useRef(-100)
  const lastTurn = useRef(-100)

  const { scene, animations } = useGLTF(MODEL_URL)
  const { actions } = useAnimations(animations, modelRef)
  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
  }, [scene])

  // Runtime-only exhaust effects attached to the exported socket bones.
  useEffect(() => {
    const leftSocket = scene.getObjectByName('ThrusterSocket_L')
    const rightSocket = scene.getObjectByName('ThrusterSocket_R')
    if (!leftSocket || !rightSocket) {
      console.warn('Astronaut thruster sockets are missing from the GLB')
      return
    }

    const flameGeometry = new THREE.ConeGeometry(0.045, 0.28, 12)
    flameGeometry.rotateX(-Math.PI / 2)
    flameGeometry.translate(0, 0, -0.14)
    const glowGeometry = new THREE.SphereGeometry(0.021, 10, 8)

    const createEffect = (socket: THREE.Object3D): BootEffect => {
      const group = new THREE.Group()
      group.position.set(0, 0, -0.004)
      const glow = new THREE.Mesh(
        glowGeometry,
        new THREE.MeshBasicMaterial({
          color: '#FFBA70',
          toneMapped: false,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      )
      glow.position.set(0, 0, -0.006)
      glow.visible = false
      const flame = new THREE.Mesh(
        flameGeometry,
        new THREE.MeshBasicMaterial({
          color: '#FFBA70',
          toneMapped: false,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      flame.visible = false
      group.add(glow, flame)
      socket.add(group)
      return { group, flame, glow }
    }

    const left = createEffect(leftSocket)
    const right = createEffect(rightSocket)
    effectsRef.current = { L: left, R: right }

    return () => {
      for (const effect of [left, right]) {
        effect.group.removeFromParent()
        ;(effect.flame.material as THREE.Material).dispose()
        ;(effect.glow.material as THREE.Material).dispose()
      }
      flameGeometry.dispose()
      glowGeometry.dispose()
      effectsRef.current = { L: null, R: null }
    }
  }, [scene])

  const playClip = useCallback(
    (name: string, mode: 'loop' | 'once', fade = 0.18) => {
      const actionSet = actionsRef.current
      const next = actionSet[name]
      if (!next) return false
      if (mode === 'loop' && currentAction.current === name) return true

      const previous = currentAction.current
        ? actionSet[currentAction.current]
        : null
      next.reset()
      next.enabled = true
      next.paused = false
      next.clampWhenFinished = mode === 'once'
      next.setEffectiveWeight(1)
      next.setEffectiveTimeScale(1)
      next.setLoop(
        mode === 'loop' ? THREE.LoopRepeat : THREE.LoopOnce,
        mode === 'loop' ? Infinity : 1,
      )
      next.fadeIn(fade).play()
      if (previous && previous !== next) previous.fadeOut(fade)
      currentAction.current = name
      return true
    },
    [],
  )

  const startGesture = useCallback(
    (name: string, now: number, force = false) => {
      if (!force && gesture.current) return
      if (!actionsRef.current[name]) return
      gesture.current = name
      gestureStart.current = now
      playClip(name, 'once', 0.16)
    },
    [playClip],
  )

  useFrame((state, delta) => {
    const motion = motionRef.current
    const flight = flightRef.current
    const turn = turnRef.current
    const actionSet = actionsRef.current
    const now = state.clock.elapsedTime
    const store = useGameStore.getState()
    const reducedMotion = store.reducedMotion
    const airborne = flight.airborne > 0.08
    const thrust = airborne && flight.thrust > 0 ? 1 : 0
    const grounded = !airborne

    const duration = (name: string) =>
      actionSet[name]?.getClip().duration ?? 0

    // Existing site interaction: Interact for inspectable artifacts, PickUp
    // for places still under construction.
    const siteId = store.activeSiteId
    if (
      siteId &&
      siteId !== previousSite.current &&
      grounded &&
      flightPhase.current === 'ground'
    ) {
      const site = MARS_OBJECTS.find((item) => item.id === siteId)
      startGesture(
        site?.state === 'coming-soon' ? 'PickUp' : 'Interact',
        now,
        true,
      )
    }
    previousSite.current = siteId

    // A newly reached region queues a celebration for the next calm moment.
    const visitedCount = Object.keys(store.visitedRegions).length
    if (visitedCount > previousVisitedCount.current) {
      pendingCelebrate.current = true
      previousVisitedCount.current = visitedCount
    }

    // Idle timer used by the ambient wave.
    if (!grounded || motion > 0.05 || gesture.current) {
      idleSince.current = now
    }

    if (airborne) {
      gesture.current = null
      if (!wasAirborne.current) {
        if (thrust) {
          flightPhase.current = 'takeoff'
          phaseStart.current = now
          playClip('Takeoff', 'once', 0.12)
        } else {
          flightPhase.current = 'jump'
          phaseStart.current = now
          playClip('Jump', 'once', 0.12)
        }
      } else if (flightPhase.current === 'takeoff') {
        if (now - phaseStart.current >= duration('Takeoff') - 0.02) {
          flightPhase.current = 'flying'
          phaseStart.current = now
          playClip('Flying', 'loop', 0.18)
        }
      } else if (flightPhase.current === 'jump') {
        if (
          now - phaseStart.current >= duration('Jump') - 0.02 ||
          thrust
        ) {
          flightPhase.current = 'flying'
          phaseStart.current = now
          playClip('Flying', 'loop', 0.18)
        }
      } else {
        flightPhase.current = 'flying'
        playClip('Flying', 'loop', 0.18)
      }
      wasAirborne.current = true
    } else {
      if (wasAirborne.current) {
        flightPhase.current = 'landing'
        phaseStart.current = now
        gesture.current = null
        playClip('Landing', 'once', 0.12)
      } else if (flightPhase.current === 'landing') {
        if (now - phaseStart.current >= duration('Landing') - 0.02) {
          flightPhase.current = 'ground'
        }
      } else {
        flightPhase.current = 'ground'
      }

      if (flightPhase.current === 'ground') {
        if (gesture.current) {
          const gestureDuration = duration(gesture.current)
          const finished = now - gestureStart.current >= gestureDuration + 0.02
          const movingCancel =
            gesture.current !== 'Turn_Left' &&
            gesture.current !== 'Turn_Right' &&
            motion > 0.12
          if (finished || movingCancel) gesture.current = null
        }

        if (!gesture.current && pendingCelebrate.current && motion < 0.08) {
          pendingCelebrate.current = false
          startGesture('Celebrate', now, true)
        }

        if (
          !gesture.current &&
          !reducedMotion &&
          !store.settingsOpen &&
          !store.activeSiteId &&
          motion < 0.04 &&
          now - idleSince.current > 7 &&
          now - lastWave.current > 15
        ) {
          lastWave.current = now
          startGesture('Wave', now, true)
        }

        if (
          !gesture.current &&
          motion > 0.15 &&
          Math.abs(turn) > 0.1 &&
          now - lastTurn.current > 0.9
        ) {
          lastTurn.current = now
          startGesture(turn > 0 ? 'Turn_Left' : 'Turn_Right', now, true)
        }

        if (!gesture.current && flightPhase.current === 'ground') {
          const desired =
            motion > 0.92 ? 'Run' : motion > 0.08 ? 'Walk' : 'Idle'
          playClip(desired, 'loop', 0.18)
          if (desired === 'Walk' || desired === 'Run') {
            const action = actionSet[desired]
            if (action) {
              action.setEffectiveTimeScale(
                0.85 + Math.min(motion, 1) * 0.35,
              )
            }
          }
        }
      }
      wasAirborne.current = false
    }

    // Runtime exhaust follows the sockets and is visible only under thrust.
    const flicker = reducedMotion ? 1 : 1 + Math.sin(now * 23) * 0.18
    const flameScale =
      thrust * (0.9 + flight.airborne * 0.15) * flicker
    for (const effect of [effectsRef.current.L, effectsRef.current.R]) {
      if (!effect) continue
      effect.flame.visible = thrust > 0
      effect.glow.visible = thrust > 0
      effect.flame.scale.set(
        1 + thrust * 0.4,
        1 + thrust * 0.4,
        Math.max(0.001, flameScale),
      )
      effect.glow.scale.setScalar(1 + thrust * 0.25)
    }

    // Existing procedural air lean, kept independent of the authored clips.
    if (modelRef.current) {
      const lean = reducedMotion
        ? 0
        : airborne
          ? -0.1 -
            thrust * 0.22 +
            THREE.MathUtils.clamp(flight.vy * 0.02, -0.06, 0.08)
          : 0
      modelRef.current.rotation.x = THREE.MathUtils.damp(
        modelRef.current.rotation.x,
        lean,
        6,
        Math.min(delta, 0.05),
      )
    }
  })

  return (
    <group>
      <group ref={modelRef}>
        <group rotation={[0, Math.PI, 0]}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  )
}
