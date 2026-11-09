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

describe('regional relief (Fase 4 · Paso 1)', () => {
  function ringStats(cx: number, cz: number) {
    const heights: number[] = []
    const slopes: number[] = []
    for (let dx = -16; dx <= 16; dx += 2) {
      for (let dz = -16; dz <= 16; dz += 2) {
        const distance = Math.hypot(dx, dz)
        if (distance < 8.5 || distance > 17) continue
        heights.push(getTerrainHeight(cx + dx, cz + dz))
        slopes.push(getTerrainSlope(cx + dx, cz + dz))
      }
    }
    const mean = heights.reduce((a, b) => a + b, 0) / heights.length
    const sd = Math.sqrt(
      heights.reduce((a, b) => a + (b - mean) ** 2, 0) / heights.length,
    )
    const meanSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length
    return { mean, sd, meanSlope }
  }

  const byId = (id: string) => MARS_OBJECTS.find((o) => o.id === id)!

  it('keeps every region traversable (gentle mean slope in its ring)', () => {
    for (const object of MARS_OBJECTS) {
      expect(ringStats(object.position.x, object.position.z).meanSlope).toBeLessThan(0.35)
    }
  })

  it('makes InSight the calmest plain and Ingenuity smooth', () => {
    const insight = byId('insight')
    const ingenuity = byId('ingenuity')
    const insightStats = ringStats(insight.position.x, insight.position.z)
    const ingenuityStats = ringStats(ingenuity.position.x, ingenuity.position.z)
    expect(insightStats.sd).toBeLessThan(0.35)
    expect(insightStats.meanSlope).toBeLessThan(ingenuityStats.meanSlope)
    expect(ingenuityStats.sd).toBeLessThan(0.5)
  })

  it('sinks Viking 1 into a depression and Opportunity into its valley', () => {
    const viking = byId('viking1')
    const opportunity = byId('opportunity')
    const insight = byId('insight')
    const vikingMean = ringStats(viking.position.x, viking.position.z).mean
    const opportunityMean = ringStats(opportunity.position.x, opportunity.position.z).mean
    const insightMean = ringStats(insight.position.x, insight.position.z).mean
    expect(vikingMean).toBeLessThan(opportunityMean)
    expect(opportunityMean).toBeLessThan(insightMean)
  })

  it('keeps wild ground more varied than the curated regions', () => {
    const wild = ringStats(0, 38)
    const insight = byId('insight')
    expect(wild.sd).toBeGreaterThan(ringStats(insight.position.x, insight.position.z).sd)
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

  it('is curved, not ruler-straight, and stays inside the playable radius', () => {
    // Fase 4 · Paso 2: the midpoint of the straight spawn→Opportunity line
    // must sit off the painted route, proving the loop is genuinely curved.
    const spawn = PATH_WAYPOINTS[0]!
    const opportunity = MARS_OBJECTS.find((o) => o.id === 'opportunity')!
    const straightMid = {
      x: (spawn.x + opportunity.position.x) / 2,
      z: (spawn.z + opportunity.position.z) / 2,
    }
    expect(distanceToPath(straightMid.x, straightMid.z)).toBeGreaterThan(0.5)
    for (const waypoint of PATH_WAYPOINTS) {
      expect(Math.hypot(waypoint.x, waypoint.z)).toBeLessThanOrEqual(WORLD.playRadius)
    }
  })

  it('grows with distance from the path', () => {
    const waypoint = PATH_WAYPOINTS[0]
    if (!waypoint) throw new Error('Expected a spawn waypoint')

    const near = distanceToPath(waypoint.x + 1, waypoint.z)
    const far = distanceToPath(waypoint.x + 9, waypoint.z)
    expect(far).toBeGreaterThan(near)
  })
})
