import { MARS_OBJECTS } from '../data/marsObjects'
import { PATH_WAYPOINTS, WORLD } from './worldConfig'

const SPAWN_FLAT_RADIUS = 6.5
const SITE_FLAT_RADIUS = 7.2

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

function rawHeight(x: number, z: number): number {
  const broad = fbm(x * 0.012, z * 0.012, 7, 2) * 2.6
  const dunes = fbm(x * 0.038, z * 0.038, 1, 4) * 3.1
  const detail = fbm(x * 0.12, z * 0.12, 19, 2) * 0.32
  return broad + dunes + detail
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
]

/**
 * Single source of truth for ground elevation. Used by the terrain mesh, the
 * player, rocks and every object so nothing floats or sinks.
 */
export function getTerrainHeight(x: number, z: number): number {
  let height = rawHeight(x, z)

  for (const zone of FLATTEN_ZONES) {
    const distance = Math.hypot(x - zone.x, z - zone.z)
    if (distance >= zone.radius) continue
    const blend = 1 - smoothstep(zone.radius * 0.45, zone.radius, distance)
    height = lerp(height, zone.height, blend)
  }

  const distanceFromCenter = Math.hypot(x, z)
  height += smoothstep(46, 66, distanceFromCenter) * 10
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
