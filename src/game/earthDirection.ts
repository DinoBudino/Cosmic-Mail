import { getActiveExplorer, getActiveWorld, getScanStationView } from '../data/spiritSite'
import { LUNAR_SITES } from './lunarGround'

/**
 * Direction (unit vector) of Earth in this landing site's sky, used when a
 * story is sent home. On the Moon it is the real Earth drawn in the sky;
 * from Mars Earth is only a tiny star, so the message heads for open sky
 * above the explorer, as seen from the child's side.
 */
export function getEarthDirection(): { x: number; y: number; z: number } {
  if (getActiveWorld() === 'moon') {
    const site = LUNAR_SITES[getActiveExplorer() as keyof typeof LUNAR_SITES]
    if (site) {
      const { x, y, z } = site.earth
      const l = Math.hypot(x, y, z) || 1
      return { x: x / l, y: y / l, z: z / l }
    }
  }
  const side = getScanStationView().direction
  const x = -side.x * 0.75
  const z = -side.z * 0.75
  const y = 0.66
  const l = Math.hypot(x, y, z) || 1
  return { x: x / l, y: y / l, z: z / l }
}
