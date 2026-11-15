import { describe, expect, it } from 'vitest'
import { isAdvanceClickTarget, isAdvanceKey } from './useAdvanceAnywhere'

/** Minimal stand-in for a DOM element: `closest` matches when `control`. */
function el(control: boolean) {
  return { closest: () => (control ? {} : null) }
}

describe('click anywhere to advance PIP', () => {
  it('advances on empty space, never on a control with its own action', () => {
    expect(isAdvanceClickTarget(el(false))).toBe(true)
    expect(isAdvanceClickTarget(el(true))).toBe(false)
    // The 3D canvas or the window itself count as "anywhere".
    expect(isAdvanceClickTarget(null)).toBe(true)
    expect(isAdvanceClickTarget({})).toBe(true)
  })

  it('takes Space and Enter, but not repeats or keys a focused control owns', () => {
    expect(isAdvanceKey(' ', false, el(false))).toBe(true)
    expect(isAdvanceKey('Enter', false, null)).toBe(true)
    expect(isAdvanceKey('Enter', true, null)).toBe(false)
    expect(isAdvanceKey('a', false, null)).toBe(false)
    expect(isAdvanceKey(' ', false, el(true))).toBe(false)
  })
})
