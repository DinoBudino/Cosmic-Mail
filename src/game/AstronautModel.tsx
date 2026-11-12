import { useAnimations, useGLTF } from '@react-three/drei'
import { createPortal, useFrame } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS } from '../data/marsObjects'
import { useGameStore } from '../store/gameStore'
import { getOrbit } from './cameraRig'
import { clampAimDirection, scannerAim } from './scannerAim'
import { CosmicScannerDevice } from './CosmicScannerDevice'
import { SCANNER } from './worldConfig'

const MODEL_URL = 'models/astronaut.glb?v=astronaut-mensajero-3'

useGLTF.preload(MODEL_URL)

/**
 * Hand_R local axes:
 * +Y is forward along the hand, +Z is up.
 * The scanner model is authored with +Z forward and +Y up, so this basis
 * maps scanner forward to hand +Y, scanner up to hand +Z, and flips the
 * symmetric right/left axis to keep a proper rotation.
 */
const SCANNER_MOUNT_QUATERNION = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 1, 0),
  ),
)

const AIM_FORWARD = new THREE.Vector3()
const AIM_UP = new THREE.Vector3(0, 1, 0)
const AIM_Z = new THREE.Vector3()
const AIM_X = new THREE.Vector3()
const AIM_MATRIX = new THREE.Matrix4()
const AIM_WORLD_QUATERNION = new THREE.Quaternion()
const AIM_PARENT_QUATERNION = new THREE.Quaternion()
const AIM_LOCAL_QUATERNION = new THREE.Quaternion()
const AIM_MODEL_QUATERNION = new THREE.Quaternion()
const AIM_BODY_FORWARD = new THREE.Vector3()
const AIM_SHOULDER = new THREE.Vector3()
const AIM_TARGET = new THREE.Vector3()
const IDENTITY_QUATERNION = new THREE.Quaternion()

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
  const equipWeight = useRef(0)
  const scannerMount = useRef<THREE.Group>(null)
  const aimSmooth = useRef(new THREE.Vector3())
  const aimSeeded = useRef(false)

  const { scene, animations } = useGLTF(MODEL_URL)
  const { actions } = useAnimations(animations, modelRef)
  const actionsRef = useRef(actions)

  const rig = useMemo(() => {
    const upperArm = scene.getObjectByName('UpperArm_R')
    const forearm = scene.getObjectByName('Forearm_R')
    const handBone = scene.getObjectByName('Hand_R')
    return {
      hand: handBone ?? null,
      upperArm: upperArm instanceof THREE.Bone ? upperArm : null,
      forearm: forearm instanceof THREE.Bone ? forearm : null,
      handBone: handBone instanceof THREE.Bone ? handBone : null,
    }
  }, [scene])
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

        if (
          !gesture.current &&
          !store.scannerEquipped &&
          pendingCelebrate.current &&
          motion < 0.08
        ) {
          pendingCelebrate.current = false
          startGesture('Celebrate', now, true)
        }

        if (
          !gesture.current &&
          !reducedMotion &&
          !store.settingsOpen &&
          !store.activeSiteId &&
          !store.scannerEquipped &&
          motion < 0.04 &&
          now - idleSince.current > 7 &&
          now - lastWave.current > 15
        ) {
          lastWave.current = now
          startGesture('Wave', now, true)
        }

        if (
          !gesture.current &&
          !store.scannerEquipped &&
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

    // Physical Cosmic Scanner. The mixer has already updated the authored
    // arm pose, so this layer blends the right arm into a stable aim pose
    // without touching the other bones, boots or thruster sockets.
    equipWeight.current = THREE.MathUtils.damp(
      equipWeight.current,
      store.scannerEquipped ? 1 : 0,
      12,
      Math.min(delta, 0.05),
    )
    const scannerWeight = equipWeight.current
    if (scannerMount.current) {
      const visible = scannerWeight > 0.01
      scannerMount.current.visible = visible
      if (visible) {
        scannerMount.current.scale.setScalar(
          Math.max(0.001, scannerWeight),
        )
      }
    }

    if (scannerWeight <= 0.001) aimSeeded.current = false

    if (
      scannerWeight > 0.001 &&
      rig.upperArm &&
      rig.forearm &&
      rig.handBone
    ) {
      const orbit = getOrbit()
      rig.upperArm.getWorldPosition(AIM_SHOULDER)

      // The physical device follows the exact surface under the reticle.
      // Fall back to the camera forward when the pointer has no hit.
      if (scannerAim.valid) {
        AIM_TARGET.set(scannerAim.x, scannerAim.y, scannerAim.z)
      } else {
        const aimRightX = Math.cos(orbit.yaw)
        const aimRightZ = -Math.sin(orbit.yaw)
        AIM_TARGET.set(
          AIM_SHOULDER.x +
            (-Math.sin(orbit.yaw) + aimRightX * 0.7) *
              SCANNER.fallbackAimDistance,
          AIM_SHOULDER.y - 0.2 * SCANNER.fallbackAimDistance,
          AIM_SHOULDER.z +
            (-Math.cos(orbit.yaw) + aimRightZ * 0.7) *
              SCANNER.fallbackAimDistance,
        )
      }

      // Damping the world aim point keeps the arm stable under fast mouse
      // movement while still converging exactly on the target.
      if (!aimSeeded.current) {
        aimSmooth.current.copy(AIM_TARGET)
        aimSeeded.current = true
      } else {
        aimSmooth.current.lerp(
          AIM_TARGET,
          1 - Math.exp(-SCANNER.armAimDamping * Math.min(delta, 0.05)),
        )
      }

      AIM_FORWARD.subVectors(aimSmooth.current, AIM_SHOULDER)
      if (AIM_FORWARD.lengthSq() < 1e-6) AIM_FORWARD.set(0, 0, -1)
      AIM_FORWARD.normalize()

      // Clamp the shoulder cone relative to the body, never the camera.
      if (modelRef.current) {
        modelRef.current.updateWorldMatrix(true, false)
        AIM_MODEL_QUATERNION.setFromRotationMatrix(
          modelRef.current.matrixWorld,
        )
        AIM_BODY_FORWARD.set(0, 0, -1).applyQuaternion(
          AIM_MODEL_QUATERNION,
        )
        const bodyYaw = Math.atan2(
          -AIM_BODY_FORWARD.x,
          -AIM_BODY_FORWARD.z,
        )
        clampAimDirection(
          AIM_FORWARD,
          bodyYaw,
          SCANNER.minAimYaw,
          SCANNER.maxAimYaw,
          SCANNER.minAimY,
          SCANNER.maxAimY,
        )
      }

      AIM_Z.copy(AIM_UP)
        .addScaledVector(AIM_FORWARD, -AIM_FORWARD.dot(AIM_UP))
        .normalize()
      AIM_X.crossVectors(AIM_FORWARD, AIM_Z).normalize()
      AIM_MATRIX.makeBasis(AIM_X, AIM_FORWARD, AIM_Z)
      AIM_WORLD_QUATERNION.setFromRotationMatrix(AIM_MATRIX)

      const parent = rig.upperArm.parent
      if (parent) {
        parent.updateWorldMatrix(true, false)
        AIM_PARENT_QUATERNION.setFromRotationMatrix(parent.matrixWorld)
        AIM_LOCAL_QUATERNION.copy(AIM_PARENT_QUATERNION)
          .invert()
          .multiply(AIM_WORLD_QUATERNION)
        rig.upperArm.quaternion.slerp(AIM_LOCAL_QUATERNION, scannerWeight)
        rig.forearm.quaternion.slerp(IDENTITY_QUATERNION, scannerWeight)
        rig.handBone.quaternion.slerp(IDENTITY_QUATERNION, scannerWeight)
      }
    }
  })

  return (
    <group>
      <group ref={modelRef}>
        <group rotation={[0, Math.PI, 0]}>
          <primitive object={scene} />
        </group>
      </group>
      {rig.hand
        ? createPortal(
            <group
              ref={scannerMount}
              position={[0, 0.11, 0.01]}
              quaternion={SCANNER_MOUNT_QUATERNION}
              visible={false}
            >
              <CosmicScannerDevice />
            </group>,
            rig.hand,
          )
        : null}
    </group>
  )
}
