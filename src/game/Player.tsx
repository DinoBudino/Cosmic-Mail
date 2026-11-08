import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS } from '../data/marsObjects'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { findNearbySite, getAutoMove } from './interaction'
import { Companion } from './Companion'
import {
  computeCameraOffset,
  getMovementBasis,
} from './cameraRig'
import { consumeInteract, readMoveAxes, type MoveAxes } from './input'
import {
  getTerrainHeight,
  getTerrainSlope,
  slopeSpeedFactor,
} from './terrainHeight'
import { CAMERA, PLAYER, WORLD } from './worldConfig'

/**
 * Lifts the camera over terrain between the player and the desired position.
 * Sampling the boom avoids the camera sinking into a dune on the way.
 */
function resolveCameraClearance(
  target: THREE.Vector3,
  desired: THREE.Vector3,
): void {
  let lift = 0

  for (let index = 1; index <= CAMERA.collisionSamples; index += 1) {
    const t = index / CAMERA.collisionSamples
    const x = target.x + (desired.x - target.x) * t
    const z = target.z + (desired.z - target.z) * t
    const y = target.y + (desired.y - target.y) * t
    const floor = getTerrainHeight(x, z) + CAMERA.minTerrainClearance
    if (y < floor) lift = Math.max(lift, floor - y)
  }

  const cameraFloor =
    getTerrainHeight(desired.x, desired.z) + CAMERA.minTerrainClearance
  if (desired.y < cameraFloor) lift = Math.max(lift, cameraFloor - desired.y)
  desired.y += lift
}

/** Pushes the camera out of the four large Mars models when it gets too close. */
function resolveObjectClearance(desired: THREE.Vector3): void {
  for (const object of MARS_OBJECTS) {
    const objectTop =
      getTerrainHeight(object.position.x, object.position.z) + 4.6
    if (desired.y > objectTop) continue

    const dx = desired.x - object.position.x
    const dz = desired.z - object.position.z
    const distance = Math.hypot(dx, dz)
    if (distance >= CAMERA.objectClearance) continue

    if (distance < 1e-4) {
      desired.x += CAMERA.objectClearance
      continue
    }

    const push = CAMERA.objectClearance / distance
    desired.x = object.position.x + dx * push
    desired.z = object.position.z + dz * push
  }
}

export function Player() {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Group>(null)
  const rightLeg = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)

  const velocity = useRef(new THREE.Vector3())
  const axes = useRef<MoveAxes>({ x: 0, y: 0 })
  const forward = useRef(new THREE.Vector2())
  const right = useRef(new THREE.Vector2())
  const yaw = useRef(0)
  const phase = useRef(0)
  const cameraTarget = useRef(new THREE.Vector3())
  const cameraDesired = useRef(new THREE.Vector3())
  const cameraOffset = useRef(new THREE.Vector3())
  const lookGoal = useRef(new THREE.Vector3())

  const { camera } = useThree()
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const quality = useGameStore((state) => state.quality)

  const spawn = useMemo(
    () =>
      new THREE.Vector3(
        WORLD.spawn.x,
        getTerrainHeight(WORLD.spawn.x, WORLD.spawn.z),
        WORLD.spawn.z,
      ),
    [],
  )

  useLayoutEffect(() => {
    const player = group.current
    if (!player) return
    player.position.copy(spawn)

    cameraTarget.current.set(
      spawn.x,
      spawn.y + CAMERA.lookHeight,
      spawn.z,
    )
    computeCameraOffset(cameraOffset.current)
    camera.position.copy(cameraTarget.current).add(cameraOffset.current)
    camera.lookAt(cameraTarget.current)
  }, [camera, spawn])

  useFrame((state, delta) => {
    const player = group.current
    if (!player) return

    const paused = isWorldPaused()
    const dt = Math.min(delta, 0.05)
    if (paused) {
      velocity.current.set(0, 0, 0)
      return
    }

    if (!paused) {
      const store = useGameStore.getState()
      store.setNearbySite(findNearbySite(player.position))
      if (consumeInteract()) {
        store.openNearbySite()
        if (isWorldPaused()) {
          velocity.current.set(0, 0, 0)
          return
        }
      }
      readMoveAxes(axes.current)
      getMovementBasis(forward.current, right.current)

      const slope = getTerrainSlope(player.position.x, player.position.z)
      const speed = PLAYER.moveSpeed * slopeSpeedFactor(slope)
      let moveX =
        forward.current.x * axes.current.y +
        right.current.x * axes.current.x
      let moveZ =
        forward.current.y * axes.current.y +
        right.current.y * axes.current.x

      if (store.travelTargetId) {
        if (Math.hypot(axes.current.x, axes.current.y) > 0.01) {
          store.cancelTravel()
        } else {
          const travel = getAutoMove(player.position, store.travelTargetId)
          moveX = travel.x
          moveZ = travel.z
          if (travel.arrived) {
            store.cancelTravel()
            velocity.current.set(0, 0, 0)
          }
        }
      }

      const targetX = moveX * speed
      const targetZ = moveZ * speed
      const blend = 1 - Math.exp(-PLAYER.moveAccel * dt)
      velocity.current.x += (targetX - velocity.current.x) * blend
      velocity.current.z += (targetZ - velocity.current.z) * blend

      player.position.x += velocity.current.x * dt
      player.position.z += velocity.current.z * dt

      const distanceFromCenter = Math.hypot(
        player.position.x,
        player.position.z,
      )
      if (distanceFromCenter > WORLD.playRadius) {
        const scale = WORLD.playRadius / distanceFromCenter
        player.position.x *= scale
        player.position.z *= scale
        velocity.current.x *= 0.4
        velocity.current.z *= 0.4
      }

      player.position.y = getTerrainHeight(
        player.position.x,
        player.position.z,
      )
      store.setNearbySite(findNearbySite(player.position))

      const horizontalSpeed = Math.hypot(
        velocity.current.x,
        velocity.current.z,
      )
      if (horizontalSpeed > 0.12) {
        const targetYaw = Math.atan2(
          -velocity.current.x,
          -velocity.current.z,
        )
        let difference = targetYaw - yaw.current
        difference = Math.atan2(Math.sin(difference), Math.cos(difference))
        yaw.current += difference * (1 - Math.exp(-PLAYER.turnSpeed * dt))
        player.rotation.y = yaw.current
      }

      const motion = Math.min(horizontalSpeed / PLAYER.moveSpeed, 1)
      if (motion > 0.01) phase.current += dt * (3 + motion * 7)

      if (reducedMotion) {
        if (leftLeg.current) leftLeg.current.rotation.x = 0
        if (rightLeg.current) rightLeg.current.rotation.x = 0
        if (leftArm.current) {
          leftArm.current.rotation.x = 0
          leftArm.current.rotation.z = 0
        }
        if (rightArm.current) {
          rightArm.current.rotation.x = 0
          rightArm.current.rotation.z = 0
        }
        if (body.current) body.current.position.y = 0
      } else {
        const walkSwing = Math.sin(phase.current) * 0.55 * motion
        if (leftLeg.current) leftLeg.current.rotation.x = walkSwing
        if (rightLeg.current) rightLeg.current.rotation.x = -walkSwing
        if (leftArm.current) {
          leftArm.current.rotation.x = -walkSwing * 0.75
          leftArm.current.rotation.z =
            Math.sin(state.clock.elapsedTime * 1.2) * 0.035 * (1 - motion)
        }
        if (rightArm.current) {
          rightArm.current.rotation.x = walkSwing * 0.75
          rightArm.current.rotation.z =
            -Math.sin(state.clock.elapsedTime * 1.2) * 0.035 * (1 - motion)
        }
        if (body.current) {
          const walkBob = Math.abs(Math.sin(phase.current)) * 0.05 * motion
          const idleBob =
            Math.sin(state.clock.elapsedTime * 1.6) * 0.012 * (1 - motion)
          body.current.position.y = walkBob + idleBob
        }
      }
    }

    lookGoal.current.set(
      player.position.x,
      player.position.y + CAMERA.lookHeight,
      player.position.z,
    )
    computeCameraOffset(cameraOffset.current)
    cameraDesired.current.copy(lookGoal.current).add(cameraOffset.current)
    resolveObjectClearance(cameraDesired.current)
    resolveCameraClearance(lookGoal.current, cameraDesired.current)

    camera.position.lerp(
      cameraDesired.current,
      1 - Math.exp(-CAMERA.damping * dt),
    )
    cameraTarget.current.lerp(
      lookGoal.current,
      1 - Math.exp(-CAMERA.lookDamping * dt),
    )
    camera.lookAt(cameraTarget.current)
  })

  return (
    <>
    <Companion playerRef={group} />
    <group ref={group} position={spawn}>
      {quality === 'low' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
          <circleGeometry args={[0.62, 24]} />
          <meshBasicMaterial
            color="#2a1420"
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
      )}

      <group ref={leftLeg} position={[-0.22, 0.7, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.28, 0.55, 0.36]} />
          <meshStandardMaterial color="#e8e2ed" roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.63, -0.04]} castShadow>
          <boxGeometry args={[0.3, 0.12, 0.46]} />
          <meshStandardMaterial color="#c9b9c9" roughness={0.7} />
        </mesh>
      </group>

      <group ref={rightLeg} position={[0.22, 0.7, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.28, 0.55, 0.36]} />
          <meshStandardMaterial color="#e8e2ed" roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.63, -0.04]} castShadow>
          <boxGeometry args={[0.3, 0.12, 0.46]} />
          <meshStandardMaterial color="#c9b9c9" roughness={0.7} />
        </mesh>
      </group>

      <group ref={body}>
        <mesh position={[0, 0.92, 0]} castShadow>
          <capsuleGeometry args={[0.42, 0.62, 6, 12]} />
          <meshStandardMaterial color="#f2e9e8" roughness={0.7} />
        </mesh>

        <mesh position={[0, 1.05, -0.4]} castShadow>
          <boxGeometry args={[0.34, 0.22, 0.06]} />
          <meshStandardMaterial
            color="#e0a25f"
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>

        <mesh position={[0, 1.78, 0]} castShadow>
          <sphereGeometry args={[0.54, 24, 20]} />
          <meshStandardMaterial color="#fef6e8" roughness={0.55} />
        </mesh>

        <mesh position={[0, 1.78, -0.36]}>
          <sphereGeometry args={[0.38, 20, 16]} />
          <meshStandardMaterial
            color="#191b42"
            metalness={0.5}
            roughness={0.18}
          />
        </mesh>

        <mesh position={[0, 0.98, 0.5]} castShadow>
          <boxGeometry args={[0.7, 0.8, 0.3]} />
          <meshStandardMaterial color="#edac65" roughness={0.7} />
        </mesh>

        <mesh position={[0.36, 2.22, 0.1]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
          <meshStandardMaterial color="#c1ad9f" />
        </mesh>
        <mesh position={[0.36, 2.44, 0.1]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshBasicMaterial color="#ff9b6a" toneMapped={false} />
        </mesh>

        <group ref={leftArm} position={[-0.5, 1.3, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <boxGeometry args={[0.22, 0.55, 0.26]} />
            <meshStandardMaterial color="#e8e2ed" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.62, 0]} castShadow>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshStandardMaterial color="#d9cfd9" roughness={0.7} />
          </mesh>
        </group>

        <group ref={rightArm} position={[0.5, 1.3, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <boxGeometry args={[0.22, 0.55, 0.26]} />
            <meshStandardMaterial color="#e8e2ed" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.62, 0]} castShadow>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshStandardMaterial color="#d9cfd9" roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
    </>
  )
}
