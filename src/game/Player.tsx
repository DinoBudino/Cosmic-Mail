import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS, REGION_INFO } from '../data/marsObjects'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { AstronautModel } from './AstronautModel'
import { Companion } from './Companion'
import {
  computeCameraOffset,
  getMovementBasis,
} from './cameraRig'
import { consumeInteract, isBootHeld, isRunHeld, readMoveAxes, type MoveAxes } from './input'
import { findNearbyRegion, findNearbySite, getAutoMove, resolveSiteCollision } from './interaction'
import { stepVertical, type VerticalState } from './marsGravity'
import { playerPosition } from './playerPosition'
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

  const velocity = useRef(new THREE.Vector3())
  const axes = useRef<MoveAxes>({ x: 0, y: 0 })
  const forward = useRef(new THREE.Vector2())
  const right = useRef(new THREE.Vector2())
  const yaw = useRef(0)
  const motionRef = useRef(0)
  /** Boot thrust + vertical velocity, read by AstronautModel for glow/pose. */
  const flightRef = useRef({ thrust: 0, vy: 0, airborne: 0 })
  /** Signed yaw intent, read by AstronautModel for Turn_Left/Turn_Right. */
  const turnRef = useRef(0)
  const verticalRef = useRef<VerticalState>({ y: 0, vy: 0, grounded: true })
  const prevBoot = useRef(false)
  const cameraTarget = useRef(new THREE.Vector3())
  const cameraDesired = useRef(new THREE.Vector3())
  const cameraOffset = useRef(new THREE.Vector3())
  const lookGoal = useRef(new THREE.Vector3())

  const { camera } = useThree()
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

  const contactShadowTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) return null

    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.28)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [])

  useEffect(() => {
    return () => contactShadowTexture?.dispose()
  }, [contactShadowTexture])

  useLayoutEffect(() => {
    const player = group.current
    if (!player) return
    player.position.copy(spawn)
    verticalRef.current = { y: spawn.y, vy: 0, grounded: true }

    cameraTarget.current.set(
      spawn.x,
      spawn.y + CAMERA.lookHeight,
      spawn.z,
    )
    computeCameraOffset(cameraOffset.current)
    camera.position.copy(cameraTarget.current).add(cameraOffset.current)
    camera.lookAt(cameraTarget.current)
  }, [camera, spawn])

  useFrame((_, delta) => {
    const player = group.current
    if (!player) return

    const dt = Math.min(delta, 0.05)
    const paused = isWorldPaused()
    if (paused) {
      velocity.current.set(0, 0, 0)
      motionRef.current = 0
      flightRef.current.thrust = 0
      return
    }

    const store = useGameStore.getState()
    if (consumeInteract()) {
      store.openNearbySite()
      if (isWorldPaused()) {
        velocity.current.set(0, 0, 0)
        motionRef.current = 0
        return
      }
    }

    readMoveAxes(axes.current)
    getMovementBasis(forward.current, right.current)

    // Jet boots: press edge jumps, hold sustains thrust. Disabled while an
    // assisted trip is active so the route can't be left in mid-air.
    const traveling = Boolean(store.travelTargetId)
    const bootHeld = traveling ? false : isBootHeld()
    const jumpPressed = bootHeld && !prevBoot.current
    prevBoot.current = bootHeld

    const runHeld = isRunHeld()
    const topSpeed = runHeld
      ? PLAYER.moveSpeed * PLAYER.runSpeedMultiplier
      : PLAYER.moveSpeed
    const slope = getTerrainSlope(player.position.x, player.position.z)
    const speed = topSpeed * slopeSpeedFactor(slope)
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
    const groundedNow = verticalRef.current.grounded
    const accel = groundedNow ? PLAYER.moveAccel : PLAYER.airAccel
    const blend = 1 - Math.exp(-accel * dt)
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

    resolveSiteCollision(player.position)

    // Mars gravity: long arcs on takeoff, soft capped falls on landing.
    const groundY = getTerrainHeight(player.position.x, player.position.z)
    const vertical = stepVertical(verticalRef.current, groundY, dt, {
      jumpPressed,
      bootHeld,
    })
    verticalRef.current = vertical
    player.position.y = vertical.y
    const heightAboveGround = Math.max(0, vertical.y - groundY)
    flightRef.current = {
      thrust: bootHeld && !vertical.grounded ? 1 : 0,
      vy: vertical.vy,
      airborne: heightAboveGround,
    }
    playerPosition.x = player.position.x
    playerPosition.z = player.position.z
    playerPosition.airborne = heightAboveGround

    // Rings + PIP only count close to the ground, so a high boot flight
    // over a site never triggers inspection mid-air.
    if (heightAboveGround <= PLAYER.inspectMaxHeight) {
      store.setNearbySite(findNearbySite(player.position))
    } else {
      store.setNearbySite(null)
    }
    const regionId = findNearbyRegion(player.position)
    if (regionId && !store.visitedRegions[regionId]) {
      store.markRegionVisited(regionId)
      if (!store.nearbySiteId) store.showPipMessage(REGION_INFO[regionId].pipMessage)
    }

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
      turnRef.current = difference
      yaw.current += difference * (1 - Math.exp(-PLAYER.turnSpeed * dt))
      player.rotation.y = yaw.current
    } else {
      turnRef.current = 0
    }

    motionRef.current = Math.min(horizontalSpeed / (PLAYER.moveSpeed * PLAYER.runSpeedMultiplier), 1)

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
      <Companion playerRef={group} motionRef={motionRef} />
      <group ref={group} position={spawn}>
        {quality === 'low' && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.002, 0]}
            scale={[1.0, 0.72, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={contactShadowTexture ?? undefined}
              color="#2a1420"
              transparent
              opacity={0.55}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )}

        <Suspense fallback={null}>
          <AstronautModel
            motionRef={motionRef}
            flightRef={flightRef}
            turnRef={turnRef}
          />
        </Suspense>
      </group>
    </>
  )
}
