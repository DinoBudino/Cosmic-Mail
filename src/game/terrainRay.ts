/**
 * Ray against the terrain heightfield, without touching the terrain mesh.
 *
 * Raycasting the 115k-triangle ground mesh (plus every rock instance and the
 * skinned astronaut) each frame was what made scanner mode lag. The scanner
 * now only raycasts its real targets and asks this cheap march where the
 * ground is, so the ground still blocks targets behind hills and the arm
 * still aims at the sand. Pure: no Three.js, easy to test.
 */

export interface TerrainRayResult {
  distance: number
  x: number
  y: number
  z: number
}

export function terrainRayHit(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  far: number,
  heightAt: (x: number, z: number) => number,
  step = 0.35,
): TerrainRayResult | null {
  const above = (t: number) =>
    origin.y + direction.y * t -
    heightAt(origin.x + direction.x * t, origin.z + direction.z * t)
  if (above(0) <= 0) return null
  let previous = 0
  for (let t = step; t <= far + step; t += step) {
    const current = Math.min(t, far)
    if (above(current) <= 0) {
      // Refine between the last point above ground and this one.
      let low = previous
      let high = current
      for (let i = 0; i < 6; i += 1) {
        const mid = (low + high) / 2
        if (above(mid) > 0) low = mid
        else high = mid
      }
      const x = origin.x + direction.x * high
      const z = origin.z + direction.z * high
      return { distance: high, x, y: heightAt(x, z), z }
    }
    previous = current
    if (current >= far) break
  }
  return null
}
