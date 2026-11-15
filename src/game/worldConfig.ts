import { MARS_OBJECTS, type WorldPosition } from '../data/marsObjects'

export type Quality = 'high' | 'low'

export interface QualityPreset {
  label: string
  dpr: [number, number]
  shadows: boolean
  postprocessing: boolean
  rockCount: number
  dustCount: number
  starCount: number
  fogNear: number
  fogFar: number
  shadowMapSize: number
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  high: {
    label: 'High',
    dpr: [1, 2],
    shadows: true,
    postprocessing: true,
    rockCount: 900,
    dustCount: 460,
    starCount: 1800,
    fogNear: 60,
    fogFar: 460,
    shadowMapSize: 2048,
  },
  low: {
    label: 'Low',
    dpr: [1, 1.25],
    shadows: false,
    postprocessing: false,
    rockCount: 360,
    dustCount: 170,
    starCount: 650,
    fogNear: 55,
    fogFar: 440,
    shadowMapSize: 1024,
  },
}

/**
 * Planetary Exploration 2.0 — a compact but open-handed Mars expedition.
 * The landing zone sits south of the map; the survey passage crosses a
 * raised geological shelf, and the explorer site lies about 120 m away.
 * A broad crater floor contains the expedition; the distant, eroded inner
 * walls and irregular rim surround both explorer landings.
 */
export const WORLD = {
  terrainSize: 480,
  terrainSegments: 240,
  playRadius: 120,
  spawn: { x: 0, z: 75 },
} as const

/** Hand-authored survey trail from the landing zone to the explorer approach. */
export const SURVEY_ROUTE: readonly WorldPosition[] = [
  WORLD.spawn,
  { x: -4, z: 60 },
  { x: 7, z: 47 },
  { x: -7, z: 34 },
  { x: 3, z: 22 },
  { x: 14, z: 16 },
  { x: 9, z: 2 },
  { x: 1, z: -13 },
  { x: -4, z: -27 },
  { x: 0, z: -36 },
]

/** Raised geological viewpoint that reveals the explorer site from afar. */
export const SURVEY_VIEWPOINT = { x: 15, z: 28 } as const

/** The three connected exploration areas, used by UI and PIP orientation. */
export const EXPLORATION_ZONES = [
  {
    id: 'landing',
    name: 'Landing Zone',
    position: { x: WORLD.spawn.x, z: WORLD.spawn.z },
    radius: 22,
  },
  {
    id: 'passage',
    name: 'Geological Passage',
    position: { x: 2, z: 28 },
    radius: 34,
  },
  {
    id: 'explorer',
    name: 'Explorer Site',
    position: { x: 0, z: -45 },
    radius: 18,
  },
] as const

export const PLAYER = {
  moveSpeed: 5.4,
  runSpeedMultiplier: 1.45,
  moveAccel: 11,
  turnSpeed: 13,
  radius: 0.45,
  // Inspection rings only count near the ground.
  inspectMaxHeight: 1.2,
} as const

export const CAMERA = {
  distance: 10.6,
  minDistance: 6.2,
  maxDistance: 16,
  pitch: 0.36,
  minPitch: 0.06,
  maxPitch: 1.12,
  orbitSensitivity: 0.0048,
  pinchSensitivity: 0.02,
  zoomSensitivity: 0.01,
  damping: 6.5,
  lookDamping: 10,
  lookHeight: 1.35,
  minTerrainClearance: 1.8,
  collisionSamples: 6,
  objectClearance: 3.6,
  fov: 55,
} as const

/** Physical Cosmic Scanner tuning: aim, raycast and hold-to-scan. */
export const SCANNER = {
  /** Maximum player-to-component distance for a valid scan. */
  range: 14,
  /** Camera ray length from the pointer/camera. */
  rayFar: 28,
  /**
   * Hold time for every scan (practice rock, parts and landscape). Long
   * enough to enjoy the sweep, short enough for small hands.
   */
  holdSeconds: 1.8,
  /** Comfortable third-person distance while the scanner is held. */
  cameraDistance: 8.4,
  cameraDamping: 7,
  /** Arm aim fallback point along the pointer ray. */
  fallbackAimDistance: 10,
  /** Anatomical clamp for the right-arm aim direction. */
  minAimYaw: -0.35,
  maxAimYaw: 1.35,
  minAimY: -0.8,
  maxAimY: 0.6,
  /** Damping for the world aim point that drives the arm pose. */
  armAimDamping: 14,
  /** Environmental targets are reachable from a slightly shorter range. */
  environmentalRange: 11,
  /** First-person eye height and camera transition speed. */
  firstPersonEyeHeight: 1.62,
  firstPersonDamping: 9,
  /** First-person camera setting. */
  firstPersonPitchMin: -0.72,
  firstPersonPitchMax: 0.72,
} as const

/** Muted ferric dust, charcoal rock and a butterscotch suspended-dust
 * sky (the orange haze of fine iron-oxide dust), guided by the rover
 * surface references. Scanner accents remain legible. */
export const PALETTE = {
  skyZenith: '#A9714D',
  skyUpper: '#C4855A',
  skyMid: '#D99862',
  skyHorizon: '#EDB27F',
  skyBelow: '#C78560',
  skyFloor: '#6B4C3D',
  fog: '#D99868',
  sun: '#FFF2E4',
  ambient: '#E4C2A3',
  hemiSky: '#E6AA7C',
  hemiGround: '#6B4B3C',
  terrainDark: '#705448',
  terrainMid: '#A4785A',
  terrainLight: '#B88A65',
  terrainHigh: '#C2A080',
  path: '#B18A68',
  rockDark: '#514C49',
  rockLight: '#948174',
  accent: '#F47B38',
  dust: '#D88E5C',
  beaconAvailable: '#F47B38',
  beaconSoon: '#D9895C',
  starWarm: '#FFF0E0',
  starCool: '#F2CDB4',
  moon: '#F2CDB4',
  moonGlow: '#F2CDB4',
  skyGlowWarm: '#F6C396',
  skyGlowCool: '#B0A096',
} as const

export const SUN_DIRECTION = { x: -0.62, y: 0.32, z: -0.72 } as const

export const MOON_DIRECTION = { x: 0.44, y: 0.36, z: -0.82 } as const

/**
 * Single source of truth for the walking route: the painted path on the
 * terrain, rock exclusion and assisted travel all read this loop.
 *
 * Fase 4 · Paso 2 — each leg between consecutive stops is gently curved with
 * two deterministic intermediate points (alternating side, capped offset), so
 * the route reads as a natural trail instead of ruler-straight segments.
 * Stops themselves are unchanged, and every point stays well inside the
 * playable radius.
 */
function buildCurvedPath(stops: readonly WorldPosition[]): WorldPosition[] {
  const points: WorldPosition[] = []
  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = stops[index]!
    const to = stops[index + 1]!
    points.push(from)
    const dx = to.x - from.x
    const dz = to.z - from.z
    const length = Math.hypot(dx, dz)
    if (length < 1e-4) continue
    const side = index % 2 === 0 ? 1 : -1
    const amplitude = Math.min(4.5, length * 0.18)
    for (const t of [1 / 3, 2 / 3]) {
      const bend = Math.sin(Math.PI * t) * amplitude * side
      points.push({
        x: from.x + dx * t + (-dz / length) * bend,
        z: from.z + dz * t + (dx / length) * bend,
      })
    }
  }
  points.push(stops[stops.length - 1]!)
  return points
}

/** A closed loop that visits the spawn point and every Mars site once. */
export const PATH_WAYPOINTS: readonly WorldPosition[] = buildCurvedPath([
  WORLD.spawn,
  ...MARS_OBJECTS.map((object) => object.position),
  WORLD.spawn,
])
