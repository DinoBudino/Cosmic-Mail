import { describe, expect, it } from 'vitest'
import { HUB_TOUR_STEPS } from '../data/onboardingNarrative'
import { tourIndexFor } from './hubFocus'

const closed = {
  albumOpen: false,
  routeOpen: false,
  albumTab: 'missions',
  selectedDestination: null,
}
const at = (awaits: string) => HUB_TOUR_STEPS.findIndex((step) => step.awaits === awaits)

describe('guided hub tour', () => {
  it('waits on every guided step until the child does what PIP asks', () => {
    expect(tourIndexFor(HUB_TOUR_STEPS, at('album'), closed)).toBe(at('album'))
    expect(tourIndexFor(HUB_TOUR_STEPS, at('album'), { ...closed, albumOpen: true })).toBe(
      at('album') + 1,
    )
    const album = { ...closed, albumOpen: true }
    expect(tourIndexFor(HUB_TOUR_STEPS, at('tab-stamps'), album)).toBe(at('tab-stamps'))
    expect(
      tourIndexFor(HUB_TOUR_STEPS, at('tab-stamps'), { ...album, albumTab: 'stamps' }),
    ).toBe(at('tab-stamps') + 1)
    expect(tourIndexFor(HUB_TOUR_STEPS, at('album-close'), album)).toBe(at('album-close'))
    expect(tourIndexFor(HUB_TOUR_STEPS, at('album-close'), closed)).toBe(at('album-close') + 1)

    const nav = { ...closed, routeOpen: true }
    expect(tourIndexFor(HUB_TOUR_STEPS, at('nav'), nav)).toBe(at('nav') + 1)
    expect(tourIndexFor(HUB_TOUR_STEPS, at('destination'), nav)).toBe(at('destination'))
    expect(
      tourIndexFor(HUB_TOUR_STEPS, at('destination'), { ...nav, selectedDestination: 'mars' }),
    ).toBe(at('destination') + 1)
  })

  it('goes back to the opening step if the album or navigation closes mid-tour', () => {
    expect(tourIndexFor(HUB_TOUR_STEPS, at('tab-stamps'), closed)).toBe(at('album'))
    expect(tourIndexFor(HUB_TOUR_STEPS, at('confirm'), closed)).toBe(at('nav'))
    // Inside navigation without a selected place, the details step returns
    // to "pick a place".
    expect(
      tourIndexFor(HUB_TOUR_STEPS, at('confirm'), { ...closed, routeOpen: true }),
    ).toBe(at('destination'))
  })
})
