import { useFrame } from '@react-three/fiber'
import { useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS, REGION_APPROACH_RADIUS } from '../data/marsObjects'
import { SPIRIT_SITE } from '../data/spiritSite'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { SITE_COLLISION_RADII } from './interaction'
import { HubPip, type HubPipExpression } from './HubPipModel'
import { scannerAim } from './scannerAim'
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

type Expression =
  | 'idle'
  | 'follow'
  | 'curious'
  | 'happy'
  | 'thinking'
  | 'alert'
  | 'surprised'
  | 'excited'
  | 'concerned'
  | 'focused'
  | 'hopeful'
  | 'celebrating'

/**
 * Maps the game's behavioural state to the official Blender PIP expression
 * set. The GLB owns the face; this function only chooses the authored row.
 */
function pipExpressionFor(expression: Expression): HubPipExpression {
  switch (expression) {
    case 'curious':
      return 'curious'
    case 'happy':
    case 'excited':
    case 'celebrating':
    case 'hopeful':
      return 'happy'
    case 'thinking':
    case 'focused':
      return 'thoughtful'
    case 'alert':
    case 'concerned':
      return 'worried'
    case 'surprised':
      return 'surprised'
    case 'follow':
    case 'idle':
    default:
      return 'neutral'
  }
}

const PIP_WORLD_SCALE = 0.55

const damp = THREE.MathUtils.damp

/**
 * Official Blender-authored PIP as the Mars companion. All movement, look
 * targets, obstacle avoidance and scanner awareness remain in this
 * controller; the visual body, face, antenna, scarf and thruster come from
 * `pip-retro-space-post.glb`.
 */
export function Companion({
  playerRef,
  motionRef,
}: {
  playerRef: RefObject<THREE.Group | null>
  motionRef: RefObject<number>
}) {
  const robot = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)

  const goal = useRef(new THREE.Vector3())
  const time = useRef(0)
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

  const quality = useGameStore((state) => state.quality)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [hubExpression, setHubExpression] =
    useState<HubPipExpression>('neutral')
  const [talking, setTalking] = useState(false)
  const spokenRef = useRef(false)

  useFrame((_, delta) => {
    const player = playerRef.current
    const current = robot.current
    const shell = body.current
    if (!player || !current || !shell || isWorldPaused()) return

    const dt = Math.min(delta, 0.05)
    const game = useGameStore.getState()
    const narrative = useNarrativeStore.getState()
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
        const d = Math.hypot(
          player.position.x - site.position.x,
          player.position.z - site.position.z,
        )
        if (d <= REGION_APPROACH_RADIUS && d < best) {
          best = d
          regionSite = site
        }
      }
    }
    // Spirit lives outside MARS_OBJECTS; give PIP the same awareness and a
    // physical no-fly cylinder so it never passes through the rover.
    const spiritDistance = Math.hypot(
      player.position.x - SPIRIT_SITE.position.x,
      player.position.z - SPIRIT_SITE.position.z,
    )
    const nearSpirit = spiritDistance <= SPIRIT_SITE.ringRadius + 8
    const reaction = narrative.reaction
    const reactionActive = Boolean(reaction && Date.now() < reaction.until)
    let reactionTarget: { x: number; z: number } | null = null
    if (reactionActive && reaction) {
      if (reaction.kind === 'scan' && scannerAim.valid) {
        reactionTarget = { x: scannerAim.x, z: scannerAim.z }
      } else if (
        reaction.kind === 'hint' ||
        reaction.kind === 'detect' ||
        reaction.kind === 'approach' ||
        reaction.kind === 'celebrate'
      ) {
        reactionTarget = SPIRIT_SITE.position
      }
    }
    const scannerAimTarget =
      game.scannerEquipped && scannerAim.valid
        ? { x: scannerAim.x, z: scannerAim.z }
        : null
    const motion = motionRef.current

    if (!reducedMotion) time.current += dt
    const t = time.current

    // --- Idle observation pauses (irregular, varied, only when still) ---
    if (!reducedMotion) {
      if (lookingRef.current && (t > lookUntil.current || motion > 0.12)) {
        lookingRef.current = false
        nextLookAt.current = t + randomLookInterval(Math.random)
      } else if (
        !lookingRef.current &&
        motion < 0.05 &&
        t > nextLookAt.current
      ) {
        // The unknown signal is a legitimate point of curiosity too.
        lookTarget.current = pickLookTarget(
          { x: player.position.x, z: player.position.z },
          [
            ...MARS_OBJECTS.map((site) => site.position),
            SPIRIT_SITE.position,
          ],
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
      forward.x +=
        (playerDx / (Math.hypot(playerDx, playerDz) || 1) - forward.x) * blend
      forward.z +=
        (playerDz / (Math.hypot(playerDx, playerDz) || 1) - forward.z) * blend
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
    // While speaking, PIP flies to a front-left spot and faces the player —
    // except with the scanner out, where staying at the side keeps the
    // reticle and the target unobstructed.
    const speaking = Boolean(game.pipMessage || narrative.current)
    if (speaking && !game.scannerEquipped) {
      goal.current.x =
        player.position.x + forward.x * 1.55 + lateralX * -1.15
      goal.current.z =
        player.position.z + forward.z * 1.55 + lateralZ * -1.15
      goal.current.y = Math.max(goal.current.y, player.position.y + 1.05)
    }
    // While the astronaut floats on Mars air, PIP climbs to hover beside them.
    const playerAbove =
      player.position.y -
      getTerrainHeight(player.position.x, player.position.z)
    if (playerAbove > 0.6) {
      goal.current.y = Math.max(goal.current.y, player.position.y + 0.15)
    }
    if (looking && !speaking) {
      // Drift slightly out and up while observing, then settle back.
      goal.current.x += lateralX * 0.35
      goal.current.z += lateralZ * 0.35
      goal.current.y += 0.3
    }
    if (scannerAimTarget && !speaking) {
      // Lean a little toward the inspected part, then let obstacle
      // avoidance below keep a safe distance from the rover.
      const aimX = scannerAimTarget.x - goal.current.x
      const aimZ = scannerAimTarget.z - goal.current.z
      const aimLength = Math.hypot(aimX, aimZ) || 1
      goal.current.x += (aimX / aimLength) * 0.35
      goal.current.z += (aimZ / aimLength) * 0.35
    }

    // --- Obstacle avoidance ---
    const siteCylinders = [
      ...MARS_OBJECTS.map((site) => ({
        x: site.position.x,
        z: site.position.z,
        radius: SITE_COLLISION_RADII[site.id] + 0.5,
      })),
      {
        x: SPIRIT_SITE.position.x,
        z: SPIRIT_SITE.position.z,
        radius: SPIRIT_SITE.collisionRadius + 0.5,
      },
    ]
    const avoided = pushOutOfCylinders(
      { x: goal.current.x, z: goal.current.z },
      siteCylinders,
    )
    goal.current.x = avoided.x
    goal.current.z = avoided.z
    const playerBubble = pushOutOfCylinders(
      { x: goal.current.x, z: goal.current.z },
      [
        {
          x: player.position.x,
          z: player.position.z,
          radius: PIP_MIN_PLAYER_DISTANCE,
        },
      ],
    )
    goal.current.x = playerBubble.x
    goal.current.z = playerBubble.z
    for (const boulder of getBoulderObstacles(
      quality === 'low' ? 64 : 150,
    )) {
      const horizontal = Math.hypot(
        goal.current.x - boulder.x,
        goal.current.z - boulder.z,
      )
      if (
        horizontal < boulder.radius + 0.45 &&
        goal.current.y < boulder.topY + 0.4
      ) {
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
    if (reactionActive && reactionTarget) {
      targetX = reactionTarget.x
      targetZ = reactionTarget.z
    } else if (speaking) {
      targetX = player.position.x
      targetZ = player.position.z
    } else if (scannerAimTarget) {
      targetX = scannerAimTarget.x
      targetZ = scannerAimTarget.z
    } else if (looking) {
      targetX = lookTarget.current.x
      targetZ = lookTarget.current.z
    } else if (nearbySite) {
      targetX = nearbySite.position.x
      targetZ = nearbySite.position.z
    } else if (regionSite) {
      targetX = regionSite.position.x
      targetZ = regionSite.position.z
    } else if (nearSpirit) {
      targetX = SPIRIT_SITE.position.x
      targetZ = SPIRIT_SITE.position.z
    } else if (motion > 0.12) {
      targetX = current.position.x - Math.sin(player.rotation.y)
      targetZ = current.position.z - Math.cos(player.rotation.y)
    }

    const idleLook = reducedMotion ? 0 : Math.sin(t * 0.55) * 0.12
    const yaw =
      Math.atan2(targetX - current.position.x, targetZ - current.position.z) +
      idleLook
    const difference = Math.atan2(
      Math.sin(yaw - current.rotation.y),
      Math.cos(yaw - current.rotation.y),
    )
    current.rotation.y += difference * (1 - Math.exp(-6 * dt))
    if (dt > 0) {
      yawRate.current +=
        (difference / dt - yawRate.current) * (1 - Math.exp(-6 * dt))
    }

    // --- Expression selection ---
    if (!reducedMotion) {
      if (nearbyId !== lastNearby.current) {
        lastNearby.current = nearbyId
        if (nearbyId) surpriseUntil.current = t + 0.75
      }

      if (reactionActive && reaction) {
        if (reaction.kind === 'detect') {
          expression.current = 'surprised'
        } else if (
          reaction.kind === 'approach' ||
          reaction.kind === 'hint'
        ) {
          expression.current = 'curious'
        } else {
          expression.current = 'happy'
        }
      } else if (t < surpriseUntil.current) {
        expression.current = 'surprised'
      } else if (speaking) {
        expression.current = 'happy'
      } else if (nearbySite) {
        expression.current = motion > 0.12 ? 'alert' : 'curious'
      } else if (nearSpirit) {
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
      expression.current = reactionActive
        ? reaction?.kind === 'detect'
          ? 'surprised'
          : reaction?.kind === 'approach' || reaction?.kind === 'hint'
            ? 'curious'
            : 'happy'
        : nearSpirit
          ? 'curious'
          : nearbySite
            ? 'alert'
            : regionSite
              ? 'curious'
              : 'idle'
    }

    const currentExpression = expression.current as Expression
    const nextHubExpression = pipExpressionFor(currentExpression)
    if (nextHubExpression !== hubExpression) {
      setHubExpression(nextHubExpression)
    }
    if (speaking !== spokenRef.current) {
      spokenRef.current = speaking
      setTalking(speaking)
    }

    // --- Gentle floating, tilt and banking for the GLB body ---
    const happy =
      currentExpression === 'happy' ||
      currentExpression === 'celebrating' ||
      currentExpression === 'excited'
    const surprised = currentExpression === 'surprised'
    const curious = currentExpression === 'curious'
    const thinking =
      currentExpression === 'thinking' || currentExpression === 'focused'
    const alert =
      currentExpression === 'alert' || currentExpression === 'concerned'

    const bob = reducedMotion ? 0 : Math.sin(t * 2.3) * 0.032
    const bounce =
      happy && !reducedMotion
        ? Math.max(0, Math.sin(t * 8)) *
          (currentExpression === 'celebrating' ? 0.06 : 0.035)
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
    shell.position.y = damp(shell.position.y, bob + bounce + pop, 10, dt)

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
      tiltZ += THREE.MathUtils.clamp(-yawRate.current * 0.05, -0.32, 0.32)
      tiltX += THREE.MathUtils.clamp(lastVel.current.y * 0.04, -0.16, 0.2)
    }
    shell.rotation.x = damp(shell.rotation.x, tiltX, 8, dt)
    shell.rotation.z = damp(shell.rotation.z, tiltZ, 8, dt)
  })

  return (
    <group
      ref={robot}
      userData={{ scannerIgnore: true }}
      position={[
        WORLD.spawn.x + 1.45,
        getTerrainHeight(WORLD.spawn.x + 1.45, WORLD.spawn.z + 0.85) + 1.12,
        WORLD.spawn.z + 0.85,
      ]}
    >
      <group ref={body}>
        <HubPip
          expression={hubExpression}
          talking={talking}
          reducedMotion={reducedMotion}
          antennaAmplitude={0.06}
          scale={PIP_WORLD_SCALE}
        />
      </group>
    </group>
  )
}
