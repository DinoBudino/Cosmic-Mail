import * as THREE from 'three'
import { MAILWING_LANDING } from '../data/spiritSite'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MARS_OBJECTS } from '../data/marsObjects'
import { SPIRIT_SITE } from '../data/spiritSite'
import { mulberry32 } from './random'
import {
  distanceToPath,
  distanceToSurveyTrail,
  getTerrainHeight,
  getTerrainSlope,
} from './terrainHeight'
import { PALETTE, PATH_WAYPOINTS, PLAYER, WORLD } from './worldConfig'

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 144665)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const uz = fz * fz * (3 - 2 * fz)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const corner = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz, seed)
  return lerp(
    lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), ux), lerp(corner(0, 1, 0), corner(1, 1, 0), ux), uy),
    lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), ux), lerp(corner(0, 1, 1), corner(1, 1, 1), ux), uy),
    uz,
  )
}

/**
 * Weathered Martian rocks. A finely subdivided sphere is pushed by layered
 * noise (broad lumps plus small pits), cut by a few soft planes so it keeps
 * some fractured faces, and flattened underneath so it sits in the sand.
 * Shared vertices give smooth shading, so rocks no longer read as bare
 * polygons on the ground. `detail` 3 (1280 triangles) is for large rocks;
 * small ones use 2 (320 triangles) with the same shape. Vertex colours add dust on the upper faces and
 * darker crevices; the instance colour tints the whole rock.
 */
export function buildRockGeometry(variant: number, detail = 3): THREE.BufferGeometry {
  const seed = 17 + variant * 31
  const base = mergeVertices(new THREE.IcosahedronGeometry(1, detail))
  base.deleteAttribute('normal')
  base.deleteAttribute('uv')
  const position = base.getAttribute('position')
  const random = mulberry32(0x40c4 + variant * 977)
  const cuts = Array.from({ length: 3 + variant }, () => {
    const theta = random() * Math.PI * 2
    const y = random() * 1.2 - 0.2
    const normal = new THREE.Vector3(Math.cos(theta), y, Math.sin(theta)).normalize()
    return { normal, offset: 0.62 + random() * 0.2 }
  })
  const point = new THREE.Vector3()
  const colors = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index)
    const broad = valueNoise3(point.x * 1.3 + 3, point.y * 1.3, point.z * 1.3, seed) - 0.5
    const mid = valueNoise3(point.x * 3.1, point.y * 3.1 + 7, point.z * 3.1, seed + 1) - 0.5
    const fine = valueNoise3(point.x * 7.5, point.y * 7.5, point.z * 7.5 + 11, seed + 2) - 0.5
    const radius = 1 + broad * 0.42 + mid * 0.16 + fine * 0.05
    point.multiplyScalar(radius)
    // Soft fracture planes: points beyond a plane are pulled back onto it.
    for (const cut of cuts) {
      const distance = point.dot(cut.normal) - cut.offset
      if (distance > 0) point.addScaledVector(cut.normal, -distance * 0.85)
    }
    // Flat, slightly spread base so the rock sits in the sand. The spread
    // grows smoothly below the line: a hard step here left a dark lip.
    if (point.y < -0.35) {
      const below = Math.min(1, (-0.35 - point.y) / 0.4)
      const spread = 1 + 0.05 * below * below
      point.y = -0.35 + (point.y + 0.35) * 0.25
      point.x *= spread
      point.z *= spread
    }
    position.setXYZ(index, point.x, point.y, point.z)
    const crevice = 0.86 + (mid + 0.5) * 0.2 + fine * 0.18
    colors[index * 3] = crevice
    colors[index * 3 + 1] = crevice
    colors[index * 3 + 2] = crevice
  }
  base.computeVertexNormals()
  // Fine dust settles on the faces looking up.
  const normal = base.getAttribute('normal')
  const dust = new THREE.Color(PALETTE.dust)
  for (let index = 0; index < position.count; index += 1) {
    const up = THREE.MathUtils.smoothstep(normal.getY(index), 0.45, 0.95) * 0.42
    colors[index * 3] = THREE.MathUtils.lerp(colors[index * 3]!, dust.r * 1.25, up)
    colors[index * 3 + 1] = THREE.MathUtils.lerp(colors[index * 3 + 1]!, dust.g * 1.25, up)
    colors[index * 3 + 2] = THREE.MathUtils.lerp(colors[index * 3 + 2]!, dust.b * 1.25, up)
  }
  base.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  base.computeBoundingSphere()
  return base
}

/** Rock-free radius per site: Ingenuity's flight area stays clearest. */
export const SITE_ROCK_CLEARANCE: Readonly<Record<string, number>> = {
  opportunity: 8,
  viking1: 6.5,
  insight: 9,
  ingenuity: 13,
}

export interface RockInstance {
  x: number
  y: number
  z: number
  scale: number
  stretchX: number
  stretchY: number
  stretchZ: number
  variant: number
  rotation: number
  tilt: number
  color: THREE.Color
}

export function createRocks(count: number): RockInstance[] {
  const random = mulberry32(0x5eed1)
  const rocks: RockInstance[] = []
  const maxAttempts = count * 40
  const clusters = [
    [-52, 20],
    [-45, -40],
    [45, -30],
    [45, 25],
    [-14, -55],
    [24, 52],
    // Planetary Exploration 2.0: landing shelf, geological passage and the
    // explorer approach each get their own character.
    [-14, 66],
    [13, 48],
    [-13, 30],
    [18, 12],
    [9, -18],
    [-12, -34],
  ] as const
  let attempts = 0

  while (rocks.length < count && attempts < maxAttempts) {
    attempts += 1
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * (WORLD.playRadius + 7)
    const cluster = clusters[Math.floor(random() * clusters.length)]
    const clustered = random() < 0.72
    const x = clustered ? cluster[0] + Math.cos(angle) * random() * 12 : Math.cos(angle) * radius
    const z = clustered ? cluster[1] + Math.sin(angle) * random() * 10 : Math.sin(angle) * radius
    if (Math.hypot(x, z) > WORLD.playRadius + 7) continue

    if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < 4.5) continue
    if (Math.hypot(x - MAILWING_LANDING.position.x, z - MAILWING_LANDING.position.z) < 8.5) continue
    if (distanceToPath(x, z) < 2.6) continue
    if (distanceToSurveyTrail(x, z) < 2.2) continue
    if (
      Math.hypot(
        x - SPIRIT_SITE.position.x,
        z - SPIRIT_SITE.position.z,
      ) <
      SPIRIT_SITE.ringRadius + 3
    ) {
      continue
    }

    let nearSite = false
    for (const object of MARS_OBJECTS) {
      const clearance = SITE_ROCK_CLEARANCE[object.id] ?? 9.5
      if (
        Math.hypot(
          x - object.position.x,
          z - object.position.z,
        ) < clearance
      ) {
        nearSite = true
        break
      }
    }
    if (nearSite) continue
    if (getTerrainSlope(x, z) > 0.62) continue

    // Regional character (Fase 4 · Paso 3): Viking's rocks are larger and
    // darker, InSight's are small and dust-pale, Opportunity's are often
    // half-buried, Ingenuity's flight area stays sparse.
    let nearestSite: string | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const object of MARS_OBJECTS) {
      const distance = Math.hypot(x - object.position.x, z - object.position.z)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestSite = object.id
      }
    }
    const inRegion = nearestDistance < 17
    const region = inRegion ? nearestSite : null

    const isBoulder = random() < 0.05
    let scale = isBoulder ? 1.2 + random() * 0.9 : 0.18 + random() * 0.8
    if (region === 'viking1') scale *= 1.3
    if (region === 'insight') scale *= 0.8
    if (region === 'ingenuity') scale *= 0.85
    const stretchY = 0.4 + random() * 0.45
    const color = new THREE.Color(PALETTE.rockDark).lerp(new THREE.Color(PALETTE.rockLight), random())
    if (region === 'viking1') color.lerp(new THREE.Color(PALETTE.rockDark), 0.45)
    if (region === 'insight') color.lerp(new THREE.Color(PALETTE.dust), 0.4)
    const buryFactor = region === 'opportunity' && random() < 0.5 ? 0.22 : 0.42
    rocks.push({
      x,
      y: getTerrainHeight(x, z) + scale * stretchY * buryFactor,
      z,
      scale,
      stretchX: 0.8 + random() * 0.9,
      stretchY,
      stretchZ: 0.6 + random() * 0.8,
      variant: Math.floor(random() * 3),
      rotation: random() * Math.PI * 2,
      tilt: (random() - 0.5) * 0.35,
      color,
    })
  }

  // Trail waymarks: one deliberate boulder beside each bend of the route, so
  // children can read the path in the landscape without relying on arrows.
  for (let index = 1; index < PATH_WAYPOINTS.length - 1; index += 1) {
    const waypoint = PATH_WAYPOINTS[index]!
    const previous = PATH_WAYPOINTS[index - 1]!
    const next = PATH_WAYPOINTS[index + 1]!
    let dirX = next.x - previous.x
    let dirZ = next.z - previous.z
    const dirLength = Math.hypot(dirX, dirZ)
    if (dirLength < 1e-4) continue
    dirX /= dirLength
    dirZ /= dirLength
    const side = index % 2 === 0 ? 1 : -1
    const x = waypoint.x + -dirZ * side * 4.4
    const z = waypoint.z + dirX * side * 4.4
    if (Math.hypot(x, z) > WORLD.playRadius) continue
    if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < 4) continue
    if (Math.hypot(x - MAILWING_LANDING.position.x, z - MAILWING_LANDING.position.z) < 8.5) continue
    if (getTerrainSlope(x, z) > 0.62) continue
    let nearSite = false
    for (const object of MARS_OBJECTS) {
      const clearance = SITE_ROCK_CLEARANCE[object.id] ?? 9.5
      if (Math.hypot(x - object.position.x, z - object.position.z) < clearance + 1) {
        nearSite = true
        break
      }
    }
    if (nearSite) continue
    const scale = 0.85 + (index % 3) * 0.15
    rocks.push({
      x,
      y: getTerrainHeight(x, z) + scale * 0.7 * 0.42,
      z,
      scale,
      stretchX: 1.1,
      stretchY: 0.7,
      stretchZ: 0.9,
      variant: index % 3,
      rotation: index * 0.7,
      tilt: 0.08,
      color: new THREE.Color(PALETTE.rockLight).lerp(new THREE.Color(PALETTE.rockDark), 0.3),
    })
  }

  // Geological Passage: two large outcrop boulders break the direct line in
  // a natural way, inviting the player to choose a left or right route while
  // keeping the painted survey trail clear.
  const passageBoulders = [
    { x: 0.5, z: 21, scale: 1.9, variant: 0 },
    { x: -2.5, z: 12, scale: 1.55, variant: 1 },
    { x: 19, z: 30, scale: 1.15, variant: 2 },
  ] as const
  for (const boulder of passageBoulders) {
    const x = boulder.x
    const z = boulder.z
    if (distanceToSurveyTrail(x, z) < 2.2) continue
    const stretchY = 0.72
    rocks.push({
      x,
      y: getTerrainHeight(x, z) + boulder.scale * stretchY * 0.4,
      z,
      scale: boulder.scale,
      stretchX: 1.25,
      stretchY,
      stretchZ: 1.05,
      variant: boulder.variant,
      rotation: boulder.z * 0.17,
      tilt: 0.12,
      color: new THREE.Color(PALETTE.rockDark).lerp(
        new THREE.Color(PALETTE.rockLight),
        0.35,
      ),
    })
  }

  return rocks
}

export interface BoulderObstacle {
  x: number
  z: number
  radius: number
  topY: number
}

const boulderCaches = new Map<number, BoulderObstacle[]>()

/**
 * Deterministic boulders (scale ≥ 0.8, including trail waymarks) shared with
 * PIP and the player so both collide with the same rocks that are rendered.
 * The cache is keyed by count: High and Low quality each keep a stable list
 * without rebuilding every frame when the two systems alternate calls.
 */
export function getBoulderObstacles(count = 150): BoulderObstacle[] {
  const cached = boulderCaches.get(count)
  if (cached) return cached
  const list = createRocks(count)
    .filter((rock) => rock.scale >= 0.8)
    .map((rock) => ({
      x: rock.x,
      z: rock.z,
      radius: rock.scale * Math.max(rock.stretchX, rock.stretchZ) * 0.85,
      topY: rock.y + rock.scale * rock.stretchY * 0.5,
    }))
  boulderCaches.set(count, list)
  return list
}

/**
 * Player movement collision for the few boulders tall enough to matter: the
 * player walks around them. Mutates x/z to avoid per-frame allocations.
 */
export function resolveBoulderCollision(
  position: { x: number; z: number },
  airborne = 0,
  count = 150,
): void {
  const groundY = getTerrainHeight(position.x, position.z)
  for (const boulder of getBoulderObstacles(count)) {
    if (groundY + airborne >= boulder.topY) continue
    const dx = position.x - boulder.x
    const dz = position.z - boulder.z
    const distance = Math.hypot(dx, dz)
    const minimum = boulder.radius + PLAYER.radius
    if (distance >= minimum) continue
    if (distance < 1e-4) {
      position.x = boulder.x + minimum
      continue
    }
    position.x = boulder.x + (dx / distance) * minimum
    position.z = boulder.z + (dz / distance) * minimum
  }
}
