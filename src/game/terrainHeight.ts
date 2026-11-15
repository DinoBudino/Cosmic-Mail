import { MARS_OBJECTS } from '../data/marsObjects'
import { getActiveExplorer, getActiveWorld, SPIRIT_SITE, type MoonExplorerId } from '../data/spiritSite'
import { getLunarHeight } from './lunarGround'
import { PATH_WAYPOINTS, SURVEY_ROUTE, WORLD } from './worldConfig'

const SPAWN_FLAT_RADIUS = 8
const SITE_FLAT_RADIUS = 7.2
const SPIRIT_FLAT_RADIUS = 7.8

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function hash2(ix: number, iz: number, seed: number): number {
  const value = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453123
  return value - Math.floor(value)
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const u = fx * fx * (3 - 2 * fx)
  const v = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz, seed)
  const b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed)
  const d = hash2(ix + 1, iz + 1, seed)
  return lerp(lerp(a, b, u), lerp(c, d, u), v)
}

function fbm(x: number, z: number, seed: number, octaves: number): number {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let normalization = 0
  for (let octave = 0; octave < octaves; octave += 1) {
    const noise = valueNoise(x * frequency, z * frequency, seed + octave * 17)
    sum += (noise * 2 - 1) * amplitude
    normalization += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return normalization === 0 ? 0 : sum / normalization
}

interface ZoneRelief {
  broad: number
  dunes: number
  ridges: number
  basins: number
  detail: number
  offset: number
}

const DEFAULT_RELIEF: ZoneRelief = {
  broad: 2.6,
  dunes: 3.1,
  ridges: 1.0,
  basins: 1.1,
  detail: 0.3,
  offset: 0,
}

/**
 * Fase 4 · Paso 1 — each region keeps the shared noise field but with its own
 * relief mix, so the four Mars sites read as distinct landscapes without a
 * new palette or a larger map. Distinction is geographic only (§5).
 */
const ZONE_RELIEF: Record<string, ZoneRelief> = {
  // Valley of discoveries: gentler dunes, sunk between the mesas.
  opportunity: { broad: 2.4, dunes: 2.0, ridges: 0.6, basins: 0.8, detail: 0.25, offset: -1.0 },
  // Quiet plain: strongly reduced dunes and detail, the calmest ground.
  insight: { broad: 2.0, dunes: 0.45, ridges: 0.15, basins: 0.3, detail: 0.15, offset: 0.2 },
  // First-flight dunes: low, smooth ridges and a clear flight area.
  ingenuity: { broad: 2.2, dunes: 1.7, ridges: 0.25, basins: 0.4, detail: 0.12, offset: -0.3 },
  // Older, rockier ground: depression plus more broken relief and detail.
  viking1: { broad: 2.6, dunes: 1.9, ridges: 1.7, basins: 0.9, detail: 0.55, offset: -2.0 },
}

const ZONE_INNER_RADIUS = 9
const ZONE_OUTER_RADIUS = 26

function zoneWeight(x: number, z: number, site: { x: number; z: number }): number {
  const distance = Math.hypot(x - site.x, z - site.z)
  return 1 - smoothstep(ZONE_INNER_RADIUS, ZONE_OUTER_RADIUS, distance)
}

/**
 * Regional falloff (1 at the site, 0 beyond ZONE_OUTER_RADIUS), exported so
 * terrain coloring uses the exact same geography as the height modulation.
 */
export function getRegionWeight(x: number, z: number, siteId: string): number {
  const site = MARS_OBJECTS.find((object) => object.id === siteId)
  return site ? zoneWeight(x, z, site.position) : 0
}

function reliefFor(x: number, z: number): ZoneRelief {
  let total = 0
  const weighted: ZoneRelief = { broad: 0, dunes: 0, ridges: 0, basins: 0, detail: 0, offset: 0 }

  for (const object of MARS_OBJECTS) {
    const weight = zoneWeight(x, z, object.position)
    if (weight <= 0) continue
    const params = ZONE_RELIEF[object.id] ?? DEFAULT_RELIEF
    total += weight
    weighted.broad += params.broad * weight
    weighted.dunes += params.dunes * weight
    weighted.ridges += params.ridges * weight
    weighted.basins += params.basins * weight
    weighted.detail += params.detail * weight
    weighted.offset += params.offset * weight
  }

  if (total <= 0) return DEFAULT_RELIEF

  // In overlapping falloffs, normalized weights prevent double-counting.
  const blend = Math.min(1, total)
  const mix = (zoneValue: number, defaultValue: number) =>
    defaultValue + (zoneValue / total - defaultValue) * blend

  return {
    broad: mix(weighted.broad, DEFAULT_RELIEF.broad),
    dunes: mix(weighted.dunes, DEFAULT_RELIEF.dunes),
    ridges: mix(weighted.ridges, DEFAULT_RELIEF.ridges),
    basins: mix(weighted.basins, DEFAULT_RELIEF.basins),
    detail: mix(weighted.detail, DEFAULT_RELIEF.detail),
    offset: (weighted.offset / total) * blend,
  }
}

/** Hand-placed shelves that give the Geological Passage a readable shape. */
const GEOLOGIC_MOUNDS = [
  { x: 15, z: 28, radius: 12, height: 3.4 },
  { x: -3, z: 21, radius: 8, height: 2.6 },
  { x: 9, z: 5, radius: 7.5, height: 1.9 },
] as const

function moundHeight(x: number, z: number): number {
  let height = 0
  for (const mound of GEOLOGIC_MOUNDS) {
    const distance = Math.hypot(x - mound.x, z - mound.z)
    const rolloff = 1 - smoothstep(0, mound.radius * 1.7, distance)
    height += mound.height * rolloff * rolloff
  }
  return height
}

function rawHeight(x: number, z: number): number {
  const relief = reliefFor(x, z)
  const broad = fbm(x * 0.012, z * 0.012, 7, 2) * relief.broad
  const dunes = fbm(x * 0.038, z * 0.038, 1, 4) * relief.dunes
  // Low, broken ridges and shallow basins add readable relief without turning
  // the playable area into steep, hard-to-traverse terrain.
  const ridges = fbm(x * 0.075 + 13, z * 0.075 - 8, 31, 3) * relief.ridges
  const basins = -Math.max(0, fbm(x * 0.03 - 5, z * 0.03 + 9, 43, 2)) * relief.basins
  const detail = fbm(x * 0.12, z * 0.12, 19, 2) * relief.detail
  return (
    broad +
    dunes +
    ridges +
    basins +
    detail +
    relief.offset +
    moundHeight(x, z)
  )
}

interface FlattenZone {
  x: number
  z: number
  radius: number
  height: number
}

const FLATTEN_ZONES: readonly FlattenZone[] = [
  ...MARS_OBJECTS.map((object) => ({
    x: object.position.x,
    z: object.position.z,
    radius: SITE_FLAT_RADIUS,
    height: rawHeight(object.position.x, object.position.z),
  })),
  {
    x: WORLD.spawn.x,
    z: WORLD.spawn.z,
    radius: SPAWN_FLAT_RADIUS,
    height: rawHeight(WORLD.spawn.x, WORLD.spawn.z),
  },
  {
    x: SPIRIT_SITE.position.x,
    z: SPIRIT_SITE.position.z,
    radius: SPIRIT_FLAT_RADIUS,
    height: rawHeight(SPIRIT_SITE.position.x, SPIRIT_SITE.position.z),
  },
]

/**
 * Single source of truth for ground elevation. Used by the terrain mesh, the
 * player, rocks and every object so nothing floats or sinks.
 */
export function getTerrainHeight(x: number, z: number): number {
  // On the Moon the ground follows the lunar site of the chosen landing.
  if (getActiveWorld() === 'moon') {
    return getLunarHeight(getActiveExplorer() as MoonExplorerId, x, z)
  }
  let height = rawHeight(x, z)

  for (const zone of FLATTEN_ZONES) {
    const distance = Math.hypot(x - zone.x, z - zone.z)
    if (distance >= zone.radius) continue
    const blend = 1 - smoothstep(zone.radius * 0.45, zone.radius, distance)
    height = lerp(height, zone.height, blend)
  }

  const distanceFromCenter = Math.hypot(x, z)
  // A long, low rise instead of a nearby circular wall: the playable area
  // ends well before the decorative ridge becomes steep.
  height += smoothstep(112, 168, distanceFromCenter) * 6
  height += smoothstep(158, 230, distanceFromCenter) * 6
  return height
}

export function getTerrainSlope(x: number, z: number, sample = 0.8): number {
  const height = getTerrainHeight(x, z)
  const dx = Math.abs(getTerrainHeight(x + sample, z) - height)
  const dz = Math.abs(getTerrainHeight(x, z + sample) - height)
  return Math.max(dx, dz) / sample
}

/**
 * Gentle speed penalty on steep ground. It never blocks movement, so the
 * player cannot get stuck on a procedural slope.
 */
export function slopeSpeedFactor(slope: number): number {
  const excess = Math.max(0, slope - 0.28)
  return Math.min(1, Math.max(0.35, 1 - excess * 1.15))
}

function distanceToSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(0, ((x - ax) * dx + (z - az) * dz) / lengthSquared),
        )
  const closestX = ax + t * dx
  const closestZ = az + t * dz
  return Math.hypot(x - closestX, z - closestZ)
}

export function distanceToPath(x: number, z: number): number {
  let closest = Number.POSITIVE_INFINITY
  for (let index = 0; index < PATH_WAYPOINTS.length - 1; index += 1) {
    const from = PATH_WAYPOINTS[index]
    const to = PATH_WAYPOINTS[index + 1]
    closest = Math.min(
      closest,
      distanceToSegment(x, z, from.x, from.z, to.x, to.z),
    )
  }
  return closest
}

/** Distance to the hand-authored expedition trail (landing → explorer). */
export function distanceToSurveyTrail(x: number, z: number): number {
  let closest = Number.POSITIVE_INFINITY
  for (let index = 0; index < SURVEY_ROUTE.length - 1; index += 1) {
    const from = SURVEY_ROUTE[index]
    const to = SURVEY_ROUTE[index + 1]
    closest = Math.min(
      closest,
      distanceToSegment(x, z, from.x, from.z, to.x, to.z),
    )
  }
  return closest
}
