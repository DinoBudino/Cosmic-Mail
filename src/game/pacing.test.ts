import { describe, expect, it } from 'vitest'
import { buildPacingReport } from './pacing'

describe('pacing report', () => {
  it('is empty without marks', () => {
    expect(buildPacingReport([])).toEqual({ steps: [], totalMs: 0 })
  })

  it('computes cumulative and per-step durations', () => {
    const report = buildPacingReport([
      { name: 'new-game', at: 1000 },
      { name: 'phase:registration', at: 31_000 },
      { name: 'phase:hub', at: 41_400 },
      { name: 'first-control', at: 91_000 },
    ])
    expect(report.totalMs).toBe(90_000)
    expect(report.steps.map((s) => s.deltaMs)).toEqual([0, 30_000, 10_400, 49_600])
    expect(report.steps[2]?.sinceStartMs).toBe(40_400)
  })
})
