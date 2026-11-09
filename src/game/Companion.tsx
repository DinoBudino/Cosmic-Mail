import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS, REGION_APPROACH_RADIUS } from '../data/marsObjects'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { SITE_COLLISION_RADII } from './interaction'
import {
  hoverHeight,
  pickLookTarget,
  PIP_MIN_PLAYER_DISTANCE,
  pushOutOfCylinders,
  randomLookDuration,
  randomLookInterval,
  sideAnchor,
  type PipPoint,
} from './pipFlight'
import { getBoulderObstacles } from './landscape'
import { getTerrainHeight } from './terrainHeight'
import { WORLD } from './worldConfig'

const EYE_COLOR = '#F2B5E2'
const ALERT_COLOR = '#FFD29A'
const SHELL_COLOR = '#F2EAE5'
const SCREEN_COLOR = '#17172E'
const VIOLET_COLOR = '#75658C'
const ORANGE_COLOR = '#E3A16A'
const THRUSTER_COLOR = '#FFBA70'

const EYE_PINK = new THREE.Color(EYE_COLOR)
const EYE_ALERT = new THREE.Color(ALERT_COLOR)

type Expression =
  | 'idle'
  | 'follow'
  | 'curious'
  | 'happy'
  | 'thinking'
  | 'alert'
  | 'surprised'

const damp = THREE.MathUtils.damp

interface Particle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  life: number
  maxLife: number
}

/** Fictional floating mail assistant with a soft, expressive face. */
export function Companion({
  playerRef,
  motionRef,
}: {
  playerRef: RefObject<THREE.Group | null>
  motionRef: RefObject<number>
}) {
  const robot = useRef<THREE.Group>(null)
  const shell = useRef<THREE.Group>(null)
  const antenna = useRef<THREE.Group>(null)
  const evaArmLeft = useRef<THREE.Group>(null)
  const evaArmRight = useRef<THREE.Group>(null)
  const eyeLeft = useRef<THREE.Group>(null)
  const eyeRight = useRef<THREE.Group>(null)
  const arcLeft = useRef<THREE.Mesh>(null)
  const arcRight = useRef<THREE.Mesh>(null)
  const mouthLine = useRef<THREE.Mesh>(null)
  const mouthSmile = useRef<THREE.Mesh>(null)
  const mouthOpen = useRef<THREE.Mesh>(null)
  const thrusterGlow = useRef<THREE.Mesh>(null)
  const thrusterCore = useRef<THREE.Mesh>(null)
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const particleGroup = useRef<THREE.Group>(null)
  const particles = useRef<Particle[]>([])

  const goal = useRef(new THREE.Vector3())
  const time = useRef(0)
  const alertMix = useRef(0)
  const expression = useRef<Expression>('idle')
  const lastNearby = useRef<string | null>(null)
  const surpriseUntil = useRef(0)
  const happyUntil = useRef(0)
  const thinkingUntil = useRef(0)
  const nextHappy = useRef(11)
  const nextThinking = useRef(18)

  const lastPos = useRef(new THREE.Vector3())
  const lastVel = useRef(new THREE.Vector3())
  const accel = useRef(new THREE.Vector3())
  const lastPlayerPos = useRef(new THREE.Vector3())
  const playerPosInit = useRef(false)
  const nextLookAt = useRef(5)
  const lookUntil = useRef(0)
  const lookingRef = useRef(false)
  const lookTarget = useRef<PipPoint>({ x: 0, z: 0 })
  const forwardRef = useRef<PipPoint>({ x: 0, z: -1 })
  const sideRef = useRef<1 | -1>(1)
  const yawRate = useRef(0)
  const antennaAngleZ = useRef(0)
  const antennaAngleX = useRef(0)
  const antennaVelZ = useRef(0)
  const antennaVelX = useRef(0)

  const quality = useGameStore((state) => state.quality)
  const detail = quality === 'low' ? 20 : 32

  const eyeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: EYE_COLOR,
        toneMapped: false,
      }),
    [],
  )

  useEffect(() => () => eyeMaterial.dispose(), [eyeMaterial])

  const antennaCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.02, 0.07, -0.012),
        new THREE.Vector3(0.055, 0.115, -0.006),
      ]),
    [],
  )

  useEffect(() => {
    const group = particleGroup.current
    if (!group) return

    const count = quality === 'low' ? 6 : 12
    const geometry = new THREE.SphereGeometry(0.022, 6, 6)
    const created: Particle[] = []
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: THRUSTER_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(0, -10, 0)
      group.add(mesh)
      created.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
      })
    }
    particles.current = created

    return () => {
      for (const particle of created) {
        group.remove(particle.mesh)
        ;(particle.mesh.material as THREE.MeshBasicMaterial).dispose()
      }
      geometry.dispose()
    }
  }, [quality])

  useFrame((_, delta) => {
    const player = playerRef.current
    const current = robot.current
    const body = shell.current
    if (!player || !current || !body || isWorldPaused()) return

    const dt = Math.min(delta, 0.05)
    const game = useGameStore.getState()
    const reducedMotion = game.reducedMotion
    const nearbyId = game.nearbySiteId
    const nearbySite = nearbyId
      ? (MARS_OBJECTS.find((site) => site.id === nearbyId) ?? null)
      : null
    // Region approach: nearest site inside the approach radius, even when the
    // player is not yet inside the small inspect ring — PIP leans in early.
    let regionSite = nearbySite
    if (!regionSite) {
      let best = Infinity
      for (const site of MARS_OBJECTS) {
        const d = Math.hypot(player.position.x - site.position.x, player.position.z - site.position.z)
        if (d <= REGION_APPROACH_RADIUS && d < best) {
          best = d
          regionSite = site
        }
      }
    }
    const motion = motionRef.current

    if (!reducedMotion) time.current += dt
    const t = time.current

    // --- Idle observation pauses (irregular, varied, only when still) ---
    if (!reducedMotion) {
      if (lookingRef.current && (t > lookUntil.current || motion > 0.12)) {
        lookingRef.current = false
        nextLookAt.current = t + randomLookInterval(Math.random)
      } else if (!lookingRef.current && motion < 0.05 && t > nextLookAt.current) {
        lookTarget.current = pickLookTarget(
          { x: player.position.x, z: player.position.z },
          MARS_OBJECTS.map((site) => site.position),
          Math.random,
        )
        lookingRef.current = true
        lookUntil.current = t + randomLookDuration(Math.random)
      }
    } else {
      lookingRef.current = false
    }
    const looking = lookingRef.current

    // --- Side anchor (decisión: al costado, nunca detrás) ---
    if (!playerPosInit.current) {
      lastPlayerPos.current.copy(player.position)
      playerPosInit.current = true
    }
    const playerDx = player.position.x - lastPlayerPos.current.x
    const playerDz = player.position.z - lastPlayerPos.current.z
    const playerSpeed = dt > 0 ? Math.hypot(playerDx, playerDz) / dt : 0
    const forward = forwardRef.current
    if (playerSpeed > 0.4 && dt > 0) {
      const blend = 1 - Math.exp(-8 * dt)
      forward.x += (playerDx / (Math.hypot(playerDx, playerDz) || 1) - forward.x) * blend
      forward.z += (playerDz / (Math.hypot(playerDx, playerDz) || 1) - forward.z) * blend
      const length = Math.hypot(forward.x, forward.z) || 1
      forward.x /= length
      forward.z /= length
    } else {
      // At rest, face the player's facing so PIP settles beside them.
      const facingX = -Math.sin(player.rotation.y)
      const facingZ = -Math.cos(player.rotation.y)
      const blend = 1 - Math.exp(-4 * dt)
      forward.x += (facingX - forward.x) * blend
      forward.z += (facingZ - forward.z) * blend
      const length = Math.hypot(forward.x, forward.z) || 1
      forward.x /= length
      forward.z /= length
    }
    lastPlayerPos.current.copy(player.position)

    // Keep the established side (hysteresis): only switch when PIP is
    // clearly on the other side, so it never flips across the player.
    const lateralX = -forward.z
    const lateralZ = forward.x
    const sideDot =
      (current.position.x - player.position.x) * lateralX +
      (current.position.z - player.position.z) * lateralZ
    if (sideDot > 0.3) sideRef.current = 1
    else if (sideDot < -0.3) sideRef.current = -1

    const anchor = sideAnchor(
      { x: player.position.x, z: player.position.z },
      forward,
      sideRef.current,
    )
    goal.current.set(anchor.x, 0, anchor.z)
    const ahead = {
      x: anchor.x + forward.x * 1.0,
      z: anchor.z + forward.z * 1.0,
    }
    goal.current.y = hoverHeight(anchor, ahead)
    // While speaking, PIP flies to a front-left spot and faces the player.
    const speaking = Boolean(game.pipMessage)
    if (speaking) {
      goal.current.x = player.position.x + forward.x * 1.55 + lateralX * -1.15
      goal.current.z = player.position.z + forward.z * 1.55 + lateralZ * -1.15
      goal.current.y = Math.max(goal.current.y, player.position.y + 1.05)
    }
    // While the astronaut floats on Mars air, PIP climbs to hover beside them.
    const playerAbove = player.position.y - getTerrainHeight(player.position.x, player.position.z)
    if (playerAbove > 0.6) goal.current.y = Math.max(goal.current.y, player.position.y + 0.15)
    if (looking && !speaking) {
      // Drift slightly out and up while observing, then settle back.
      goal.current.x += lateralX * 0.35
      goal.current.z += lateralZ * 0.35
      goal.current.y += 0.3
    }

    // --- Obstacle avoidance ---
    // Site footprints: shared collision radii, never fly through a model.
    const siteCylinders = MARS_OBJECTS.map((site) => ({
      x: site.position.x,
      z: site.position.z,
      radius: SITE_COLLISION_RADII[site.id] + 0.5,
    }))
    const avoided = pushOutOfCylinders({ x: goal.current.x, z: goal.current.z }, siteCylinders)
    goal.current.x = avoided.x
    goal.current.z = avoided.z
    // The player themselves: keep a minimum bubble.
    const playerBubble = pushOutOfCylinders(
      { x: goal.current.x, z: goal.current.z },
      [{ x: player.position.x, z: player.position.z, radius: PIP_MIN_PLAYER_DISTANCE }],
    )
    goal.current.x = playerBubble.x
    goal.current.z = playerBubble.z
    // Boulders: climb over instead of clipping (they are low).
    for (const boulder of getBoulderObstacles(quality === 'low' ? 48 : 120)) {
      const horizontal = Math.hypot(goal.current.x - boulder.x, goal.current.z - boulder.z)
      if (horizontal < boulder.radius + 0.45 && goal.current.y < boulder.topY + 0.4) {
        goal.current.y = boulder.topY + 0.4
      }
    }

    const distance = current.position.distanceTo(goal.current)
    const followSpeed = distance > 5 ? 7 : distance > 2 ? 5 : 3.5
    current.position.lerp(goal.current, 1 - Math.exp(-followSpeed * dt))
    current.position.y = Math.max(
      current.position.y,
      getTerrainHeight(current.position.x, current.position.z) + 0.76,
    )
    // Safety net against tunneling into a site at low frame rates.
    const safe = pushOutOfCylinders(
      { x: current.position.x, z: current.position.z },
      siteCylinders,
    )
    current.position.x = safe.x
    current.position.z = safe.z

    const velocity = lastVel.current
    if (dt > 0) {
      velocity.copy(current.position).sub(lastPos.current).divideScalar(dt)
      accel.current.copy(velocity).sub(lastVel.current).divideScalar(dt)
      lastVel.current.copy(velocity)
    }
    lastPos.current.copy(current.position)

    let targetX = player.position.x
    let targetZ = player.position.z
    if (speaking) {
      // Speaking: face the player (default target above) and smile.
      targetX = player.position.x
      targetZ = player.position.z
    } else if (looking) {
      targetX = lookTarget.current.x
      targetZ = lookTarget.current.z
    } else if (nearbySite) {
      targetX = nearbySite.position.x
      targetZ = nearbySite.position.z
    } else if (regionSite) {
      targetX = regionSite.position.x
      targetZ = regionSite.position.z
    } else if (motion > 0.12) {
      targetX = current.position.x - Math.sin(player.rotation.y)
      targetZ = current.position.z - Math.cos(player.rotation.y)
    }

    const idleLook = reducedMotion ? 0 : Math.sin(t * 0.55) * 0.12
    const yaw =
      Math.atan2(
        targetX - current.position.x,
        targetZ - current.position.z,
      ) + idleLook
    const difference = Math.atan2(
      Math.sin(yaw - current.rotation.y),
      Math.cos(yaw - current.rotation.y),
    )
    current.rotation.y += difference * (1 - Math.exp(-6 * dt))
    if (dt > 0) {
      yawRate.current += ((difference / dt) - yawRate.current) * (1 - Math.exp(-6 * dt))
    }

    if (!reducedMotion) {
      if (nearbyId !== lastNearby.current) {
        lastNearby.current = nearbyId
        if (nearbyId) surpriseUntil.current = t + 0.75
      }

      if (t < surpriseUntil.current) {
        expression.current = 'surprised'
      } else if (speaking) {
        expression.current = 'happy'
      } else if (nearbySite) {
        expression.current = motion > 0.12 ? 'alert' : 'curious'
      } else if (regionSite) {
        expression.current = 'curious'
      } else if (looking) {
        expression.current = 'curious'
      } else if (motion > 0.12) {
        expression.current = 'follow'
      } else {
        if (t > nextHappy.current) {
          happyUntil.current = t + 1.8
          nextHappy.current = t + 14
        }
        if (t > nextThinking.current) {
          thinkingUntil.current = t + 2.2
          nextThinking.current = t + 22
        }
        if (t < happyUntil.current) {
          expression.current = 'happy'
        } else if (t < thinkingUntil.current) {
          expression.current = 'thinking'
        } else {
          expression.current = 'idle'
        }
      }
    } else {
      expression.current = nearbySite ? 'alert' : regionSite ? 'curious' : 'idle'
    }

    const currentExpression = expression.current
    const happy = currentExpression === 'happy'
    const surprised = currentExpression === 'surprised'
    const thinking = currentExpression === 'thinking'
    const curious = currentExpression === 'curious'
    const alert = currentExpression === 'alert'

    const bob = reducedMotion ? 0 : Math.sin(t * 2.3) * 0.032
    const bounce =
      happy && !reducedMotion
        ? Math.max(0, Math.sin(t * 8)) * 0.035
        : 0
    const pop =
      surprised && !reducedMotion
        ? Math.sin(
            Math.min(
              1,
              Math.max(0, (surpriseUntil.current - t) / 0.75),
            ) * Math.PI,
          ) * 0.045
        : 0
    body.position.y = damp(body.position.y, bob + bounce + pop, 10, dt)

    let tiltX = 0
    let tiltZ = 0
    if (!reducedMotion) {
      tiltX = Math.sin(t * 1.1) * 0.025
      tiltZ = Math.sin(t * 1.5) * 0.035
      if (currentExpression === 'follow' || alert) tiltX -= 0.11
      if (curious) {
        tiltX += 0.08
        tiltZ += 0.1
      }
      if (thinking) {
        tiltX -= 0.03
        tiltZ += 0.13
      }
      if (happy) tiltZ += Math.sin(t * 6) * 0.06
      // Dynamic flight: bank into turns, pitch with vertical acceleration.
      tiltZ += THREE.MathUtils.clamp(-yawRate.current * 0.05, -0.32, 0.32)
      tiltX += THREE.MathUtils.clamp(lastVel.current.y * 0.04, -0.16, 0.2)
    }
    body.rotation.x = damp(body.rotation.x, tiltX, 8, dt)
    body.rotation.z = damp(body.rotation.z, tiltZ, 8, dt)

    if (evaArmLeft.current) {
      const hover = reducedMotion ? 0 : Math.sin(t * 2.2) * 0.06
      const flight = motion > 0.12 && !reducedMotion ? -0.55 * motion : 0
      evaArmLeft.current.rotation.z = damp(
        evaArmLeft.current.rotation.z,
        0.45 + hover + (happy && !reducedMotion ? 0.2 : 0),
        8,
        dt,
      )
      evaArmLeft.current.rotation.x = damp(
        evaArmLeft.current.rotation.x,
        flight + (curious ? -0.12 : 0),
        8,
        dt,
      )
    }
    if (evaArmRight.current) {
      const hover = reducedMotion ? 0 : Math.sin(t * 2.2 + Math.PI) * 0.06
      const flight = motion > 0.12 && !reducedMotion ? -0.55 * motion : 0
      evaArmRight.current.rotation.z = damp(
        evaArmRight.current.rotation.z,
        -0.45 + hover - (happy && !reducedMotion ? 0.2 : 0),
        8,
        dt,
      )
      evaArmRight.current.rotation.x = damp(
        evaArmRight.current.rotation.x,
        flight + (curious ? -0.12 : 0),
        8,
        dt,
      )
    }

    if (antenna.current) {
      const baseZ =
        (reducedMotion ? 0 : Math.sin(t * 2.5) * 0.06) +
        (happy && !reducedMotion ? Math.sin(t * 9) * 0.08 : 0)
      const baseX = reducedMotion
        ? 0
        : Math.sin(t * 1.9 + 0.6) * 0.04

      if (!reducedMotion) {
        const springK = 18
        const damping = 3.5
        antennaVelZ.current +=
          (accel.current.x * 0.08 -
            antennaAngleZ.current * springK -
            antennaVelZ.current * damping) *
          dt
        antennaAngleZ.current += antennaVelZ.current * dt
        antennaVelX.current +=
          (accel.current.z * 0.05 -
            antennaAngleX.current * springK -
            antennaVelX.current * damping) *
          dt
        antennaAngleX.current += antennaVelX.current * dt
        antennaAngleZ.current = THREE.MathUtils.clamp(
          antennaAngleZ.current,
          -0.45,
          0.45,
        )
        antennaAngleX.current = THREE.MathUtils.clamp(
          antennaAngleX.current,
          -0.35,
          0.35,
        )
      } else {
        antennaVelZ.current = 0
        antennaVelX.current = 0
        antennaAngleZ.current = damp(antennaAngleZ.current, 0, 8, dt)
        antennaAngleX.current = damp(antennaAngleX.current, 0, 8, dt)
      }

      antenna.current.rotation.z =
        baseZ + antennaAngleZ.current - motion * 0.12
      antenna.current.rotation.x = baseX + antennaAngleX.current
    }

    const pulse =
      reducedMotion ? 0.5 : (Math.sin(t * 3.6) + 1) * 0.5
    if (glowMaterial.current) {
      glowMaterial.current.opacity =
        0.12 + pulse * 0.08 + motion * 0.04 + (alert ? 0.04 : 0)
    }
    if (thrusterGlow.current) {
      thrusterGlow.current.scale.y = 1 + pulse * 0.08
    }
    if (thrusterCore.current) {
      thrusterCore.current.scale.setScalar(1 + pulse * 0.12)
    }

    if (particleGroup.current) {
      if (reducedMotion) {
        for (const particle of particles.current) {
          particle.life = 0
          const material = particle.mesh.material as THREE.MeshBasicMaterial
          material.opacity = 0
        }
      } else {
        for (const particle of particles.current) {
          if (particle.life <= 0) {
            particle.life = particle.maxLife
            particle.mesh.position.set(
              (Math.random() - 0.5) * 0.03,
              0,
              (Math.random() - 0.5) * 0.03,
            )
            particle.velocity.set(
              (Math.random() - 0.5) * 0.03,
              -0.08 - Math.random() * 0.05,
              (Math.random() - 0.5) * 0.03,
            )
            const material = particle.mesh.material as THREE.MeshBasicMaterial
            material.opacity = 0.6
            particle.mesh.scale.setScalar(1)
          } else {
            particle.life -= dt
            particle.mesh.position.addScaledVector(particle.velocity, dt)
            particle.velocity.y -= 0.08 * dt
            const ratio = Math.max(0, particle.life / particle.maxLife)
            const material = particle.mesh.material as THREE.MeshBasicMaterial
            material.opacity = ratio * 0.6
            particle.mesh.scale.setScalar(0.4 + ratio * 0.6)
          }
        }
      }
    }

    let eyeLeftX = 1
    let eyeLeftY = 1
    let eyeRightX = 1
    let eyeRightY = 1
    if (curious) {
      eyeLeftX = 1.15
      eyeLeftY = 1.18
      eyeRightX = 1
      eyeRightY = 1.06
    } else if (surprised) {
      eyeLeftX = 1.32
      eyeRightX = 1.32
      eyeLeftY = 1.4
      eyeRightY = 1.4
    } else if (thinking) {
      eyeLeftX = 1
      eyeLeftY = 0.45
      eyeRightX = 0.95
      eyeRightY = 0.8
    } else if (alert) {
      eyeLeftX = 1.15
      eyeRightX = 1.15
      eyeLeftY = 1.2
      eyeRightY = 1.2
    }

    const blink =
      reducedMotion || happy || surprised || alert
        ? 1
        : t % 4.6 > 4.44
          ? 0.12
          : 1

    if (eyeLeft.current) {
      eyeLeft.current.scale.x = damp(
        eyeLeft.current.scale.x,
        eyeLeftX,
        14,
        dt,
      )
      eyeLeft.current.scale.y = damp(
        eyeLeft.current.scale.y,
        eyeLeftY * blink,
        14,
        dt,
      )
      eyeLeft.current.visible = !happy
    }
    if (eyeRight.current) {
      eyeRight.current.scale.x = damp(
        eyeRight.current.scale.x,
        eyeRightX,
        14,
        dt,
      )
      eyeRight.current.scale.y = damp(
        eyeRight.current.scale.y,
        eyeRightY * blink,
        14,
        dt,
      )
      eyeRight.current.visible = !happy
    }
    if (arcLeft.current) arcLeft.current.visible = happy
    if (arcRight.current) arcRight.current.visible = happy

    if (mouthLine.current) {
      mouthLine.current.visible =
        currentExpression === 'idle' ||
        currentExpression === 'follow' ||
        currentExpression === 'thinking' ||
        alert
      mouthLine.current.rotation.z = damp(
        mouthLine.current.rotation.z,
        thinking ? -0.2 : 0,
        10,
        dt,
      )
    }
    if (mouthSmile.current) mouthSmile.current.visible = happy
    if (mouthOpen.current) mouthOpen.current.visible = curious || surprised

    alertMix.current = damp(alertMix.current, nearbySite ? 1 : 0, 6, dt)
    eyeMaterial.color.copy(EYE_PINK).lerp(EYE_ALERT, alertMix.current)
  })

  return (
    <group
      ref={robot}
      position={[
        WORLD.spawn.x + 1.45,
        getTerrainHeight(
          WORLD.spawn.x + 1.45,
          WORLD.spawn.z + 0.85,
        ) + 1.12,
        WORLD.spawn.z + 0.85,
      ]}
    >
      <group ref={shell}>
        <mesh castShadow scale={[1, 0.9, 0.92]}>
          <sphereGeometry args={[0.235, detail, detail - 6]} />
          <meshStandardMaterial
            color={SHELL_COLOR}
            roughness={0.55}
            metalness={0.03}
          />
        </mesh>

        <mesh position={[0, 0.005, 0.195]} scale={[1, 0.72, 0.22]}>
          <sphereGeometry args={[0.205, detail, detail - 8]} />
          <meshStandardMaterial
            color={VIOLET_COLOR}
            roughness={0.45}
            metalness={0.15}
          />
        </mesh>
        <mesh position={[0, 0.005, 0.202]} scale={[1, 0.72, 0.24]}>
          <sphereGeometry args={[0.19, detail, detail - 8]} />
          <meshStandardMaterial
            color={SCREEN_COLOR}
            roughness={0.22}
            metalness={0.25}
          />
        </mesh>

        <group ref={eyeLeft} position={[-0.082, 0.045, 0.246]}>
          <mesh material={eyeMaterial} scale={[1, 1.2, 0.5]}>
            <sphereGeometry args={[0.028, 16, 12]} />
          </mesh>
        </group>
        <group ref={eyeRight} position={[0.082, 0.045, 0.246]}>
          <mesh material={eyeMaterial} scale={[1, 1.2, 0.5]}>
            <sphereGeometry args={[0.028, 16, 12]} />
          </mesh>
        </group>

        <mesh
          ref={arcLeft}
          position={[-0.082, 0.05, 0.246]}
          scale={[1, 1, 0.6]}
          material={eyeMaterial}
          visible={false}
        >
          <torusGeometry args={[0.03, 0.006, 6, 12, Math.PI]} />
        </mesh>
        <mesh
          ref={arcRight}
          position={[0.082, 0.05, 0.246]}
          scale={[1, 1, 0.6]}
          material={eyeMaterial}
          visible={false}
        >
          <torusGeometry args={[0.03, 0.006, 6, 12, Math.PI]} />
        </mesh>

        <mesh ref={mouthLine} position={[0, -0.072, 0.243]}>
          <boxGeometry args={[0.034, 0.006, 0.005]} />
          <primitive object={eyeMaterial} attach="material" />
        </mesh>
        <mesh
          ref={mouthSmile}
          position={[0, -0.058, 0.243]}
          rotation={[0, 0, Math.PI]}
          material={eyeMaterial}
          visible={false}
        >
          <torusGeometry args={[0.025, 0.005, 6, 12, Math.PI]} />
        </mesh>
        <mesh
          ref={mouthOpen}
          position={[0, -0.07, 0.243]}
          material={eyeMaterial}
          visible={false}
        >
          <torusGeometry args={[0.012, 0.005, 6, 12]} />
        </mesh>

        <group
          ref={evaArmLeft}
          position={[-0.18, 0.02, -0.03]}
          rotation={[0, 0, 0.45]}
        >
          <mesh castShadow scale={[0.075, 0.012, 0.105]}>
            <sphereGeometry args={[0.04, 16, 12]} />
            <meshStandardMaterial
              color={SHELL_COLOR}
              roughness={0.48}
              metalness={0.05}
            />
          </mesh>
          <mesh position={[-0.055, 0, -0.06]} material={eyeMaterial}>
            <sphereGeometry args={[0.015, 10, 8]} />
          </mesh>
        </group>
        <group
          ref={evaArmRight}
          position={[0.18, 0.02, -0.03]}
          rotation={[0, 0, -0.45]}
        >
          <mesh castShadow scale={[0.075, 0.012, 0.105]}>
            <sphereGeometry args={[0.04, 16, 12]} />
            <meshStandardMaterial
              color={SHELL_COLOR}
              roughness={0.48}
              metalness={0.05}
            />
          </mesh>
          <mesh position={[0.055, 0, -0.06]} material={eyeMaterial}>
            <sphereGeometry args={[0.015, 10, 8]} />
          </mesh>
        </group>

        <group ref={antenna} position={[0.055, 0.2, -0.015]}>
          <mesh>
            <tubeGeometry args={[antennaCurve, 14, 0.007, 6, false]} />
            <meshStandardMaterial color={SHELL_COLOR} roughness={0.6} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.022, 0.006, 6, 14]} />
            <meshStandardMaterial
              color={VIOLET_COLOR}
              roughness={0.5}
              metalness={0.12}
            />
          </mesh>
          <mesh position={[0.055, 0.125, -0.006]} material={eyeMaterial}>
            <sphereGeometry args={[0.027, 16, 12]} />
          </mesh>
        </group>

        <mesh position={[0, -0.2, 0]} scale={[1, 0.62, 1]} castShadow>
          <sphereGeometry args={[0.085, 16, 12]} />
          <meshStandardMaterial
            color={VIOLET_COLOR}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>
        <mesh position={[0, -0.245, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.058, 0.045, 0.012, 20]} />
          <meshBasicMaterial color={THRUSTER_COLOR} toneMapped={false} />
        </mesh>
        <mesh ref={thrusterGlow} position={[0, -0.315, 0]}>
          <cylinderGeometry args={[0.058, 0.008, 0.13, 16, 1, true]} />
          <meshBasicMaterial
            ref={glowMaterial}
            color={THRUSTER_COLOR}
            transparent
            opacity={0.16}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={thrusterCore} position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.018, 10, 8]} />
          <meshBasicMaterial color="#FFD7A8" toneMapped={false} />
        </mesh>
        <group ref={particleGroup} position={[0, -0.245, 0]} />

        <group position={[0, 0.015, -0.212]}>
          <mesh>
            <boxGeometry args={[0.13, 0.032, 0.012]} />
            <meshStandardMaterial
              color={SCREEN_COLOR}
              roughness={0.4}
              metalness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.023, 0]}>
            <boxGeometry args={[0.115, 0.005, 0.008]} />
            <meshStandardMaterial color={ORANGE_COLOR} roughness={0.5} />
          </mesh>
        </group>

        <group
          position={[0, -0.155, 0.165]}
          rotation={[-0.55, 0, 0]}
        >
          <mesh>
            <boxGeometry args={[0.062, 0.042, 0.006]} />
            <meshStandardMaterial color={ORANGE_COLOR} roughness={0.55} />
          </mesh>
          <mesh position={[-0.016, 0.004, 0.004]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.032, 0.004, 0.003]} />
            <meshBasicMaterial color={SHELL_COLOR} toneMapped={false} />
          </mesh>
          <mesh position={[0.016, 0.004, 0.004]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.032, 0.004, 0.003]} />
            <meshBasicMaterial color={SHELL_COLOR} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
