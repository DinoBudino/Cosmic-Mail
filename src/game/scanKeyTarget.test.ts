import { describe, expect, it } from 'vitest'
import { getScanKeyTarget } from './scanKeyTarget'

describe('floating "Press Q" target', () => {
  it('points at the practice rock while the practice step waits for the scanner', () => {
    expect(getScanKeyTarget('M2', 'scanner-key')).toBe('practice-rock')
  })
  it('points at the explorer while the parts hunt waits for the scanner', () => {
    expect(getScanKeyTarget('M4', 'scanner-key')).toBe('explorer')
  })
  it('hides once the scanner is out or the objective is something else', () => {
    expect(getScanKeyTarget('M2', 'sample')).toBeNull()
    expect(getScanKeyTarget('M4', 'hold')).toBeNull()
    expect(getScanKeyTarget('M1', 'radar')).toBeNull()
  })
})
