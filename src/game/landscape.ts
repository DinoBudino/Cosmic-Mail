import * as THREE from 'three'
import { MARS_OBJECTS } from '../data/marsObjects'
import { mulberry32 } from './random'
import { distanceToPath, getTerrainHeight, getTerrainSlope } from './terrainHeight'
import { PALETTE, PATH_WAYPOINTS, WORLD } from './worldConfig'

/** Broad erosion shelves, not pointed peaks. All geometry lives above y=0. */
export function buildMesaGeometry(seed: number): THREE.BufferGeometry {
  const random = mulberry32(seed)
  const sides = 12
  const profile = [
    [0, 1.08], [0.14, 1.04], [0.2, 0.92], [0.52, 0.86],
    [0.57, 0.75], [0.88, 0.7], [0.94, 0.59], [1, 0.56],
  ] as const
  const outline = Array.from({ length: sides }, () => 0.85 + random() * 0.3)
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const shade = new THREE.Color()
  const foot = new THREE.Color('#574766')
  const wall = new THREE.Color('#8E748C')
  const cap = new THREE.Color('#D49A77')

  profile.forEach(([height, radius], level) => {
    for (let side = 0; side < sides; side += 1) {
      const angle = side / sides * Math.PI * 2
      const erosion = outline[side] * (0.97 + random() * 0.06)
      positions.push(
        Math.cos(angle) * radius * erosion + height * 0.13,
        height + (level === 0 ? 0 : (random() - 0.5) * 0.025),
        Math.sin(angle) * radius * erosion - height * 0.08,
      )
      shade.copy(foot).lerp(wall, height)
      if (level === 2 || level === 4) shade.lerp(foot, 0.2)
      if (level >= 6) shade.lerp(cap, 0.6)
      shade.toArray(colors, colors.length)
      if (level > 0) {
        const a = (level - 1) * sides + side
        const b = (level - 1) * sides + (side + 1) % sides
        const c = level * sides + side
        const d = level * sides + (side + 1) % sides
        indices.push(a, c, b, b, c, d)
      }
    }
  })
  const center = positions.length / 3
  positions.push(0.13, 1, -0.08)
  cap.toArray(colors, colors.length)
  const lastRing = (profile.length - 1) * sides
  for (let side = 0; side < sides; side += 1) {
    indices.push(center, lastRing + (side + 1) % sides, lastRing + side)
  }
  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  indexed.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  indexed.setIndex(indices)
  const geometry = indexed.toNonIndexed()
  indexed.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Three shared low-poly shapes; deformation is coherent across split vertices. */
export function buildRockGeometry(variant: number): THREE.BufferGeometry {
  const geometry = variant === 0
    ? new THREE.DodecahedronGeometry(1, 0)
    : variant === 1 ? new THREE.IcosahedronGeometry(1, 0) : new THREE.OctahedronGeometry(1, 0)
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const erosion = 0.88 + Math.sin(x * 7.1 + y * 3.7 + z * 5.3 + variant * 2) * 0.12
    position.setXYZ(index, x * erosion + y * 0.12, y * erosion, z * erosion)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export interface RockFormation {
  x: number
  z: number
  width: number
  depth: number
  height: number
  rotation: number
  variant: number
  color: string
}

/** Asymmetric canyon walls outside the playable area and camera boom. */
export const ROCK_FORMATIONS: readonly RockFormation[] = [
  // The western walls frame the open approach towards Opportunity.
  { x: -178, z: -22, width: 16, depth: 23, height: 18, rotation: 0.25, variant: 0, color: PALETTE.mesaNear },
  { x: -160, z: 54, width: 12, depth: 18, height: 12, rotation: -0.4, variant: 1, color: PALETTE.mesaNear },
  { x: -92, z: -164, width: 23, depth: 17, height: 23, rotation: 0.3, variant: 2, color: PALETTE.mesaNear },
  { x: -36, z: -186, width: 11, depth: 14, height: 16, rotation: 0.8, variant: 0, color: PALETTE.mesaNear },
  { x: 63, z: -178, width: 27, depth: 18, height: 17, rotation: -0.2, variant: 1, color: PALETTE.mesaNear },
  { x: 166, z: -84, width: 18, depth: 26, height: 21, rotation: 0.6, variant: 2, color: PALETTE.mesaNear },
  { x: 174, z: 34, width: 17, depth: 22, height: 14, rotation: -0.3, variant: 0, color: PALETTE.mesaNear },
  { x: 98, z: 154, width: 22, depth: 17, height: 18, rotation: 0.4, variant: 1, color: PALETTE.mesaNear },
  { x: -51, z: 173, width: 26, depth: 16, height: 12, rotation: -0.4, variant: 2, color: PALETTE.mesaNear },
  // Mid-distance framing wall on the approach to the Opportunity valley:
  // close enough to read as its backdrop from the spawn, still clear of the
  // playable camera envelope.
  { x: -132, z: 40, width: 14, depth: 16, height: 15, rotation: -0.2, variant: 1, color: PALETTE.mesaNear },
  // Valley of Echoes backdrop: layered mesa north of Opportunity.
  { x: -98, z: -118, width: 20, depth: 14, height: 14, rotation: 0.15, variant: 0, color: PALETTE.mesaNear },
  // Lower-contrast distant silhouettes, with deliberate gaps instead of a ring.
  { x: -210, z: -138, width: 24, depth: 20, height: 25, rotation: 0.2, variant: 1, color: PALETTE.mesaFar },
  { x: -105, z: -240, width: 31, depth: 22, height: 28, rotation: -0.5, variant: 0, color: PALETTE.mesaFar },
  { x: 38, z: -258, width: 34, depth: 23, height: 24, rotation: 0.1, variant: 2, color: PALETTE.mesaFar },
  { x: 228, z: -60, width: 29, depth: 19, height: 29, rotation: -0.3, variant: 1, color: PALETTE.mesaFar },
  { x: 168, z: 210, width: 27, depth: 22, height: 24, rotation: 0.3, variant: 0, color: PALETTE.mesaFar },
  { x: -168, z: 198, width: 25, depth: 20, height: 22, rotation: -0.1, variant: 2, color: PALETTE.mesaFar },
]

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
  const clusters = [[-52, 20], [-45, -40], [45, -30], [45, 25], [-14, -55], [24, 52]] as const
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

    if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < 3.5) continue
    if (distanceToPath(x, z) < 2.6) continue

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
    if (!isBoulder && random() < 0.045) color.lerp(new THREE.Color(PALETTE.accent), 0.6)
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

  // Ingenuity flight-area markers: small stones ringing the clear apron at
  // the edge of its rock-free radius, so the zone has a readable boundary.
  const ingenuity = MARS_OBJECTS.find((object) => object.id === 'ingenuity')!
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 + 0.26
    const x = ingenuity.position.x + Math.cos(angle) * 11.5
    const z = ingenuity.position.z + Math.sin(angle) * 11.5
    if (Math.hypot(x, z) > WORLD.playRadius) continue
    if (distanceToPath(x, z) < 3) continue
    if (getTerrainSlope(x, z) > 0.62) continue
    const scale = 0.45
    rocks.push({
      x,
      y: getTerrainHeight(x, z) + scale * 0.7 * 0.42,
      z,
      scale,
      stretchX: 1.1,
      stretchY: 0.7,
      stretchZ: 0.9,
      variant: index % 3,
      rotation: angle,
      tilt: 0.05,
      color: new THREE.Color(PALETTE.rockLight).lerp(new THREE.Color(PALETTE.rockDark), 0.25),
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

let boulderCache: { count: number; list: BoulderObstacle[] } | null = null

/**
 * Deterministic boulders (scale ≥ 0.8, including trail waymarks) shared with
 * PIP so the companion can climb over or around the only rocks tall enough
 * to reach its flight height. Same seeded generation as the rendered rocks.
 */
export function getBoulderObstacles(count = 120): BoulderObstacle[] {
  if (boulderCache && boulderCache.count === count) return boulderCache.list
  const list = createRocks(count)
    .filter((rock) => rock.scale >= 0.8)
    .map((rock) => ({
      x: rock.x,
      z: rock.z,
      radius: rock.scale * Math.max(rock.stretchX, rock.stretchZ) * 0.85,
      topY: rock.y + rock.scale * rock.stretchY * 0.5,
    }))
  boulderCache = { count, list }
  return list
}
