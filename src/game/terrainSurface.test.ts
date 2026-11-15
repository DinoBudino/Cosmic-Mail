import { describe, expect, it } from 'vitest'
import { getTerrainHeight } from './terrainHeight'
import { buildTerrainRingGeometry, terrainNormal } from './terrainSurface'
import { WORLD } from './worldConfig'

describe('terrain normal', () => {
  it('points straight up on the flattened landing zone', () => {
    const normal = terrainNormal(WORLD.spawn.x, WORLD.spawn.z)
    expect(normal.y).toBeGreaterThan(0.999)
    expect(Math.abs(normal.x)).toBeLessThan(0.01)
  })

  it('leans away from rising ground so rocks sit on the slope', () => {
    // Find a gentle slope inside the playable area.
    let spot: { x: number; z: number } | null = null
    for (let x = -60; x <= 60 && !spot; x += 6) {
      for (let z = -60; z <= 60; z += 6) {
        const here = getTerrainHeight(x, z)
        const rise =
          Math.abs(getTerrainHeight(x + 1, z) - here) +
          Math.abs(getTerrainHeight(x, z + 1) - here)
        if (rise > 0.12 && rise < 0.35) {
          spot = { x, z }
          break
        }
      }
    }
    expect(spot).not.toBeNull()
    const normal = terrainNormal(spot!.x, spot!.z)
    expect(normal.length()).toBeCloseTo(1, 6)
    expect(normal.y).toBeLessThan(0.999)
    // The horizontal component points downhill, opposite the rising ground.
    const uphillX = getTerrainHeight(spot!.x + 1, spot!.z) - getTerrainHeight(spot!.x - 1, spot!.z)
    expect(Math.sign(normal.x)).toBe(-Math.sign(uphillX))
  })
})

describe('terrain ring geometry', () => {
  const readRing = (x: number, z: number, segments = 48) => {
    const baseY = getTerrainHeight(x, z)
    const lift = 0.06
    const geometry = buildTerrainRingGeometry({
      x,
      z,
      baseY,
      innerRadius: 1.4,
      outerRadius: 1.7,
      segments,
      lift,
    })
    const position = geometry.getAttribute('position')
    const vertices = []
    for (let index = 0; index < position.count; index += 1) {
      const worldX = x + position.getX(index)
      const worldZ = z + position.getZ(index)
      vertices.push({
        localY: position.getY(index),
        expectedY: getTerrainHeight(worldX, worldZ) - baseY + lift,
      })
    }
    geometry.dispose()
    return vertices
  }

  it('keeps every vertex exactly one lift above the terrain', () => {
    for (const spot of [
      { x: WORLD.spawn.x, z: WORLD.spawn.z },
      { x: 24, z: 52 },
      { x: -52, z: 20 },
    ]) {
      for (const vertex of readRing(spot.x, spot.z)) {
        expect(vertex.localY).toBeCloseTo(vertex.expectedY, 6)
      }
    }
  })

  it('drapes over a slope instead of staying a flat disc', () => {
    let spot: { x: number; z: number } | null = null
    for (let x = -60; x <= 60 && !spot; x += 6) {
      for (let z = -60; z <= 60; z += 6) {
        const here = getTerrainHeight(x, z)
        const rise =
          Math.abs(getTerrainHeight(x + 1, z) - here) +
          Math.abs(getTerrainHeight(x, z + 1) - here)
        if (rise > 0.2 && rise < 0.6) {
          spot = { x, z }
          break
        }
      }
    }
    expect(spot).not.toBeNull()
    const heights = readRing(spot!.x, spot!.z).map(
      (vertex) => vertex.localY,
    )
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.05)
  })
})
