import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

const MODEL_URL = 'models/astronaut.glb?v=cosmic-carrier-16'

useGLTF.preload(MODEL_URL)

interface FlightState {
  thrust: number
  vy: number
  airborne: number
}

interface AstronautModelProps {
  motionRef: RefObject<number>
  flightRef: RefObject<FlightState>
}

const BOOT_X = 0.11

/**
 * Loads the Blender-authored astronaut and drives its authored clips.
 * Movement, camera, collision and proximity remain in Player.tsx.
 * Jet-boot glow and air pose are procedural overlays (IDs: the GLB only
 * ships Idle/Walk/Run): orange flames under the boots scale with thrust
 * and the body leans forward while flying.
 */
export function AstronautModel({ motionRef, flightRef }: AstronautModelProps) {
  const modelRef = useRef<THREE.Group>(null)
  const leftFlame = useRef<THREE.Mesh>(null)
  const rightFlame = useRef<THREE.Mesh>(null)
  const currentAction = useRef<string>('')
  const wasAirborne = useRef(false)
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

  const play = useCallback((name: string, fade = 0.2) => {
    const actionSet = actionsRef.current
    const next = actionSet[name]
    if (!next) return

    const previous = currentAction.current
      ? actionSet[currentAction.current]
      : null
    if (previous === next) return

    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    next.enabled = true
    next.fadeIn(fade).play()
    if (previous) previous.fadeOut(fade)
    currentAction.current = name
  }, [])

  useFrame((state, delta) => {
    const motion = motionRef.current
    const flight = flightRef.current
    const actionSet = actionsRef.current
    const time = state.clock.elapsedTime
    const reducedMotion = useGameStore.getState().reducedMotion

    const airborne = flight.airborne > 0.08
    const thrust = airborne ? flight.thrust : 0
    // Air pose: thrusting = Idle legs-down pose, coasting mid-jump = a
    // frozen mid-stride (no ground-walking cycle towards the sky).
    const freezeClip = airborne && thrust === 0 && motion > 0.08
    const desired = airborne && thrust > 0
      ? 'Idle'
      : motion > 0.92 ? 'Run' : motion > 0.08 ? 'Walk' : 'Idle'
    play(desired)

    for (const name of ['Walk', 'Run'] as const) {
      const action = actionSet[name]
      if (!action) continue
      if (freezeClip && desired === name) {
        if (!wasAirborne.current) {
          action.time = action.getClip().duration * 0.38
        }
        action.paused = true
      } else {
        action.paused = false
        if (desired === name) {
          action.timeScale = 0.85 + Math.min(motion, 1) * 0.35
        }
      }
    }
    wasAirborne.current = airborne

    // Flame flicker, thrust only (never while grounded).
    const flicker = reducedMotion ? 1 : 1 + Math.sin(time * 23) * 0.18
    const flameScaleY = thrust * (0.9 + flight.airborne * 0.15) * flicker
    for (const mesh of [leftFlame.current, rightFlame.current]) {
      if (!mesh) continue
      mesh.visible = thrust > 0
      mesh.scale.set(1 + thrust * 0.4, Math.max(0.001, flameScaleY), 1 + thrust * 0.4)
    }

    // Air pose: the model faces local -Z, so a FORWARD lean is a NEGATIVE
    // rotation.x (positive would tip the face up/backwards). A gentle
    // forward stance in the air, stronger under thrust, uprighting a
    // little while rising and tipping more while falling.
    if (modelRef.current) {
      const lean = reducedMotion
        ? 0
        : airborne
          ? -0.1 - thrust * 0.22 + THREE.MathUtils.clamp(flight.vy * 0.02, -0.06, 0.08)
          : 0
      modelRef.current.rotation.x = THREE.MathUtils.damp(
        modelRef.current.rotation.x,
        lean,
        6,
        Math.min(delta, 0.05),
      )
    }
  })

  // Boot FX live OUTSIDE the tilting modelRef group, so the flames stay
  // vertical under the boots even while the body leans forward in flight.
  const flameGeometry = useMemo(() => {
    // Base at origin, tip pointing down: scaling grows the flame downward
    // from the sole instead of around its centre.
    const geometry = new THREE.ConeGeometry(0.05, 0.32, 12)
    geometry.rotateX(Math.PI)
    geometry.translate(0, -0.16, 0)
    return geometry
  }, [])
  useEffect(() => () => flameGeometry.dispose(), [flameGeometry])

  const boot = (side: -1 | 1, flameRef: typeof leftFlame) => (
    <group position={[side * BOOT_X, 0, 0.02]}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.032, 0.048, 0.09, 10]} />
        <meshStandardMaterial color="#2A1D3B" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.028, 10, 8]} />
        <meshBasicMaterial color="#FFBA70" toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh ref={flameRef} geometry={flameGeometry} position={[0, 0.03, 0]} visible={false}>
        <meshBasicMaterial
          color="#FFBA70"
          toneMapped={false}
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )

  return (
    <group>
      <group ref={modelRef}>
        <primitive object={scene} />
      </group>
      {boot(-1, leftFlame)}
      {boot(1, rightFlame)}
    </group>
  )
}
