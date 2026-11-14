import { describe, expect, it } from 'vitest'
import {
  BEAM_END_INSET,
  approachAlpha,
  computeBeamSegment,
} from './scannerBeamSegment'

describe('computeBeamSegment', () => {
  it('starts at the emitter and stops just before the impact point', () => {
    const seg = computeBeamSegment({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -10 })
    expect(seg).not.toBeNull()
    expect(seg!.length).toBeCloseTo(10 - BEAM_END_INSET, 6)
    expect(seg!.direction).toEqual({ x: 0, y: 0, z: -1 })
    // Segment runs from z=0 to z=-(10 - inset): centre is halfway.
    expect(seg!.center.z).toBeCloseTo(-(10 - BEAM_END_INSET) / 2, 6)
  })

  it('returns a unit direction for diagonal beams', () => {
    const seg = computeBeamSegment({ x: 1, y: 0, z: 1 }, { x: 4, y: 4, z: 1 })!
    const { x, y, z } = seg.direction
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6)
  })

  it('draws nothing for degenerate or tiny segments', () => {
    expect(
      computeBeamSegment({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
    ).toBeNull()
    expect(
      computeBeamSegment({ x: 0, y: 0, z: 0 }, { x: 0.05, y: 0, z: 0 }),
    ).toBeNull()
    expect(
      computeBeamSegment({ x: 0, y: 0, z: 0 }, { x: Number.NaN, y: 0, z: 0 }),
    ).toBeNull()
  })
})

describe('approachAlpha', () => {
  it('fades in and out monotonically and settles exactly', () => {
    let a = 0
    for (let i = 0; i < 120; i += 1) a = approachAlpha(a, 1, 1 / 60)
    expect(a).toBe(1)
    for (let i = 0; i < 120; i += 1) a = approachAlpha(a, 0, 1 / 60)
    expect(a).toBe(0)
  })
})
