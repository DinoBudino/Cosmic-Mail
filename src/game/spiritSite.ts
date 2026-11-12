import { SPIRIT_SITE } from '../data/spiritSite'
import type { WorldPosition } from '../data/marsObjects'
import { PLAYER } from './worldConfig'

export function distanceToSpirit(position: WorldPosition): number {
  return Math.hypot(
    position.x - SPIRIT_SITE.position.x,
    position.z - SPIRIT_SITE.position.z,
  )
}

export function findNearbySpirit(position: WorldPosition): boolean {
  return distanceToSpirit(position) <= SPIRIT_SITE.interactionRadius
}

/**
 * Pushes the player out of Spirit's provisional footprint. Like the
 * legacy site collision, this mutates x/z to avoid per-frame allocations.
 */
export function resolveSpiritCollision(position: WorldPosition): void {
  const dx = position.x - SPIRIT_SITE.position.x
  const dz = position.z - SPIRIT_SITE.position.z
  const distance = Math.hypot(dx, dz)
  const minimum = SPIRIT_SITE.collisionRadius + PLAYER.radius
  if (distance >= minimum) return

  if (distance < 1e-4) {
    position.x = SPIRIT_SITE.position.x + minimum
    return
  }

  position.x = SPIRIT_SITE.position.x + (dx / distance) * minimum
  position.z = SPIRIT_SITE.position.z + (dz / distance) * minimum
}
