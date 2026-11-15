import type { ExplorerId } from '../data/spiritSite'

/**
 * The identification moment (the child presses E at the explorer) as a
 * short film: three camera shots that take time to show the machine up
 * close, while PIP tells who it is. Pure geometry: Player.tsx applies the
 * result to the camera.
 *
 * 1. Reveal: a wide 3/4 view that slowly pushes in.
 * 2. Close-up: near and a little above, drifting around the top parts.
 * 3. Hero: low to the ground, looking up at the explorer.
 *
 * Shots are relative to the explorer's best side (its scan station view)
 * and scaled to its size (the Apollo descent stage is far larger than the
 * rover).
 */

interface ShotSpec {
  /** Shot ends at this share of the whole sequence. */
  until: number
  /** Angle (radians) around the explorer from its best side, start → end. */
  angle: readonly [number, number]
  /** Distance in explorer sizes, start → end. */
  distance: readonly [number, number]
  /** Camera and look heights in explorer heights. */
  cameraHeight: readonly [number, number]
  lookHeight: number
}

export const EXPLORER_SHOTS: readonly ShotSpec[] = [
  { until: 0.34, angle: [-0.75, -0.55], distance: [3.3, 2.7], cameraHeight: [0.6, 0.55], lookHeight: 0.5 },
  { until: 0.68, angle: [0.3, 0.55], distance: [1.75, 1.55], cameraHeight: [1.08, 1.0], lookHeight: 0.78 },
  { until: 1, angle: [1.5, 1.25], distance: [2.5, 2.3], cameraHeight: [0.2, 0.24], lookHeight: 0.62 },
]

/** Footprint radius and height (m) used to size the shots. */
const EXPLORER_SIZE: Readonly<Record<ExplorerId, { size: number; height: number }>> = {
  opportunity: { size: 1.6, height: 1.7 },
  spirit: { size: 1.6, height: 1.7 },
  'viking-1': { size: 2.0, height: 1.8 },
  'surveyor-3': { size: 2.2, height: 2.4 },
  'apollo-11': { size: 4.0, height: 3.2 },
}

/** Lowest the camera goes above the ground (m). */
const MIN_CLEARANCE = 0.35

export interface ShotFrame {
  shot: number
  position: { x: number; y: number; z: number }
  look: { x: number; y: number; z: number }
}

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

function mix(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t
}

/**
 * Camera at `progress` (0..1) of the identification sequence.
 * `bestSide` is the world direction from the explorer to its best view;
 * `groundAt` gives the terrain height so low shots never dip under it.
 */
export function getExplorerShot(
  progress: number,
  explorer: ExplorerId,
  center: { x: number; z: number },
  bestSide: { x: number; z: number },
  groundAt: (x: number, z: number) => number,
): ShotFrame {
  const p = Math.min(1, Math.max(0, progress))
  const shot = Math.max(0, EXPLORER_SHOTS.findIndex((entry) => p <= entry.until))
  const spec = EXPLORER_SHOTS[shot]!
  const from = shot === 0 ? 0 : EXPLORER_SHOTS[shot - 1]!.until
  const t = smooth((p - from) / Math.max(1e-6, spec.until - from))
  const { size, height } = EXPLORER_SIZE[explorer]
  const base = Math.atan2(bestSide.z, bestSide.x)
  const angle = base + mix(spec.angle, t)
  const distance = mix(spec.distance, t) * size
  const x = center.x + Math.cos(angle) * distance
  const z = center.z + Math.sin(angle) * distance
  const ground = groundAt(x, z)
  const centerGround = groundAt(center.x, center.z)
  return {
    shot,
    position: {
      x,
      y: Math.max(ground + MIN_CLEARANCE, centerGround + mix(spec.cameraHeight, t) * height),
      z,
    },
    look: { x: center.x, y: centerGround + spec.lookHeight * height, z: center.z },
  }
}

/**
 * A part just scanned, as a short close-up while PIP explains it: the
 * camera comes in from the explorer's best side (where the child stood),
 * slightly off the part's own direction, and drifts slowly around it. PIP
 * hovers beside the part, in frame (see getPipBesidePart).
 */
export function getPartShot(
  progress: number,
  part: { x: number; y: number; z: number },
  center: { x: number; z: number },
  bestSide: { x: number; z: number },
  partSize: number,
  groundAt: (x: number, z: number) => number,
  /** Screen width / height: a narrow phone screen needs a wider shot. */
  aspect = 16 / 9,
): ShotFrame {
  const t = smooth(progress)
  const narrow = aspect < 1
  // Between "facing the child's side" and "facing out from the explorer".
  let ox = part.x - center.x
  let oz = part.z - center.z
  const ol = Math.hypot(ox, oz)
  if (ol > 1e-3) {
    ox /= ol
    oz /= ol
  }
  let dx = bestSide.x + ox * 0.6
  let dz = bestSide.z + oz * 0.6
  const dl = Math.hypot(dx, dz) || 1
  dx /= dl
  dz /= dl
  const angle = Math.atan2(dz, dx) + mix([-0.28, 0.22], t)
  const size = Math.min(1.2, Math.max(0.5, partSize))
  const distance = (mix([1.95, 1.4], t) * size + 0.35) * (narrow ? 1.65 : 1)
  const x = part.x + Math.cos(angle) * distance
  const z = part.z + Math.sin(angle) * distance
  const y = Math.max(groundAt(x, z) + MIN_CLEARANCE, part.y + mix([0.42, 0.24], t) * size)
  return { shot: 0, position: { x, y, z }, look: { x: part.x, y: part.y, z: part.z } }
}

/**
 * Where PIP hovers in a part close-up: between the camera and the part,
 * off to one side, so both PIP and the part are in the picture.
 */
export function getPipBesidePart(
  camera: { x: number; y: number; z: number },
  part: { x: number; y: number; z: number },
  aspect = 16 / 9,
): { x: number; y: number; z: number } {
  const vx = camera.x - part.x
  const vz = camera.z - part.z
  const vl = Math.hypot(vx, vz) || 1
  // Screen-left of the part as the camera sees it.
  const sideX = vz / vl
  const sideZ = -vx / vl
  // Nearly level with the part and a step to its side, so PIP is in the
  // shot at a friendly size and never in front of the part.
  // On a narrow (phone) screen there is no room at the side: PIP floats
  // a little behind the part and above it, so he looks smaller and sits
  // in the top of the picture.
  const narrow = aspect < 1
  const near = narrow ? -0.75 : -0.25
  const side = narrow ? 0.32 : 0.78
  return {
    x: part.x + (vx / vl) * near + sideX * side,
    y: part.y + (narrow ? 0.5 : 0.18),
    z: part.z + (vz / vl) * near + sideZ * side,
  }
}

/**
 * How much of PIP, floating at `spot`, the camera would see: 1 when all of
 * him, 0 when none (the scene raycasts the real meshes). `right` and `up`
 * are the picture's own axes, to test his edges as well as his centre.
 */
export type SpotCheck = (
  spot: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
  up: { x: number; y: number; z: number },
) => number

/** Closest PIP may float to the lens and still look his own size. */
const PIP_NEAREST = 1.7
/** PIP's own width, in metres. */
const PIP_SIZE = 0.6
/** The game camera's vertical field of view (CAMERA.fov), in degrees. */
const FILM_FOV = 55
/** How far beside (or above) the part PIP floats, in metres. */
const PIP_ASIDE = 0.85

/**
 * Where PIP floats in a part close-up, chosen in the camera's own frame:
 * at about the part's depth, beside it on a wide screen and just above it
 * on a phone, where `check` (a raycast against the real meshes) says the
 * camera sees all of him. So he is never inside the machine nor hidden
 * behind a wheel. Tries nearer and farther depths, both sides; if no spot
 * shows all of him, takes the one that shows most.
 */
export function pickPipSpot(
  camera: { x: number; y: number; z: number },
  part: { x: number; y: number; z: number },
  check: SpotCheck | null,
  aspect = 16 / 9,
): { x: number; y: number; z: number } {
  let fx = part.x - camera.x
  let fy = part.y - camera.y
  let fz = part.z - camera.z
  const dist = Math.hypot(fx, fy, fz) || 1
  fx /= dist
  fy /= dist
  fz /= dist
  // Screen right (forward × up) and screen up (right × forward).
  let rx = -fz
  let rz = fx
  const rl = Math.hypot(rx, rz) || 1
  rx /= rl
  rz /= rl
  const ux = -rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy
  const along = (yaw: number, lift: number, reach: number) => {
    const dx = fx * Math.cos(yaw) + rx * Math.sin(yaw) + ux * Math.sin(lift)
    const dy = fy * Math.cos(yaw) + uy * Math.sin(lift)
    const dz = fz * Math.cos(yaw) + rz * Math.sin(yaw) + uz * Math.sin(lift)
    return { x: camera.x + dx * reach, y: camera.y + dy * reach, z: camera.z + dz * reach }
  }
  const seen = (spot: { x: number; y: number; z: number }) =>
    check ? check(spot, { x: rx, y: 0, z: rz }, { x: ux, y: uy, z: uz }) : 1
  // About as deep as the part, so PIP looks his own size beside it rather
  // than filling the lens. A wide picture puts him to one side; a phone,
  // which sees little to the sides, puts him just above the part.
  const narrow = aspect < 1
  const small = (6 * Math.PI) / 180
  // Half the picture's width, as an angle (minus room for PIP himself).
  const halfWide = Math.atan(Math.tan(((FILM_FOV / 2) * Math.PI) / 180) * aspect)
  let best: { spot: { x: number; y: number; z: number }; score: number } | null = null
  // Last, on a phone: in front of the part, nearer the lens, when the
  // machine hides every spot beside it (the rock tool under a rover).
  const depths: ReadonlyArray<readonly [number, number]> = [
    ...[0.95, 0.85, 1.05, 0.75, 1.15, 0.65].map(
      // On a phone he hangs a little farther back, so all of him fits.
      (share) => [share, narrow ? 1.3 : 1] as const,
    ),
    ...(narrow ? ([[0.6, 1], [0.5, 0.85]] as const) : []),
  ]
  for (const [share, boost] of depths) {
    const reach = Math.max(PIP_NEAREST, dist * share) * boost
    const aside = Math.atan2(PIP_ASIDE, reach)
    const tries: ReadonlyArray<readonly [number, number]> = narrow
      ? [
          [aside * 0.3, aside * 0.6],
          [-aside * 0.3, aside * 0.6],
          [aside * 0.55, aside * 0.25],
          [-aside * 0.55, aside * 0.25],
          [aside * 0.4, -aside * 0.5],
          [-aside * 0.4, -aside * 0.5],
        ]
      : [
          [aside, small],
          [-aside, small],
          [aside * 0.6, aside * 0.8],
          [-aside * 0.6, aside * 0.8],
        ]
    for (const [yaw, lift] of tries) {
      if (Math.abs(yaw) + Math.atan2(PIP_SIZE / 2, reach) > halfWide) continue
      const spot = along(-yaw, lift, reach)
      const score = seen(spot)
      if (score >= 1) return spot
      if (!best || score > best.score) best = { spot, score }
    }
  }
  // Nowhere he is fully seen: the spot where most of him is.
  return best?.spot ?? along(0, Math.atan2(PIP_ASIDE, dist) * 0.6, Math.max(PIP_NEAREST, dist))
}

/**
 * Before the story is sent home: a short film in two shots.
 * 1. PIP floats in front of the explorer holding the glowing message; the
 *    camera comes close to him (he says it is ready).
 * 2. The camera drops low on the far side and tilts up to the sky, towards
 *    Earth, as the message rises ("next stop, Earth!").
 */
export const SEND_FILM_SPLIT = 0.46

export interface SendFilmFrame extends ShotFrame {
  /** Where PIP floats with the message. */
  pip: { x: number; y: number; z: number }
  /** 0 until the message leaves, then 0..1 along its rise. */
  launch: number
}

export function getSendFilmFrame(
  progress: number,
  explorer: ExplorerId,
  center: { x: number; z: number },
  bestSide: { x: number; z: number },
  sky: { x: number; y: number; z: number },
  groundAt: (x: number, z: number) => number,
  /** Screen width / height: a phone needs wider shots. */
  aspect = 16 / 9,
): SendFilmFrame {
  const p = Math.min(1, Math.max(0, progress))
  const wide = aspect < 1 ? 1.55 : 1
  const { size, height } = EXPLORER_SIZE[explorer]
  const base = groundAt(center.x, center.z)
  const sl = Math.hypot(bestSide.x, bestSide.z) || 1
  const bx = bestSide.x / sl
  const bz = bestSide.z / sl
  // PIP: in front of the explorer, at about its height.
  const pipDistance = size * 1.05 + 0.7
  const pip = {
    x: center.x + bx * pipDistance,
    y: base + Math.max(1.1, height * 0.7),
    z: center.z + bz * pipDistance,
  }
  if (p < SEND_FILM_SPLIT) {
    const t = smooth(p / SEND_FILM_SPLIT)
    // Close on PIP, a little to his side and below, the explorer behind.
    const angle = Math.atan2(bz, bx) + mix([0.42, 0.24], t)
    const d = mix([2.3, 1.55], t) * wide
    const x = pip.x + Math.cos(angle) * d
    const z = pip.z + Math.sin(angle) * d
    return {
      shot: 0,
      position: { x, y: Math.max(groundAt(x, z) + MIN_CLEARANCE, pip.y - 0.25), z },
      look: { x: mix([pip.x, center.x], 0.25), y: pip.y + 0.05, z: mix([pip.z, center.z], 0.25) },
      pip,
      launch: 0,
    }
  }
  const t = smooth((p - SEND_FILM_SPLIT) / (1 - SEND_FILM_SPLIT))
  // Low, on the side away from the sky target, so the explorer, PIP and
  // the rising message are all against the sky.
  let hx = sky.x
  let hz = sky.z
  const hl = Math.hypot(hx, hz)
  if (hl < 1e-3) {
    hx = -bx
    hz = -bz
  } else {
    hx /= hl
    hz /= hl
  }
  // Well to one side as well, so PIP is never right against the lens
  // (from Mars the sky target lies behind him, seen from the child's side).
  const back = (size * 2 + 2.6) * wide
  const across = 2.4 * wide
  const x = center.x - hx * back - hz * across
  const z = center.z - hz * back + hx * across
  const y = groundAt(x, z) + 1.0
  const lookNear = { x: mix([center.x, pip.x], 0.5), y: base + height * 0.7, z: mix([center.z, pip.z], 0.5) }
  const lookSky = { x: center.x + sky.x * 30, y: base + sky.y * 30, z: center.z + sky.z * 30 }
  const k = smooth(Math.min(1, t * 1.15))
  return {
    shot: 1,
    position: { x, y, z },
    look: {
      x: mix([lookNear.x, lookSky.x], k * 0.3),
      y: mix([lookNear.y, lookSky.y], k * 0.3),
      z: mix([lookNear.z, lookSky.z], k * 0.3),
    },
    pip,
    launch: t,
  }
}
