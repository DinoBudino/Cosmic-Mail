import { getTerrainHeight } from './terrainHeight'

export interface PipPoint {
  x: number
  z: number
}

export interface CylinderObstacle {
  x: number
  z: number
  radius: number
}

export const PIP_SIDE_DISTANCE = 1.4
export const PIP_FORWARD_DISTANCE = 0.25
export const PIP_HOVER = 1.05
export const PIP_MIN_PLAYER_DISTANCE = 1.15

/** Anchor point beside the player: lateral offset plus a slight forward bias. */
export function sideAnchor(
  player: PipPoint,
  forward: PipPoint,
  side: 1 | -1,
): PipPoint {
  // Left perpendicular of the (normalized) forward vector.
  const lateralX = -forward.z
  const lateralZ = forward.x
  return {
    x: player.x + lateralX * side * PIP_SIDE_DISTANCE + forward.x * PIP_FORWARD_DISTANCE,
    z: player.z + lateralZ * side * PIP_SIDE_DISTANCE + forward.z * PIP_FORWARD_DISTANCE,
  }
}

/**
 * Pushes a point out of every cylinder (site footprints). Deterministic:
 * a point exactly at a centre is pushed towards +x. Mutates nothing.
 */
export function pushOutOfCylinders(
  point: PipPoint,
  cylinders: readonly CylinderObstacle[],
): PipPoint {
  let { x, z } = point
  for (const cylinder of cylinders) {
    const dx = x - cylinder.x
    const dz = z - cylinder.z
    const distance = Math.hypot(dx, dz)
    if (distance >= cylinder.radius) continue
    if (distance < 1e-4) {
      x = cylinder.x + cylinder.radius
      z = cylinder.z
    } else {
      x = cylinder.x + (dx / distance) * cylinder.radius
      z = cylinder.z + (dz / distance) * cylinder.radius
    }
  }
  return { x, z }
}

/**
 * Idle observation pauses: deliberately irregular intervals and varied
 * targets (a nearby site or a point on the horizon) so the behaviour reads
 * as curiosity, never as a fixed animation loop.
 */
export function randomLookInterval(random: () => number): number {
  return 5 + random() * 13
}

export function randomLookDuration(random: () => number): number {
  return 2.8 + random() * 2.7
}

export function pickLookTarget(
  player: PipPoint,
  sites: readonly PipPoint[],
  random: () => number,
): PipPoint {
  if (sites.length > 0 && random() < 0.45) {
    let nearest = sites[0]!
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const site of sites) {
      const distance = Math.hypot(site.x - player.x, site.z - player.z)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = site
      }
    }
    return nearest
  }
  const angle = random() * Math.PI * 2
  const distance = 18 + random() * 14
  return {
    x: player.x + Math.cos(angle) * distance,
    z: player.z + Math.sin(angle) * distance,
  }
}

/**
 * Hover height anticipating the ground ahead: the higher of the terrain at
 * the goal and one step beyond it, plus the hover offset. PIP therefore
 * climbs before a rise instead of clipping it.
 */
export function hoverHeight(goal: PipPoint, ahead: PipPoint): number {
  return Math.max(getTerrainHeight(goal.x, goal.z), getTerrainHeight(ahead.x, ahead.z)) + PIP_HOVER
}
