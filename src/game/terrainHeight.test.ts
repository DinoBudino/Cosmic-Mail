import { describe, expect, it } from 'vitest'
import { MARS_OBJECTS } from '../data/marsObjects'
import {
  distanceToPath,
  getTerrainHeight,
  getTerrainSlope,
  slopeSpeedFactor,
} from './terrainHeight'
import { PATH_WAYPOINTS, WORLD } from './worldConfig'

function expectClose(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

describe('getTerrainHeight', () => {
  it('is deterministic for the same coordinates', () => {
    const samples = [
      [0, 0],
      [12.5, -8.25],
      [-33.1, 41.7],
      [80, 80],
    ] as const

    for (const [x, z] of samples) {
      expect(getTerrainHeight(x, z)).toBe(getTerrainHeight(x, z))
    }
  })

  it('returns finite heights across the playable area', () => {
    for (let x = -WORLD.playRadius; x <= WORLD.playRadius; x += 5) {
      for (let z = -WORLD.playRadius; z <= WORLD.playRadius; z += 5) {
        expect(Number.isFinite(getTerrainHeight(x, z))).toBe(true)
      }
    }
  })

  it('keeps a flat clearing around every Mars site', () => {
    for (const object of MARS_OBJECTS) {
      const center = getTerrainHeight(object.position.x, object.position.z)
      const offsets = [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [1.4, 1.4],
      ] as const

      for (const [dx, dz] of offsets) {
        expectClose(
          getTerrainHeight(object.position.x + dx, object.position.z + dz),
          center,
          1e-9,
        )
      }
    }
  })

  it('keeps a flat clearing around the spawn point', () => {
    const center = getTerrainHeight(WORLD.spawn.x, WORLD.spawn.z)
    for (const [dx, dz] of [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ] as const) {
      expectClose(
        getTerrainHeight(WORLD.spawn.x + dx, WORLD.spawn.z + dz),
        center,
        1e-9,
      )
    }
  })

  it('is continuous between nearby samples', () => {
    const step = 0.05
    for (let x = -30; x <= 30; x += 1.3) {
      for (let z = -30; z <= 30; z += 1.3) {
        const here = getTerrainHeight(x, z)
        const nextX = getTerrainHeight(x + step, z)
        const nextZ = getTerrainHeight(x, z + step)
        expect(Math.abs(nextX - here)).toBeLessThan(0.3)
        expect(Math.abs(nextZ - here)).toBeLessThan(0.3)
      }
    }
  })
})

describe('getTerrainSlope', () => {
  it('reports nearly level ground at the cleared sites', () => {
    for (const object of MARS_OBJECTS) {
      expect(
        getTerrainSlope(object.position.x, object.position.z),
      ).toBeLessThan(0.05)
    }
  })
})

describe('slopeSpeedFactor', () => {
  it('keeps full speed on level ground', () => {
    expect(slopeSpeedFactor(0)).toBe(1)
    expect(slopeSpeedFactor(0.2)).toBe(1)
  })

  it('slows the player gently as the slope grows', () => {
    const moderate = slopeSpeedFactor(0.6)
    const steep = slopeSpeedFactor(1.2)
    expect(moderate).toBeLessThan(1)
    expect(steep).toBeLessThan(moderate)
  })

  it('never drops below the minimum factor', () => {
    expect(slopeSpeedFactor(50)).toBeGreaterThanOrEqual(0.35)
    expect(slopeSpeedFactor(Number.POSITIVE_INFINITY)).toBe(0.35)
  })
})

describe('distanceToPath', () => {
  it('is zero at every path waypoint', () => {
    for (const waypoint of PATH_WAYPOINTS) {
      expectClose(distanceToPath(waypoint.x, waypoint.z), 0, 1e-9)
    }
  })

  it('is zero along a segment midpoint', () => {
    const from = PATH_WAYPOINTS[0]
    const to = PATH_WAYPOINTS[1]
    if (!from || !to) throw new Error('Expected at least two waypoints')

    expectClose(
      distanceToPath((from.x + to.x) / 2, (from.z + to.z) / 2),
      0,
      1e-9,
    )
  })

  it('grows with distance from the path', () => {
    const waypoint = PATH_WAYPOINTS[0]
    if (!waypoint) throw new Error('Expected a spawn waypoint')

    const near = distanceToPath(waypoint.x + 1, waypoint.z)
    const far = distanceToPath(waypoint.x + 9, waypoint.z)
    expect(far).toBeGreaterThan(near)
  })
})
