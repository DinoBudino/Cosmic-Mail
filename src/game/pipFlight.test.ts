import { describe, expect, it } from 'vitest'
import {
  hoverHeight,
  pickLookTarget,
  PIP_MIN_PLAYER_DISTANCE,
  PIP_SIDE_DISTANCE,
  pushOutOfCylinders,
  randomLookDuration,
  randomLookInterval,
  sideAnchor,
} from './pipFlight'
import { getTerrainHeight } from './terrainHeight'

describe('sideAnchor', () => {
  it('places PIP beside the player, slightly forward, never behind', () => {
    const anchor = sideAnchor({ x: 10, z: 10 }, { x: 0, z: -1 }, 1)
    expect(anchor.x).toBeCloseTo(10 + PIP_SIDE_DISTANCE, 9)
    expect(anchor.z).toBeCloseTo(10 - 0.25, 9)
    const other = sideAnchor({ x: 10, z: 10 }, { x: 0, z: -1 }, -1)
    expect(other.x).toBeCloseTo(10 - PIP_SIDE_DISTANCE, 9)
  })

  it('rotates with the direction of travel', () => {
    const anchor = sideAnchor({ x: 0, z: 0 }, { x: 1, z: 0 }, 1)
    expect(anchor.z).toBeCloseTo(PIP_SIDE_DISTANCE, 9)
    expect(anchor.x).toBeCloseTo(0.25, 9)
  })
})

describe('pushOutOfCylinders', () => {
  const cylinder = { x: 0, z: 0, radius: 2 }

  it('leaves points outside untouched', () => {
    expect(pushOutOfCylinders({ x: 3, z: 0 }, [cylinder])).toEqual({ x: 3, z: 0 })
  })

  it('pushes points inside out to the boundary', () => {
    const pushed = pushOutOfCylinders({ x: 1, z: 0 }, [cylinder])
    expect(Math.hypot(pushed.x, pushed.z)).toBeCloseTo(2, 9)
  })

  it('handles the degenerate centre deterministically', () => {
    expect(pushOutOfCylinders({ x: 0, z: 0 }, [cylinder])).toEqual({ x: 2, z: 0 })
  })

  it('keeps PIP_MIN_PLAYER_DISTANCE as a valid bubble radius', () => {
    expect(PIP_MIN_PLAYER_DISTANCE).toBeGreaterThan(1)
  })
})

describe('observation pauses', () => {
  it('uses irregular intervals, never a fixed period', () => {
    const sequence = [0, 0.5, 0.99, 0.25]
    let index = 0
    const random = () => sequence[index++ % sequence.length]!
    const intervals = [0, 1, 2, 3].map(() => randomLookInterval(random))
    expect(new Set(intervals).size).toBe(4)
    for (const interval of intervals) {
      expect(interval).toBeGreaterThanOrEqual(5)
      expect(interval).toBeLessThanOrEqual(18)
    }
  })

  it('keeps look durations long enough to feel like real looking', () => {
    expect(randomLookDuration(() => 0)).toBeCloseTo(2.8, 9)
    expect(randomLookDuration(() => 0.99)).toBeLessThan(5.6)
    expect(randomLookDuration(() => 0.99)).toBeGreaterThan(4)
  })

  it('sometimes picks the nearest site, sometimes the horizon', () => {
    const sites = [{ x: 3, z: 0 }, { x: 100, z: 100 }]
    const sitePick = pickLookTarget({ x: 0, z: 0 }, sites, () => 0.1)
    expect(sitePick).toEqual({ x: 3, z: 0 })
    const horizonPick = pickLookTarget({ x: 0, z: 0 }, sites, () => 0.9)
    const distance = Math.hypot(horizonPick.x, horizonPick.z)
    expect(distance).toBeGreaterThanOrEqual(18)
    expect(distance).toBeLessThanOrEqual(32)
  })
})

describe('hoverHeight', () => {
  it('never flies below the terrain plus hover at goal or ahead', () => {
    const goal = { x: 5, z: -3 }
    const ahead = { x: 6, z: -3 }
    const height = hoverHeight(goal, ahead)
    expect(height).toBeGreaterThanOrEqual(getTerrainHeight(goal.x, goal.z) + 1)
    expect(height).toBeGreaterThanOrEqual(getTerrainHeight(ahead.x, ahead.z) + 1)
  })

  it('is finite across the world', () => {
    for (let x = -60; x <= 60; x += 10) {
      for (let z = -60; z <= 60; z += 10) {
        expect(Number.isFinite(hoverHeight({ x, z }, { x: x + 1, z }))).toBe(true)
      }
    }
  })
})
