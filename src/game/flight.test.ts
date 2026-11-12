import { describe, expect, it } from 'vitest'
import { isFlightUnlocked } from './flight'

describe('ground-survey flight rule', () => {
  it('locks flight until the memory is recovered', () => {
    expect(isFlightUnlocked(null)).toBe(false)
    expect(isFlightUnlocked({ memoryRecoveredAt: null })).toBe(false)
    expect(isFlightUnlocked({ memoryRecoveredAt: 1000 })).toBe(true)
  })
})
