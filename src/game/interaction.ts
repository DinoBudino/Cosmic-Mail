import { MARS_OBJECTS, type MarsObjectId, type WorldPosition } from '../data/marsObjects'

/** Outer radii of the visible rings; rendering and interaction share this map. */
export const SITE_RADII: Readonly<Record<MarsObjectId, number>> = {
  opportunity: 2.7,
  insight: 3.1,
  ingenuity: 1.7,
  viking1: 2.6,
}

/** Stable catalog order breaks ties; coming-soon sites can still be inspected. */
export function findNearbySite(position: WorldPosition): MarsObjectId | null {
  let nearest: MarsObjectId | null = null
  let distance = Infinity
  for (const object of MARS_OBJECTS) {
    const next = Math.hypot(position.x - object.position.x, position.z - object.position.z)
    if (next <= SITE_RADII[object.id] && next < distance) {
      nearest = object.id
      distance = next
    }
  }
  return nearest
}

/** Direct terrain-following travel, stopping just inside the destination ring. */
export function getAutoMove(position: WorldPosition, targetId: MarsObjectId) {
  const target = MARS_OBJECTS.find((object) => object.id === targetId)!
  const dx = target.position.x - position.x
  const dz = target.position.z - position.z
  const distance = Math.hypot(dx, dz)
  const remaining = distance - (SITE_RADII[targetId] - 0.25)
  if (remaining <= 0) return { x: 0, z: 0, arrived: true }
  const speed = Math.min(1, Math.max(0.2, remaining))
  return { x: dx / distance * speed, z: dz / distance * speed, arrived: false }
}
