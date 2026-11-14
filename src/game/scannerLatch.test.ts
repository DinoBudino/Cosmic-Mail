import { describe, expect, it } from 'vitest'
import {
  SCAN_TAP_MAX_MS,
  canLatchPointer,
  classifyScanPress,
  resolveScanRelease,
} from './scannerLatch'

describe('scanner latch (touch ergonomics)', () => {
  it('classifies short presses as taps and long ones as holds', () => {
    expect(classifyScanPress(80)).toBe('tap')
    expect(classifyScanPress(SCAN_TAP_MAX_MS - 1)).toBe('tap')
    expect(classifyScanPress(SCAN_TAP_MAX_MS)).toBe('hold')
    expect(classifyScanPress(900)).toBe('hold')
    expect(classifyScanPress(-5)).toBe('hold')
  })

  it('only touch and pen can latch', () => {
    expect(canLatchPointer('touch')).toBe(true)
    expect(canLatchPointer('pen')).toBe(true)
    expect(canLatchPointer('mouse')).toBe(false)
    expect(canLatchPointer('')).toBe(false)
  })

  const base = {
    pointerType: 'touch',
    durationMs: 100,
    hasTarget: true,
    startedLatched: false,
  }

  it('latches a quick touch tap on a valid target', () => {
    expect(resolveScanRelease(base)).toBe('latch')
  })

  it('releases when there is no target, or when it was a hold or a mouse click', () => {
    expect(resolveScanRelease({ ...base, hasTarget: false })).toBe('release')
    expect(resolveScanRelease({ ...base, durationMs: 700 })).toBe('release')
    expect(resolveScanRelease({ ...base, pointerType: 'mouse' })).toBe('release')
  })

  it('a press that started while latched only unlatches', () => {
    expect(resolveScanRelease({ ...base, startedLatched: true })).toBe('unlatch')
    expect(
      resolveScanRelease({ ...base, startedLatched: true, durationMs: 900 }),
    ).toBe('unlatch')
  })
})
