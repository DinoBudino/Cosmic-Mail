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
const pointing = (target: string, place = 'cabin') =>
  HUB_TOUR_STEPS.findIndex((step) => step.target === target && step.place === place)

describe('guided hub tour', () => {
  it('never waits for the child on the steps PIP shows himself', () => {
    const album = { ...closed, albumOpen: true }
    // PIP opened the album: its lines stay put until the child moves on.
    for (const [index, step] of HUB_TOUR_STEPS.entries()) {
      if (step.place === 'album') expect(tourIndexFor(HUB_TOUR_STEPS, index, album)).toBe(index)
    }
    expect(tourIndexFor(HUB_TOUR_STEPS, pointing('album'), closed)).toBe(pointing('album'))
    expect(tourIndexFor(HUB_TOUR_STEPS, pointing('nav'), closed)).toBe(pointing('nav'))
  })

  it('jumps ahead when the child opens what PIP points at first', () => {
    expect(tourIndexFor(HUB_TOUR_STEPS, pointing('album'), { ...closed, albumOpen: true })).toBe(
      pointing('album') + 1,
    )
    expect(tourIndexFor(HUB_TOUR_STEPS, pointing('nav'), { ...closed, routeOpen: true })).toBe(
      pointing('nav') + 1,
    )
    const closeLine = pointing('album-close', 'album')
    expect(tourIndexFor(HUB_TOUR_STEPS, closeLine, closed)).toBe(closeLine + 1)
  })

  it('waits for the child to pick a place to fly to', () => {
    const nav = { ...closed, routeOpen: true }
    expect(tourIndexFor(HUB_TOUR_STEPS, at('destination'), nav)).toBe(at('destination'))
    expect(
      tourIndexFor(HUB_TOUR_STEPS, at('destination'), { ...nav, selectedDestination: 'mars' }),
    ).toBe(at('destination') + 1)
  })

  it('goes back to the opening line if the album or navigation closes mid-tour', () => {
    const stamps = HUB_TOUR_STEPS.findIndex((step) => step.albumTab === 'stamps')
    expect(tourIndexFor(HUB_TOUR_STEPS, stamps, closed)).toBe(pointing('album'))
    expect(tourIndexFor(HUB_TOUR_STEPS, at('confirm'), closed)).toBe(pointing('nav'))
    // Inside navigation without a selected place, the details step returns
    // to "pick a place".
    expect(
      tourIndexFor(HUB_TOUR_STEPS, at('confirm'), { ...closed, routeOpen: true }),
    ).toBe(at('destination'))
  })
})
