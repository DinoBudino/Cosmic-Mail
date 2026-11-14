import { describe, expect, it } from 'vitest'
import { getSweepObjective, pickTraceHit, type TraceRayHit } from './fullScanSweep'
import { SPIRIT_TRACE_ANCHORS } from './spiritSite'
import { MEMORY_FRAGMENT_KINDS } from './fullScanReconstruction'

const hit = (over: Partial<TraceRayHit>): TraceRayHit => ({
  traceKind: null,
  componentId: null,
  distractorId: null,
  ignored: false,
  opaque: true,
  distance: 5,
  ...over,
})

describe('sweep trace picking', () => {
  it('picks the first unrevealed trace in range', () => {
    const pick = pickTraceHit(
      [hit({ traceKind: 'identity', ignored: true, opaque: false })],
      [],
      14,
    )
    expect(pick).toEqual({ kind: 'identity', index: 0 })
  })

  it('skips revealed traces and out-of-range ones', () => {
    const h = [hit({ traceKind: 'identity', ignored: true })]
    expect(pickTraceHit(h, ['identity'], 14)).toBeNull()
    expect(pickTraceHit([hit({ traceKind: 'identity', distance: 20 })], [], 14)).toBeNull()
  })

  it('is blocked by solid scenery but not by the explorer hit boxes', () => {
    const trace = hit({ traceKind: 'trajectory', ignored: true, distance: 6 })
    expect(pickTraceHit([hit({ distance: 3 }), trace], [], 14)).toBeNull()
    expect(
      pickTraceHit([hit({ distance: 3, componentId: 'x' }), trace], [], 14),
    ).not.toBeNull()
    expect(
      pickTraceHit([hit({ distance: 3, distractorId: 'y' }), trace], [], 14),
    ).not.toBeNull()
    expect(
      pickTraceHit([hit({ distance: 3, ignored: true }), trace], [], 14),
    ).not.toBeNull()
  })

  it('ignores hits that are not memory traces', () => {
    expect(pickTraceHit([hit({ traceKind: 'rock' })], [], 14)).toBeNull()
  })
})

describe('sweep data and objective', () => {
  it('has exactly one anchor per memory fragment', () => {
    expect(SPIRIT_TRACE_ANCHORS.map((a) => a.kind).sort()).toEqual(
      [...MEMORY_FRAGMENT_KINDS].sort(),
    )
  })

  it('walks the player from equipping to holding', () => {
    const base = { revealed: 1, coarsePointer: false }
    expect(getSweepObjective({ ...base, equipped: false, aiming: false }).text).toMatch(/Q/)
    expect(getSweepObjective({ ...base, equipped: true, aiming: false }).text).toMatch(/1\/4/)
    expect(getSweepObjective({ ...base, equipped: true, aiming: true }).text).toMatch(/Hold/)
  })

  it('never names the explorer', () => {
    const texts = [false, true].flatMap((aiming) =>
      [false, true].map(
        (equipped) => getSweepObjective({ equipped, aiming, revealed: 0, coarsePointer: true }).text,
      ),
    )
    expect(texts.join(' ')).not.toMatch(/spirit|rover/i)
  })
})
