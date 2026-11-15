import { describe, expect, it } from 'vitest'
import {
  buildRockGeometry,
  getBoulderObstacles,
  resolveBoulderCollision,
} from './landscape'
import { PLAYER } from './worldConfig'

describe('stylized landscape', () => {
  it('builds distinct, smooth, light rock shapes without invalid normals', () => {
    const geometries = [0, 1, 2].map(buildRockGeometry)
    const shapes = geometries.map((geometry) =>
      Array.from(geometry.getAttribute('position').array.slice(0, 30)).join(','),
    )
    expect(new Set(shapes).size).toBe(3)
    for (const geometry of geometries) {
      // Indexed (shared vertices) means smooth shading, not faceted polygons.
      expect(geometry.index).not.toBeNull()
      expect(geometry.getAttribute('color')).toBeDefined()
      expect(geometry.index!.count / 3).toBeLessThanOrEqual(1280)
      expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
      geometry.dispose()
    }
  })
})

describe('boulder collisions', () => {
  it('pushes a grounded player out of a boulder footprint', () => {
    const boulder = getBoulderObstacles().find(
      (obstacle) => obstacle.radius > 1,
    )
    if (!boulder) throw new Error('Expected at least one large boulder test')
    const position = { x: boulder.x, z: boulder.z }
    resolveBoulderCollision(position, 0)
    expect(Math.hypot(position.x - boulder.x, position.z - boulder.z)).toBeGreaterThanOrEqual(
      boulder.radius + PLAYER.radius - 1e-9,
    )
  })

  it('lets a player flying above the boulder pass over it', () => {
    const boulder = getBoulderObstacles().find(
      (obstacle) => obstacle.radius > 1,
    )
    if (!boulder) throw new Error('Expected at least one large boulder test')
    const position = { x: boulder.x, z: boulder.z }
    resolveBoulderCollision(position, boulder.topY + 1)
    expect(position).toEqual({ x: boulder.x, z: boulder.z })
  })
})
