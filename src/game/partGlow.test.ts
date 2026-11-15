import { describe, expect, it } from 'vitest'
import { getPartGlow, type GlowInput } from './partGlow'

const base: GlowInput = {
  scannerActive: true,
  discovered: true,
  isNext: false,
  isAimed: false,
  isRecorded: false,
  hinted: false,
  hintKind: null,
  scanProgress: 0,
  pulse: 0.5,
}

describe('explorer part glow', () => {
  it('lights the part to find now, with an outline', () => {
    const level = getPartGlow({ ...base, isNext: true })
    expect(level.emissive).toBeGreaterThan(0)
    expect(level.outline).toBeGreaterThan(0.5)
  })

  it('keeps the other parts dark so there is only one to choose', () => {
    expect(getPartGlow(base).outline).toBe(0)
    expect(getPartGlow({ ...base, isRecorded: true, isNext: true }).outline).toBe(0)
  })

  it('stays off before the scanner is out or the explorer is known', () => {
    expect(getPartGlow({ ...base, isNext: true, scannerActive: false }).outline).toBe(0)
    expect(getPartGlow({ ...base, isNext: true, discovered: false }).outline).toBe(0)
  })

  it('brightens while the scan fills on the aimed part', () => {
    const start = getPartGlow({ ...base, isNext: true, isAimed: true, scanProgress: 0 })
    const end = getPartGlow({ ...base, isNext: true, isAimed: true, scanProgress: 1 })
    expect(end.emissive).toBeGreaterThan(start.emissive)
    expect(end.outline).toBe(1)
    expect(end.tone).toBe('aimed')
  })

  it('follows PIP when he points at a part', () => {
    expect(getPartGlow({ ...base, scannerActive: false, hinted: true, hintKind: 'hint' }).tone).toBe('hint')
  })
})
