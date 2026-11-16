import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { MARS_WORLD_SITES, REGION_APPROACH_RADIUS } from '../data/marsObjects'
import {
  SPIRIT_SITE,
  findScanAnchor,
  getActiveExplorer,
  getScanAnchors,
  getScanStationView,
} from '../data/spiritSite'
import { getMessageFlight, getPartShot, getSendFilmFrame, pickPipSpot, type SpotCheck } from './explorerShots'
import { getEarthDirection } from './earthDirection'
import { useJourneyStore } from '../store/journeyStore'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { BRIEFING_STEPS } from '../data/marsBriefing'
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
import { CALIBRATION_SAMPLE } from '../data/calibrationSample'
import { getGuideLane, getGuideMode, projectOnLane } from './practiceGuide'
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
    case 'hopeful':
      return 'happy'
    case 'excited':
    case 'celebrating':
      return 'excited'
    case 'thinking':
      return 'thoughtful'
    case 'focused':
      return 'analyzing'
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
const otherWorld = new THREE.Vector3()

/**
 * World box around the explorer's visible body (the model a part belongs
 * to), leaving out hit boxes, glows, markers and anything the scanner
 * ignores.
 */
const meshCenter = new THREE.Vector3()

/**
 * The visible meshes near a part that could hide PIP: the explorer's own
 * pieces and the rocks around it (scanner roots are tagged; the part's
 * hit target lives elsewhere in the scene, so search from the top).
 */
function meshesNear(part: THREE.Object3D, at: THREE.Vector3, radius = 8): THREE.Mesh[] {
  let top: THREE.Object3D = part
  while (top.parent) top = top.parent
  const meshes: THREE.Mesh[] = []
  top.traverse((root) => {
    if (!root.userData?.scannerRoot) return
    root.updateMatrixWorld(true)
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.visible) return
      for (let node: THREE.Object3D | null = object; node; node = node.parent) {
        if (!node.visible || node.userData?.scannerIgnore) return
      }
      const geometry = object.geometry as THREE.BufferGeometry
      if (!geometry.boundingSphere) geometry.computeBoundingSphere()
      const sphere = geometry.boundingSphere
      if (!sphere) return
      meshCenter.copy(sphere.center).applyMatrix4(object.matrixWorld)
      if (meshCenter.distanceTo(at) > radius + sphere.radius * object.matrixWorld.getMaxScaleOnAxis()) return
      meshes.push(object)
    })
  })
  return meshes
}

const spotRay = new THREE.Raycaster()
const spotFrom = new THREE.Vector3()
const spotTo = new THREE.Vector3()
const spotDir = new THREE.Vector3()
/** PIP's half size, for testing his edges. */
const PIP_HALF = 0.3

/**
 * How much of PIP at `spot` is visible from `camera`: the share of his
 * centre and four edges with a clear line to the lens and nothing just
 * behind them (which would mean he is inside a piece of the machine).
 */
function pipInView(camera: THREE.Vector3, meshes: THREE.Mesh[]): SpotCheck {
  return (spot, right, up) => {
    const offsets: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    let seen = 0
    for (const [r, u] of offsets) {
      spotTo.set(
        spot.x + (right.x * r + up.x * u) * PIP_HALF,
        spot.y + (right.y * r + up.y * u) * PIP_HALF,
        spot.z + (right.z * r + up.z * u) * PIP_HALF,
      )
      spotFrom.copy(camera)
      spotDir.subVectors(spotTo, spotFrom)
      const far = spotDir.length() + PIP_HALF
      spotRay.set(spotFrom, spotDir.normalize())
      spotRay.near = 0
      spotRay.far = far
      if (spotRay.intersectObjects(meshes, false).length === 0) seen += 1
    }
    return seen / offsets.length
  }
}

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
  // Gestures: a happy spin on each find, a curious look-around when idle.
  const lastReactionUntil = useRef(0)
  const spinStart = useRef(-10)
  const spinTurns = useRef(1)
  const nextLookAround = useRef(9)
  const lookAroundStart = useRef(-10)
  // Scan station: PIP flies next to the part to find and peeks at it.
  const partWorld = useRef(new THREE.Vector3())
  const partTarget = useRef<THREE.Object3D | null>(null)
  const otherParts = useRef(new Map<string, THREE.Object3D>())
  const filmBoxKey = useRef(0)
  const orb = useRef<THREE.Group>(null)
  const orbLaunched = useRef(false)
  const orbFrom = useRef(new THREE.Vector3())
  const filmSpot = useRef(new THREE.Vector3())

  const quality = useGameStore((state) => state.quality)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [hubExpression, setHubExpression] =
    useState<HubPipExpression>('neutral')
  const [talking, setTalking] = useState(false)
  const spokenRef = useRef(false)

  useFrame((state, delta) => {
    const player = playerRef.current
    const current = robot.current
    const shell = body.current
    if (!player || !current || !shell) return
    if (isWorldPaused()) {
      if (orb.current) orb.current.visible = false
      return
    }

    const dt = Math.min(delta, 0.05)
    const game = useGameStore.getState()
    const narrative = useNarrativeStore.getState()
    const nearbyId = game.nearbySiteId
    const nearbySite = nearbyId
      ? (MARS_WORLD_SITES.find((site) => site.id === nearbyId) ?? null)
      : null
    // Region approach: nearest site inside the approach radius, even when the
    // player is not yet inside the small inspect ring — PIP leans in early.
    let regionSite = nearbySite
    if (!regionSite) {
      let best = Infinity
      for (const site of MARS_WORLD_SITES) {
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
    // The explorer lives outside MARS_WORLD_SITES; give PIP the same awareness and a
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
            ...MARS_WORLD_SITES.map((site) => site.position),
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

    // --- Scan station: show the child where the next part is ---
    // PIP hovers beside the part (never in front of it), a bit closer to the
    // camera, and looks at it with a curious face. After each find it moves
    // on to the next part.
    let pointingPart: THREE.Vector3 | null = null
    // Flying into a part close-up: quick, so PIP is there for the shot.
    let filmFlight = false
    // Send film: PIP looks at the camera; the message leaves at launch > 0.
    let faceCamera = false
    let sendLaunch = -1
    const guideMode = getGuideMode()
    if (guideMode === 'walk') {
      // Guided first walk: PIP flies a few steps ahead down the lane, so
      // the child just follows it to the practice rock.
      const { start, end } = getGuideLane()
      const laneLength = Math.hypot(end.x - start.x, end.z - start.z) || 1
      const along = projectOnLane(player.position.x, player.position.z, partWorld.current)
      const k = Math.min(1, along + 2.6 / laneLength)
      const dirX = (end.x - start.x) / laneLength
      const dirZ = (end.z - start.z) / laneLength
      const gx = start.x + (end.x - start.x) * k - dirZ * 0.9
      const gz = start.z + (end.z - start.z) * k + dirX * 0.9
      goal.current.set(gx, getTerrainHeight(gx, gz) + 1.5, gz)
    }
    if (
      guideMode === 'arrive' ||
      (game.scanStation && game.scanStationTarget === 'practice')
    ) {
      // Practice station: PIP floats beside the rock and points at it.
      const rock = partWorld.current.set(
        CALIBRATION_SAMPLE.position.x,
        getTerrainHeight(CALIBRATION_SAMPLE.position.x, CALIBRATION_SAMPLE.position.z) + 0.6,
        CALIBRATION_SAMPLE.position.z,
      )
      let vx = rock.x - player.position.x
      let vz = rock.z - player.position.z
      const vl = Math.hypot(vx, vz) || 1
      vx /= vl
      vz /= vl
      goal.current.set(rock.x - vz * 1.4 - vx * 0.4, rock.y + 0.5, rock.z + vx * 1.4 - vz * 0.4)
      pointingPart = rock
      partTarget.current = null
    } else if (game.cinematicFocus?.kind === 'send') {
      // Before sending the story home: PIP floats in front of the explorer
      // with the glowing message, facing the camera.
      const film = game.cinematicFocus
      const frame = getSendFilmFrame(
        (Date.now() - film.startedAt) / Math.max(1, film.until - film.startedAt),
        getActiveExplorer(),
        SPIRIT_SITE.position,
        getScanStationView().direction,
        getEarthDirection(),
        getTerrainHeight,
      )
      goal.current.set(frame.pip.x, frame.pip.y, frame.pip.z)
      sendLaunch = frame.launch
      filmFlight = true
      faceCamera = true
      partTarget.current = null
    } else if (
      game.cinematicFocus?.kind === 'part' &&
      game.cinematicFocus.componentId
    ) {
      // Part close-up: PIP flies in beside the part just found, in the
      // camera's picture, and tells its story looking at the child.
      const film = game.cinematicFocus
      const aspect = (state.camera as THREE.PerspectiveCamera).aspect ?? 16 / 9
      const name = `ScannerTarget_${film.componentId}`
      if (partTarget.current?.name !== name || !partTarget.current.parent) {
        let root: THREE.Object3D = current
        while (root.parent) root = root.parent
        partTarget.current = root.getObjectByName(name) ?? null
      }
      if (partTarget.current) {
        const part = partTarget.current.getWorldPosition(partWorld.current)
        const anchor = findScanAnchor(film.componentId!)
        // Chosen once per close-up, from the middle of the shot: PIP floats
        // where the camera sees all of him, never inside the machine nor
        // behind a wheel.
        if (filmBoxKey.current !== film.startedAt) {
          filmBoxKey.current = film.startedAt
          // The camera glides through the shot: PIP must stay in view
          // from its start, middle and end.
          const lenses = [0.1, 0.5, 0.9].map((progress) => {
            const at = getPartShot(
              progress,
              part,
              SPIRIT_SITE.position,
              getScanStationView().direction,
              anchor ? Math.max(...anchor.hitSize) : 0.8,
              getTerrainHeight,
              aspect,
            ).position
            return new THREE.Vector3(at.x, at.y, at.z)
          })
          const near = meshesNear(partTarget.current, partWorld.current)
          const checks = lenses.map((lens) => pipInView(lens, near))
          const spot = pickPipSpot(
            lenses[1],
            part,
            (at, right, up) =>
              // Never in the ground: his body hangs about half a metre.
              at.y < getTerrainHeight(at.x, at.z) + 0.5
                ? 0
                : Math.min(...checks.map((check) => check(at, right, up))),
            aspect,
          )
          filmSpot.current.set(spot.x, spot.y, spot.z)
        }
        goal.current.copy(filmSpot.current)
        pointingPart = part
        filmFlight = true
      }
    } else if (game.scanStation) {
      const scanned =
        useJourneyStore.getState().save?.missions[SPIRIT_SITE.missionId]
          ?.scannedComponentIds ?? []
      const next = getScanAnchors().find(
        (anchor) => !scanned.includes(anchor.componentId),
      )
      const name = next ? `ScannerTarget_${next.componentId}` : null
      if (name && partTarget.current?.name !== name) {
        let root: THREE.Object3D = current
        while (root.parent) root = root.parent
        partTarget.current = root.getObjectByName(name) ?? null
      }
      if (next && partTarget.current) {
        const part = partTarget.current.getWorldPosition(partWorld.current)
        // View direction from the player (station camera) to the part.
        let vx = part.x - player.position.x
        let vz = part.z - player.position.z
        const vl = Math.hypot(vx, vz) || 1
        vx /= vl
        vz /= vl
        const sideX = -vz
        const sideZ = vx
        // Beside the part, on the side with the most room: away from the
        // other parts (parts sit close together, and PIP must never cover
        // the one the child should scan or its neighbours), else on the
        // outer side of the explorer.
        const outward =
          (part.x - SPIRIT_SITE.position.x) * sideX +
          (part.z - SPIRIT_SITE.position.z) * sideZ
        let others = 0
        for (const anchor of getScanAnchors()) {
          if (anchor.componentId === next.componentId) continue
          let node = otherParts.current.get(anchor.componentId)
          if (!node?.parent) {
            let root: THREE.Object3D = current
            while (root.parent) root = root.parent
            node = root.getObjectByName(`ScannerTarget_${anchor.componentId}`) ?? undefined
            if (node) otherParts.current.set(anchor.componentId, node)
          }
          if (!node) continue
          node.getWorldPosition(otherWorld)
          // Which side of the line of sight this neighbour is on.
          others += Math.sign((otherWorld.x - part.x) * sideX + (otherWorld.z - part.z) * sideZ)
        }
        const sign = others !== 0 ? -Math.sign(others) : outward < -0.05 ? -1 : 1
        goal.current.set(
          part.x + sideX * 1.05 * sign - vx * 0.3,
          part.y + 0.42,
          part.z + sideZ * 1.05 * sign - vz * 0.3,
        )
        pointingPart = part
      }
    } else {
      partTarget.current = null
    }

    // --- Obstacle avoidance ---
    const siteCylinders = [
      ...MARS_WORLD_SITES.map((site) => ({
        x: site.position.x,
        z: site.position.z,
        radius: SITE_COLLISION_RADII[site.id] + 0.5,
      })),
      // Pointing at a part, PIP may hover right beside the explorer.
      ...(pointingPart
        ? []
        : [
            {
              x: SPIRIT_SITE.position.x,
              z: SPIRIT_SITE.position.z,
              radius: SPIRIT_SITE.collisionRadius + 0.5,
            },
          ]),
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
    const followSpeed = filmFlight ? 6 : distance > 5 ? 7 : distance > 2 ? 5 : 3.5
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

    // The glowing message of the send film: above PIP's head while he
    // talks, then up into the sky towards Earth.
    const orbNode = orb.current
    if (orbNode) {
      if (sendLaunch < 0) {
        orbNode.visible = false
        orbLaunched.current = false
      } else {
        orbNode.visible = true
        if (sendLaunch <= 0) {
          orbNode.position.set(
            current.position.x,
            current.position.y + 0.58 + Math.sin(t * 3) * 0.04,
            current.position.z,
          )
          orbLaunched.current = false
        } else {
          if (!orbLaunched.current) {
            orbLaunched.current = true
            orbFrom.current.copy(orbNode.position)
          }
          const at = getMessageFlight(orbFrom.current, getEarthDirection(), sendLaunch)
          orbNode.position.set(at.x, at.y, at.z)
        }
        orbNode.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(t * 6) * 0.08)
      }
    }

    let targetX = player.position.x
    let targetZ = player.position.z
    // At the scan station PIP looks at the child while talking and, every
    // few seconds, turns to point at the part ("here, here!"). When quiet it
    // keeps peeking at the part.
    const pointingGlance =
      pointingPart != null && (!speaking || t % 4.6 > 3.1)
    if (faceCamera) {
      targetX = state.camera.position.x
      targetZ = state.camera.position.z
    } else if (pointingPart && !(reactionActive && reaction?.kind === 'celebrate')) {
      if (pointingGlance) {
        targetX = pointingPart.x
        targetZ = pointingPart.z
      } else {
        targetX = state.camera.position.x
        targetZ = state.camera.position.z
      }
    } else if (reactionActive && reactionTarget) {
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

    // A new find or the big celebration: PIP does a joyful spin.
    if (reaction && reaction.until !== lastReactionUntil.current) {
      lastReactionUntil.current = reaction.until
      if (reaction.kind === 'scan' || reaction.kind === 'celebrate') {
        spinStart.current = t
        spinTurns.current = reaction.kind === 'celebrate' ? 2 : 1
      }
    }
    // Idle and quiet: every so often PIP peeks left, then right.
    const idleNow =
      !reducedMotion && !speaking && !reactionActive && motion < 0.05 &&
      !scannerAimTarget && !pointingPart
    if (idleNow && t > nextLookAround.current) {
      lookAroundStart.current = t
      nextLookAround.current = t + 11 + Math.random() * 6
    }
    const lookAroundT = t - lookAroundStart.current
    const lookAround =
      idleNow && lookAroundT < 2.6
        ? Math.sin((lookAroundT / 2.6) * Math.PI * 2) * 0.75
        : 0
    const idleLook =
      (reducedMotion ? 0 : Math.sin(t * 0.55) * 0.12) + lookAround
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

      // The arrival briefing acts out each of PIP's tutorial lines.
      const briefingId = useGameStore.getState().marsBriefingStep
      const briefing = briefingId
        ? BRIEFING_STEPS.find((step) => step.id === briefingId)
        : undefined
      if (briefing) {
        expression.current = briefing.expression
      } else if (
        pointingGlance &&
        !(reactionActive && (reaction?.kind === 'scan' || reaction?.kind === 'celebrate'))
      ) {
        expression.current = 'curious'
      } else if (reactionActive && reaction) {
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
    const spinT = (t - spinStart.current) / (0.75 * spinTurns.current)
    const spinning = !reducedMotion && spinT >= 0 && spinT < 1
    const hop = spinning ? Math.sin(spinT * Math.PI) * 0.09 : 0
    shell.position.y = damp(shell.position.y, bob + bounce + pop + hop, 10, dt)
    shell.rotation.y = spinning
      ? (1 - (1 - spinT) ** 3) * Math.PI * 2 * spinTurns.current
      : 0

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
      // Peeking: lean in toward the part the child is aiming at.
      if ((scannerAimTarget && !speaking) || pointingGlance) tiltX += 0.16
      // Curious little bob toward the part, as if saying "here, here!".
      if (pointingGlance) tiltZ += Math.sin(t * 2.4) * 0.08
      // Talking: a little lively wobble.
      if (speaking) tiltZ += Math.sin(t * 9) * 0.035
      tiltZ += THREE.MathUtils.clamp(-yawRate.current * 0.05, -0.32, 0.32)
      tiltX += THREE.MathUtils.clamp(lastVel.current.y * 0.04, -0.16, 0.2)
    }
    shell.rotation.x = damp(shell.rotation.x, tiltX, 8, dt)
    shell.rotation.z = damp(shell.rotation.z, tiltZ, 8, dt)
  })

  return (
    <>
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
      {talking && (
        <Html position={[0.22, 0.62, 0]} center zIndexRange={[5, 0]} pointerEvents="none">
          <span className="pip-talk-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </Html>
      )}
    </group>
    <group ref={orb} visible={false} userData={{ scannerIgnore: true }}>
      <mesh raycast={() => {}}>
        <sphereGeometry args={[0.085, 20, 16]} />
        <meshBasicMaterial color="#fff6e2" toneMapped={false} />
      </mesh>
      <mesh raycast={() => {}}>
        <sphereGeometry args={[0.22, 20, 16]} />
        <meshBasicMaterial
          color="#ffc98a"
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
    </>
  )
}
