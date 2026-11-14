import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS, REGION_INFO } from '../data/marsObjects'
import { lensForKey } from '../data/scannerLenses'
import { SPIRIT_SITE } from '../data/spiritSite'
import { useJourneyStore } from '../store/journeyStore'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { emitAudio, emitFootstep } from './audio/audioEvents'
import { AstronautModel } from './AstronautModel'
import { resolveEnvironmentalCollision } from './environmentCollision'
import { isFlightUnlocked } from './flight'
import { resolveBoulderCollision } from './landscape'
import {
  inspectSpirit,
  requestFlightRestrictedNotice,
  requestProtocolLine,
} from './missionNarrative'
import { SCANNER_LOCKED_LINE, areFreeScansAllowed } from '../data/arrivalProtocol'
import { getCurrentProtocolStep } from './protocolStep'
import { useNarrativeStore } from '../store/narrativeStore'
import { ScannerFirstPersonView } from './ScannerFirstPersonView'
import { Companion } from './Companion'
import {
  computeCameraOffset,
  computeScannerCameraOffset,
  getMovementBasis,
  getOrbit,
} from './cameraRig'
import {
  consumeInteract,
  consumeScannerLensKey,
  consumeScannerToggle,
  isBootHeld,
  isRunHeld,
  readMoveAxes,
  type MoveAxes,
} from './input'
import { findNearbyRegion, findNearbySite, getAutoMove, resolveSiteCollision } from './interaction'
import { stepVertical, type VerticalState } from './marsGravity'
import { markFirstControl } from './pacing'
import { playerPosition } from './playerPosition'
import { findNearbySpirit, resolveSpiritCollision } from './spiritSite'
import {
  getTerrainHeight,
  getTerrainSlope,
  slopeSpeedFactor,
} from './terrainHeight'
import { CAMERA, PLAYER, SCANNER, WORLD } from './worldConfig'

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

  // Spirit is rendered outside MARS_OBJECTS so the four original sites,
  // their flatten zones and the painted route stay untouched.
  const spiritTop =
    getTerrainHeight(SPIRIT_SITE.position.x, SPIRIT_SITE.position.z) + 3.2
  if (desired.y <= spiritTop) {
    const dx = desired.x - SPIRIT_SITE.position.x
    const dz = desired.z - SPIRIT_SITE.position.z
    const distance = Math.hypot(dx, dz)
    if (distance < SPIRIT_SITE.cameraClearance) {
      if (distance < 1e-4) {
        desired.x += SPIRIT_SITE.cameraClearance
      } else {
        const push = SPIRIT_SITE.cameraClearance / distance
        desired.x = SPIRIT_SITE.position.x + dx * push
        desired.z = SPIRIT_SITE.position.z + dz * push
      }
    }
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
  const wasGrounded = useRef(true)
  const thrusterLoopActive = useRef(false)
  const stepDistance = useRef(0)
  const stepVariant = useRef(0)
  const cameraTarget = useRef(new THREE.Vector3())
  const cameraDesired = useRef(new THREE.Vector3())
  const cameraOffset = useRef(new THREE.Vector3())
  const lookGoal = useRef(new THREE.Vector3())
  const firstPersonDesired = useRef(new THREE.Vector3())
  const firstPersonLook = useRef(new THREE.Vector3())
  const cinematicLook = useRef(new THREE.Vector3())
  const astronautRef = useRef<THREE.Group>(null)

  const { camera } = useThree()
  const quality = useGameStore((state) => state.quality)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerCamera = useGameStore((state) => state.scannerCamera)
  const firstPersonScanner =
    scannerEquipped && scannerCamera === 'first-person'

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
    if (!paused) markFirstControl()
    if (paused) {
      velocity.current.set(0, 0, 0)
      motionRef.current = 0
      flightRef.current.thrust = 0
      stepDistance.current = 0
      if (thrusterLoopActive.current) {
        thrusterLoopActive.current = false
        emitAudio('thrusterStopped')
      }
      return
    }

    let store = useGameStore.getState()

    if (consumeScannerToggle()) {
      if (store.scannerEquipped) {
        store.unequipScanner()
      } else if (store.scannerLocked) {
        requestProtocolLine(SCANNER_LOCKED_LINE)
      } else if (playerPosition.airborne < 0.25) {
        store.equipScanner(SPIRIT_SITE.missionId)
      }
      store = useGameStore.getState()
    }

    const lensKey = consumeScannerLensKey()
    if (lensKey && store.scannerEquipped) {
      const lens = lensForKey(lensKey)
      if (lens) store.setScannerLens(lens)
    }

    if (consumeInteract()) {
      const spiritProgress =
        useJourneyStore.getState().save?.missions[SPIRIT_SITE.missionId]
      if (store.nearbySpirit && !spiritProgress?.discovered) {
        inspectSpirit()
      } else if (!store.scannerEquipped) {
        if (store.nearbySpirit) {
          // E is contextual inspection/review, never a quick scan menu.
          store.openScannerRecords(SPIRIT_SITE.missionId)
        } else {
          store.openNearbySite()
        }
      }
      if (isWorldPaused()) {
        velocity.current.set(0, 0, 0)
        motionRef.current = 0
        return
      }
      store = useGameStore.getState()
    }

    // Equipping the scanner never freezes locomotion: the astronaut walks,
    // runs and boosts exactly as before while the device stays in hand.
    readMoveAxes(axes.current)
    getMovementBasis(forward.current, right.current)

    // Jet boots: press edge jumps, hold sustains thrust. Only an assisted
    // trip disables the boots; the scanner stays compatible with flight.
    const traveling = Boolean(store.travelTargetId)
    const missionProgress =
      useJourneyStore.getState().save?.missions[SPIRIT_SITE.missionId]
    // Ground survey rule: flight unlocks after the memory is recovered. It is
    // a level-design decision, not a broken jetpack, and movement stays free.
    const flightUnlocked = isFlightUnlocked(missionProgress)
    const rawBoot = traveling ? false : isBootHeld()
    const bootHeld = rawBoot && flightUnlocked
    const jumpPressed = bootHeld && !prevBoot.current
    if (rawBoot && !flightUnlocked && !prevBoot.current) {
      requestFlightRestrictedNotice()
    }
    prevBoot.current = rawBoot

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
    resolveSpiritCollision(player.position)
    const playerAir = Math.max(
      0,
      player.position.y - getTerrainHeight(player.position.x, player.position.z),
    )
    resolveBoulderCollision(
      player.position,
      playerAir,
      quality === 'low' ? 64 : 150,
    )
    resolveEnvironmentalCollision(player.position, playerAir)

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

    // Jet-boot bed + landing. Only real flight edges trigger sound;
    // holding the key never restarts the loop every frame.
    const thrusting = bootHeld && !vertical.grounded
    if (thrusting && !thrusterLoopActive.current) {
      thrusterLoopActive.current = true
      emitAudio('thrusterStarted')
    } else if (!thrusting && thrusterLoopActive.current) {
      thrusterLoopActive.current = false
      emitAudio('thrusterStopped')
    }
    if (!wasGrounded.current && vertical.grounded) {
      emitAudio('landing')
    }
    wasGrounded.current = vertical.grounded

    // Rings + PIP only count close to the ground, so a high boot flight
    // over a site never triggers inspection mid-air.
    if (heightAboveGround <= PLAYER.inspectMaxHeight) {
      const nearSpirit = findNearbySpirit(player.position)
      store.setNearbySpirit(nearSpirit)
      store.setNearbySite(nearSpirit ? null : findNearbySite(player.position))
    } else {
      store.setNearbySpirit(false)
      store.setNearbySite(null)
    }
    const regionId = findNearbyRegion(player.position)
    if (
      regionId &&
      !store.visitedRegions[regionId] &&
      areFreeScansAllowed(getCurrentProtocolStep())
    ) {
      // Region comments are ambient (P3): free exploration only, and they go
      // through the central dialogue policy like every other PIP line.
      store.markRegionVisited(regionId)
      if (!store.nearbySiteId) {
        useNarrativeStore.getState().enqueue({
          id: `region:${regionId}`,
          text: REGION_INFO[regionId].pipMessage,
          priority: 'ambient',
        })
      }
    }

    const horizontalSpeed = Math.hypot(
      velocity.current.x,
      velocity.current.z,
    )
    if (store.scannerEquipped) {
      // The torso keeps facing the camera yaw while the scanner is out; the
      // right arm aims independently at the pointer target.
      const orbit = getOrbit()
      let difference = orbit.yaw - yaw.current
      difference = Math.atan2(Math.sin(difference), Math.cos(difference))
      yaw.current += difference * (1 - Math.exp(-14 * dt))
      player.rotation.y = yaw.current
      turnRef.current = 0
    } else if (horizontalSpeed > 0.12) {
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

    motionRef.current = Math.min(
      horizontalSpeed / (PLAYER.moveSpeed * PLAYER.runSpeedMultiplier),
      1,
    )

    // Footsteps follow travelled distance, never frame count.
    if (vertical.grounded && horizontalSpeed > 0.35) {
      stepDistance.current += horizontalSpeed * dt
      const stride = runHeld ? 1.08 : 0.82
      if (stepDistance.current >= stride) {
        stepDistance.current = 0
        stepVariant.current += 1
        const destination =
          useJourneyStore.getState().save?.currentDestination ?? 'mars'
        emitFootstep(
          destination === 'moon' ? 'lunar' : 'rock',
          stepVariant.current,
        )
      }
    } else {
      stepDistance.current = Math.max(0, stepDistance.current - dt * 0.8)
    }

    const cinematic = useGameStore.getState().cinematicFocus
    const cinematicActive =
      Boolean(cinematic) &&
      !store.scannerEquipped &&
      !store.reducedMotion &&
      motionRef.current <= 0.2 &&
      Date.now() < (cinematic?.until ?? 0)
    if (
      cinematic &&
      (store.scannerEquipped ||
        store.reducedMotion ||
        motionRef.current > 0.2 ||
        Date.now() >= cinematic.until)
    ) {
      useGameStore.getState().endCinematic()
    }

    if (store.scannerEquipped && store.scannerCamera === 'first-person') {
      // First person: camera at the visor, forward from the orbit yaw/pitch.
      const orbit = getOrbit()
      const cosPitch = Math.cos(orbit.pitch)
      const dirX = -Math.sin(orbit.yaw) * cosPitch
      const dirY = -Math.sin(orbit.pitch)
      const dirZ = -Math.cos(orbit.yaw) * cosPitch
      firstPersonDesired.current.set(
        player.position.x,
        player.position.y + SCANNER.firstPersonEyeHeight,
        player.position.z,
      )
      firstPersonLook.current.set(
        firstPersonDesired.current.x + dirX * 10,
        firstPersonDesired.current.y + dirY * 10,
        firstPersonDesired.current.z + dirZ * 10,
      )
      camera.position.lerp(
        firstPersonDesired.current,
        1 - Math.exp(-SCANNER.firstPersonDamping * dt),
      )
      cameraTarget.current.lerp(
        firstPersonLook.current,
        1 - Math.exp(-14 * dt),
      )
      camera.lookAt(cameraTarget.current)
    } else if (store.scannerEquipped) {
      // Comfortable third-person framing: the astronaut stays centred and
      // visible while the mouse controls only the reticle, not the camera.
      lookGoal.current.set(
        player.position.x,
        player.position.y + CAMERA.lookHeight,
        player.position.z,
      )
      computeScannerCameraOffset(cameraOffset.current)
      cameraDesired.current.copy(lookGoal.current).add(cameraOffset.current)
      resolveObjectClearance(cameraDesired.current)
      resolveCameraClearance(lookGoal.current, cameraDesired.current)

      camera.position.lerp(
        cameraDesired.current,
        1 - Math.exp(-SCANNER.cameraDamping * dt),
      )
      cameraTarget.current.lerp(
        lookGoal.current,
        1 - Math.exp(-CAMERA.lookDamping * dt),
      )
      camera.lookAt(cameraTarget.current)
    } else {
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
    }

    if (cinematic && cinematicActive) {
      cinematicLook.current.set(
        cinematic.target.x,
        getTerrainHeight(cinematic.target.x, cinematic.target.z) + 1.5,
        cinematic.target.z,
      )
      cameraTarget.current.lerp(
        cinematicLook.current,
        1 - Math.exp(-2.6 * dt),
      )
      camera.lookAt(cameraTarget.current)
    }

    if (astronautRef.current) {
      const firstPersonActive =
        store.scannerEquipped && store.scannerCamera === 'first-person'
      const cameraDistance = camera.position.distanceTo(player.position)
      astronautRef.current.visible =
        !firstPersonActive &&
        (!store.scannerEquipped || cameraDistance > 2.2)
    }
  })

  return (
    <>
      <Companion playerRef={group} motionRef={motionRef} />
      <group
        ref={group}
        position={spawn}
        userData={{ scannerIgnore: true }}
      >
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

        <group ref={astronautRef} visible={!firstPersonScanner}>
          <Suspense fallback={null}>
            <AstronautModel
              motionRef={motionRef}
              flightRef={flightRef}
              turnRef={turnRef}
            />
          </Suspense>
        </group>
      </group>
      {firstPersonScanner && <ScannerFirstPersonView />}
    </>
  )
}
