import { afterEach, describe, expect, it } from 'vitest'
import { getMission } from './missions'
import { getReticleStatus } from './reticleStatus'
import { isPartScannableNow } from './scanMarkers'
import { getScanAnchors, setActiveExplorer, type ExplorerId } from './spiritSite'

const EXPLORERS: readonly ExplorerId[] = ['opportunity', 'spirit', 'viking-1', 'surveyor-3', 'apollo-11']

describe('parts hunt order', () => {
  afterEach(() => setActiveExplorer('opportunity'))

  it('numbers the markers in the same order as the clues and the tracker', () => {
    for (const explorer of EXPLORERS) {
      setActiveExplorer(explorer)
      const markers = getScanAnchors().map((anchor) => anchor.componentId)
      const clues = getMission(explorer).components.map((component) => component.id)
      expect(markers, explorer).toEqual(clues)
    }
  })

  it('only lets the next part be recorded, like the clues', () => {
    const order = ['a', 'b', 'c']
    expect(isPartScannableNow(order, [], 'a')).toBe(true)
    expect(isPartScannableNow(order, [], 'c')).toBe(false)
    expect(isPartScannableNow(order, ['a'], 'b')).toBe(true)
    expect(isPartScannableNow(order, ['a'], 'a')).toBe(false)
    expect(isPartScannableNow(order, ['a', 'b'], 'c')).toBe(true)
    // Parts outside the hunt (distractors) are not affected.
    expect(isPartScannableNow(order, [], 'antenna')).toBe(true)
  })

  it('tells the child a later part is not the one yet', () => {
    const base = { hasTarget: true, physicalState: 'valid', triggerHeld: false, recorded: false } as const
    expect(getReticleStatus({ ...base, later: true })).toBe('later')
    expect(getReticleStatus({ ...base, later: true, triggerHeld: true })).toBe('later')
    expect(getReticleStatus({ ...base, later: true, physicalState: 'out-of-range' })).toBe('out-of-range')
  })
})
