import { MARS_WORLD_SITES, REGION_APPROACH_RADIUS, type MarsObjectId, type WorldPosition } from '../data/marsObjects'
import { PATH_WAYPOINTS, PLAYER } from './worldConfig'

/** Outer radii of the visible rings; rendering and interaction share this map. */
export const SITE_RADII: Readonly<Record<MarsObjectId, number>> = {
  opportunity: 2.7,
  insight: 3.1,
  ingenuity: 1.7,
  viking1: 2.6,
}

/** Approach trigger for PIP orientation (wider than the inspect ring). */
export function findNearbyRegion(position: WorldPosition): MarsObjectId | null {
  let nearest: MarsObjectId | null = null
  let distance = Infinity
  for (const object of MARS_WORLD_SITES) {
    const next = Math.hypot(position.x - object.position.x, position.z - object.position.z)
    if (next <= REGION_APPROACH_RADIUS && next < distance) {
      nearest = object.id
      distance = next
    }
  }
  return nearest
}

/** Solid footprint of each model. Always smaller than its interaction ring. */
export const SITE_COLLISION_RADII: Readonly<Record<MarsObjectId, number>> = {
  opportunity: 2.1,
  insight: 1.5,
  ingenuity: 0.9,
  viking1: 1.4,
}

const TRAVEL_STOP_MARGIN = 0.1

/**
 * Pushes a position out of the four important models while leaving enough room
 * inside every interaction ring. Mutates x/z to avoid per-frame allocations.
 */
export function resolveSiteCollision(position: WorldPosition): void {
  for (const object of MARS_WORLD_SITES) {
    const dx = position.x - object.position.x
    const dz = position.z - object.position.z
    const distance = Math.hypot(dx, dz)
    const minimum = SITE_COLLISION_RADII[object.id] + PLAYER.radius
    if (distance >= minimum) continue

    if (distance < 1e-4) {
      position.x = object.position.x + minimum
      continue
    }

    position.x = object.position.x + (dx / distance) * minimum
    position.z = object.position.z + (dz / distance) * minimum
  }
}

/** Stable catalog order breaks ties; coming-soon sites can still be inspected. */
export function findNearbySite(position: WorldPosition): MarsObjectId | null {
  let nearest: MarsObjectId | null = null
  let distance = Infinity
  for (const object of MARS_WORLD_SITES) {
    const next = Math.hypot(position.x - object.position.x, position.z - object.position.z)
    if (next <= SITE_RADII[object.id] && next < distance) {
      nearest = object.id
      distance = next
    }
  }
  return nearest
}

/**
 * Assisted travel follows PATH_WAYPOINTS — the same curved loop painted on
 * the terrain (Fase 4 · Paso 2, decisión nº 3). The visible route and the
 * walked route therefore share one source of truth. Steering is stateless:
 * it finds the closest point on the loop, then aims at a lookahead point
 * along the shorter arc towards the target, switching to a direct final
 * approach inside the last stretch so arrival in the ring is unchanged.
 */
const TRAVEL_LOOKAHEAD = 2.5
const TRAVEL_REJOIN_DISTANCE = 7

const SEGMENT_LENGTHS: number[] = []
const CUMULATIVE_LENGTHS: number[] = [0]
let PATH_TOTAL_LENGTH = 0
for (let index = 0; index < PATH_WAYPOINTS.length - 1; index += 1) {
  const from = PATH_WAYPOINTS[index]!
  const to = PATH_WAYPOINTS[index + 1]!
  const length = Math.hypot(to.x - from.x, to.z - from.z)
  SEGMENT_LENGTHS.push(length)
  PATH_TOTAL_LENGTH += length
  CUMULATIVE_LENGTHS.push(PATH_TOTAL_LENGTH)
}

function pointAtArcLength(arc: number): WorldPosition {
  const wrapped = ((arc % PATH_TOTAL_LENGTH) + PATH_TOTAL_LENGTH) % PATH_TOTAL_LENGTH
  let index = 0
  while (index < SEGMENT_LENGTHS.length - 1 && CUMULATIVE_LENGTHS[index + 1]! < wrapped) {
    index += 1
  }
  const from = PATH_WAYPOINTS[index]!
  const to = PATH_WAYPOINTS[index + 1]!
  const length = SEGMENT_LENGTHS[index]!
  const t = length === 0 ? 0 : (wrapped - CUMULATIVE_LENGTHS[index]!) / length
  return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }
}

function closestOnPath(position: WorldPosition): { point: WorldPosition; arc: number; distance: number } {
  let bestDistance = Number.POSITIVE_INFINITY
  let bestArc = 0
  let bestPoint = PATH_WAYPOINTS[0]!
  for (let index = 0; index < PATH_WAYPOINTS.length - 1; index += 1) {
    const from = PATH_WAYPOINTS[index]!
    const to = PATH_WAYPOINTS[index + 1]!
    const dx = to.x - from.x
    const dz = to.z - from.z
    const lengthSquared = dx * dx + dz * dz
    const t = lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((position.x - from.x) * dx + (position.z - from.z) * dz) / lengthSquared))
    const point = { x: from.x + dx * t, z: from.z + dz * t }
    const distance = Math.hypot(position.x - point.x, position.z - point.z)
    if (distance < bestDistance) {
      bestDistance = distance
      bestPoint = point
      bestArc = CUMULATIVE_LENGTHS[index]! + Math.sqrt(lengthSquared) * t
    }
  }
  return { point: bestPoint, arc: bestArc, distance: bestDistance }
}

function targetArcLength(target: WorldPosition): number {
  for (let index = 0; index < PATH_WAYPOINTS.length; index += 1) {
    const waypoint = PATH_WAYPOINTS[index]!
    if (Math.hypot(waypoint.x - target.x, waypoint.z - target.z) < 1e-6) {
      return CUMULATIVE_LENGTHS[index]!
    }
  }
  return PATH_TOTAL_LENGTH
}

/** Terrain-following travel along the shared route, stopping inside the ring. */
export function getAutoMove(position: WorldPosition, targetId: MarsObjectId) {
  const target = MARS_WORLD_SITES.find((object) => object.id === targetId)
  if (!target) return { x: 0, z: 0, arrived: true }
  const distance = Math.hypot(target.position.x - position.x, target.position.z - position.z)
  const remaining = distance - (SITE_RADII[targetId] - TRAVEL_STOP_MARGIN)
  if (remaining <= 0) return { x: 0, z: 0, arrived: true }

  const closest = closestOnPath(position)
  const targetArc = targetArcLength(target.position)
  const forwardArc = ((targetArc - closest.arc) % PATH_TOTAL_LENGTH + PATH_TOTAL_LENGTH) % PATH_TOTAL_LENGTH
  const travelDirection = forwardArc <= PATH_TOTAL_LENGTH - forwardArc ? 1 : -1

  // Passing through another site: the painted route touches its centre, but
  // the model footprint must be walked around, not through. Steer at a
  // tangent point on the side the player is already on until clear.
  for (const object of MARS_WORLD_SITES) {
    if (object.id === targetId) continue
    const radialX = position.x - object.position.x
    const radialZ = position.z - object.position.z
    const radialDistance = Math.hypot(radialX, radialZ)
    const minimum = SITE_COLLISION_RADII[object.id] + PLAYER.radius
    if (radialDistance >= minimum + 1.0) continue
    const ahead = pointAtArcLength(closest.arc + 0.5 * travelDirection)
    const behind = pointAtArcLength(closest.arc - 0.5 * travelDirection)
    let dirX = ahead.x - behind.x
    let dirZ = ahead.z - behind.z
    const dirLength = Math.hypot(dirX, dirZ) || 1
    dirX /= dirLength
    dirZ /= dirLength
    const perpX = -dirZ
    const perpZ = dirX
    // Already past the centre along the route: resume normal steering.
    if (dirX * radialX + dirZ * radialZ > 0.3) continue
    const side = perpX * radialX + perpZ * radialZ >= 0 ? 1 : -1
    const bypass = {
      x: object.position.x + perpX * side * (minimum + 0.8) + dirX * 2,
      z: object.position.z + perpZ * side * (minimum + 0.8) + dirZ * 2,
    }
    const bypassDx = bypass.x - position.x
    const bypassDz = bypass.z - position.z
    const bypassDistance = Math.hypot(bypassDx, bypassDz)
    if (bypassDistance < 1e-4) return { x: 0, z: 0, arrived: false }
    const bypassSpeed = Math.min(1, Math.max(0.2, remaining))
    return {
      x: bypassDx / bypassDistance * bypassSpeed,
      z: bypassDz / bypassDistance * bypassSpeed,
      arrived: false,
    }
  }

  let aim: WorldPosition
  if (closest.distance > TRAVEL_REJOIN_DISTANCE || remaining < TRAVEL_LOOKAHEAD + 2) {
    // Far from the route (or on the final stretch): head for the target,
    // rejoining the visible path when there is room to do so.
    aim = closest.distance > TRAVEL_REJOIN_DISTANCE && remaining >= TRAVEL_LOOKAHEAD + 2
      ? closest.point
      : target.position
  } else {
    aim = pointAtArcLength(closest.arc + travelDirection * TRAVEL_LOOKAHEAD)
  }

  const aimDx = aim.x - position.x
  const aimDz = aim.z - position.z
  const aimDistance = Math.hypot(aimDx, aimDz)
  if (aimDistance < 1e-4) return { x: 0, z: 0, arrived: true }
  const speed = Math.min(1, Math.max(0.2, remaining))
  return { x: aimDx / aimDistance * speed, z: aimDz / aimDistance * speed, arrived: false }
}
