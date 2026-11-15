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
import { MARS_WORLD_SITES } from '../data/marsObjects'
import { useGameStore } from '../store/gameStore'
import { getOrbit } from './cameraRig'
import { clampAimDirection, scannerAim } from './scannerAim'
import { CosmicScannerDevice } from './CosmicScannerDevice'
import { PLAYER, SCANNER } from './worldConfig'

const MODEL_URL = 'models/astronaut-v2.glb?v=astronaut-v2-gait-1'

useGLTF.preload(MODEL_URL)

/** Right-arm bones of the V2 rig (blender/AstronautV2, 18_export_web.py). */
const ARM_BONES = {
  upper: 'UPPER_ARM_R',
  fore: 'FOREARM_R',
  hand: 'HAND_R',
} as const

/**
 * Hand bone local axes (while the scanner is held):
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

interface AstronautModelProps {
  motionRef: RefObject<number>
  turnRef: RefObject<number>
}

/** Ground speed (m/s) at which each authored cycle's feet keep up best. */
const WALK_REF_SPEED = 4.6
const RUN_REF_SPEED = 6.6
/** Clip lengths in astronaut-v2.glb (one cycle = two steps). */
const WALK_CYCLE_S = 0.633
const RUN_CYCLE_S = 0.533
/** Above this share of top speed the Run clip plays (else Walk). */
export const RUN_CLIP_MOTION = 0.86
/**
 * Ground covered per footstep by each clip at its reference speed. The
 * clip's playback follows ground speed, so a footstep sound every stride
 * lands on the animated foot contact.
 */
export const WALK_STRIDE = (WALK_REF_SPEED * WALK_CYCLE_S) / 2
export const RUN_STRIDE = (RUN_REF_SPEED * RUN_CYCLE_S) / 2

/**
 * Loads the Blender-authored astronaut (V2, one skinned mesh) and drives
 * its clips. Movement, camera, collision and ground following stay in
 * Player.tsx; the astronaut is always on foot (no jet boots).
 *
 * The GLB is authored facing Blender -Y, which becomes +Z after glTF Y-up
 * conversion. The controller expects -Z, so the imported scene sits inside a
 * documented 180 degree Y wrapper.
 *
 * Animation selection is a presentation layer over the controller:
 * - Idle / Walk / Run. Walk and Run are authored cycles (blender/AstronautV2/
 *   scripts/gait.py): a springy Mars lope with knee bend, heel-toe roll,
 *   hip bob and twist, and arm swing. Their playback speed follows the real
 *   ground speed so the feet slide as little as possible;
 * - site/region/turn events trigger Interact/PickUp/Celebrate/Turn;
 * - no ambient Wave on Mars: standing still stays in a calm Idle.
 */
export function AstronautModel({
  motionRef,
  turnRef,
}: AstronautModelProps) {
  const modelRef = useRef<THREE.Group>(null)
  const currentAction = useRef('')
  const gesture = useRef<string | null>(null)
  const gestureStart = useRef(0)
  const pendingCelebrate = useRef(false)
  const previousSite = useRef<string | null>(null)
  const previousVisitedCount = useRef(0)
  const lastTurn = useRef(-100)
  const equipWeight = useRef(0)
  const scannerMount = useRef<THREE.Group>(null)
  const aimSmooth = useRef(new THREE.Vector3())
  const aimSeeded = useRef(false)

  const { scene, animations } = useGLTF(MODEL_URL)
  const { actions } = useAnimations(animations, modelRef)
  const actionsRef = useRef(actions)

  const rig = useMemo(() => {
    const upperArm = scene.getObjectByName(ARM_BONES.upper)
    const forearm = scene.getObjectByName(ARM_BONES.fore)
    const handBone = scene.getObjectByName(ARM_BONES.hand)
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
    const turn = turnRef.current
    const actionSet = actionsRef.current
    const now = state.clock.elapsedTime
    const store = useGameStore.getState()

    const duration = (name: string) =>
      actionSet[name]?.getClip().duration ?? 0

    // Existing site interaction: Interact for inspectable artifacts, PickUp
    // for places still under construction.
    const siteId = store.activeSiteId
    if (siteId && siteId !== previousSite.current) {
      const site = MARS_WORLD_SITES.find((item) => item.id === siteId)
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
      !store.scannerEquipped &&
      motion > 0.15 &&
      Math.abs(turn) > 0.1 &&
      now - lastTurn.current > 0.9
    ) {
      lastTurn.current = now
      startGesture(turn > 0 ? 'Turn_Left' : 'Turn_Right', now, true)
    }

    if (!gesture.current) {
      const desired = motion > RUN_CLIP_MOTION ? 'Run' : motion > 0.06 ? 'Walk' : 'Idle'
      playClip(desired, 'loop', desired === 'Idle' ? 0.25 : 0.2)
      if (desired === 'Walk' || desired === 'Run') {
        const action = actionSet[desired]
        if (action) {
          // Cadence follows the real ground speed (motion is speed / top run
          // speed), clamped so a slow start never looks like slow motion.
          const speed = motion * PLAYER.moveSpeed * PLAYER.runSpeedMultiplier
          const reference = desired === 'Run' ? RUN_REF_SPEED : WALK_REF_SPEED
          action.setEffectiveTimeScale(
            THREE.MathUtils.clamp(speed / reference, 0.55, 1.35),
          )
        }
      }
    }

    // Physical Cosmic Scanner. The mixer has already updated the authored
    // arm pose, so this layer blends the right arm into a stable aim pose
    // without touching the other bones.
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
