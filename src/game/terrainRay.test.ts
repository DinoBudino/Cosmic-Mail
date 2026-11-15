import { describe, expect, it } from 'vitest'
import { terrainRayHit } from './terrainRay'

const flat = () => 0

describe('terrain ray', () => {
  it('finds flat ground below a downward ray', () => {
    const hit = terrainRayHit(
      { x: 0, y: 2, z: 0 },
      { x: 0, y: -Math.SQRT1_2, z: -Math.SQRT1_2 },
      28,
      flat,
    )
    expect(hit).not.toBeNull()
    expect(hit!.distance).toBeCloseTo(2 * Math.SQRT2, 1)
    expect(hit!.z).toBeCloseTo(-2, 1)
  })

  it('misses when the ground is beyond the ray length or the ray goes up', () => {
    expect(
      terrainRayHit({ x: 0, y: 2, z: 0 }, { x: 0, y: 0.2, z: -0.98 }, 28, flat),
    ).toBeNull()
    expect(
      terrainRayHit({ x: 0, y: 20, z: 0 }, { x: 0, y: -0.1, z: -0.99 }, 28, flat),
    ).toBeNull()
  })

  it('stops at a hill in front of the target', () => {
    const hill = (_x: number, z: number) => (z < -5 && z > -7 ? 3 : 0)
    const hit = terrainRayHit(
      { x: 0, y: 1.6, z: 0 },
      { x: 0, y: 0, z: -1 },
      28,
      hill,
    )
    expect(hit!.distance).toBeGreaterThan(4.9)
    expect(hit!.distance).toBeLessThan(5.4)
  })
})
