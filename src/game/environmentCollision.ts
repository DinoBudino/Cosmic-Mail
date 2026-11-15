import { ENVIRONMENTAL_SITES } from '../data/environmentalSites'
import { getActiveWorld } from '../data/spiritSite'
import { PLAYER } from './worldConfig'

/**
 * Solid footprint for the larger environmental rocks/outcrops. Flat soil and
 * wind features stay walkable so the player can inspect them closely.
 */
export function resolveEnvironmentalCollision(
  position: { x: number; z: number },
  airborne = 0,
): void {
  if (airborne > 1.4) return
  // The Mars outcrops are not on the Moon.
  if (getActiveWorld() === 'moon') return
  for (const site of ENVIRONMENTAL_SITES) {
    if (site.collisionRadius <= 0) continue
    const dx = position.x - site.position.x
    const dz = position.z - site.position.z
    const distance = Math.hypot(dx, dz)
    const minimum = site.collisionRadius + PLAYER.radius
    if (distance >= minimum) continue
    if (distance < 1e-4) {
      position.x = site.position.x + minimum
      continue
    }
    position.x = site.position.x + (dx / distance) * minimum
    position.z = site.position.z + (dz / distance) * minimum
  }
}
