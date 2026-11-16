import { describe, expect, it } from 'vitest'
import {
  prepareSmartLetter,
  scanComponent,
  transmitLetter,
  markMissionDiscovered,
} from '../store/journeyLogic'
import { createJourney, type JourneySave } from '../store/journeySchema'
import { hasPriorFieldWork } from './arrivalProtocol'
import {
  MARS_LANDING_SITES,
  getLandingSiteProgress,
  getLandingSiteState,
  getOrbitGuidance,
  rotationToFace,
  siteDirection,
} from './marsLandingSites'
import { getMission } from './missions'
import type { MarsExplorerId } from './spiritSite'

function finish(save: JourneySave, id: MarsExplorerId, send: boolean): JourneySave {
  let next = markMissionDiscovered(save, id, 1100)
  for (const component of getMission(id).components) {
    next = scanComponent(next, id, component.id, 2000).save
  }
  next = prepareSmartLetter(next, id, 3000).save
  return send ? transmitLetter(next, id, 4000).save : next
}

describe('Mars orbit', () => {
  it('shows each area as a percentage, 100 only once the story is sent', () => {
    const fresh = createJourney('Ada', 1000)
    expect(getLandingSiteProgress(fresh, 'opportunity')).toBe(0)
    const found = markMissionDiscovered(fresh, 'opportunity', 1100)
    expect(getLandingSiteProgress(found, 'opportunity')).toBe(17)
    const sealed = finish(fresh, 'opportunity', false)
    expect(getLandingSiteProgress(sealed, 'opportunity')).toBe(83)
    expect(getLandingSiteProgress(finish(fresh, 'opportunity', true), 'opportunity')).toBe(100)
    expect(getLandingSiteProgress(sealed, 'spirit')).toBe(0)
  })

  it('offers three NASA landing sites: Opportunity, Spirit and Viking 1', () => {
    expect(MARS_LANDING_SITES.map((s) => s.explorer)).toEqual(['opportunity', 'spirit', 'viking-1'])
    expect(MARS_LANDING_SITES.map((s) => s.place)).toEqual([
      'Meridiani Planum',
      'Gusev Crater',
      'Chryse Planitia',
    ])
  })

  it('never names an explorer before it is found', () => {
    const save = createJourney('Ada', 1000)
    for (const site of MARS_LANDING_SITES) {
      expect(getLandingSiteState(save, site.explorer)).toBe('unknown')
      expect(site.line).not.toMatch(/Opportunity|Spirit|Viking/)
    }
  })

  it('guides: pick a spot, send a sealed letter, then the next spot, then home', () => {
    let save = createJourney('Ada', 1000)
    const fresh = getOrbitGuidance(save)
    expect(fresh.suggested).toBe('opportunity')
    expect(fresh.allDone).toBe(false)

    save = finish(save, 'opportunity', false)
    expect(getOrbitGuidance(save).pendingDelivery).toBe('opportunity')

    save = transmitLetter(save, 'opportunity', 4000).save
    expect(getLandingSiteState(save, 'opportunity')).toBe('done')
    expect(getOrbitGuidance(save).suggested).toBe('spirit')

    save = finish(save, 'spirit', true)
    expect(getOrbitGuidance(save).suggested).toBe('viking-1')
    save = finish(save, 'viking-1', true)
    expect(getOrbitGuidance(save).allDone).toBe(true)
  })

  it('turns each site to face the camera', () => {
    for (const site of MARS_LANDING_SITES) {
      const [x, y, z] = siteDirection(site)
      const r = rotationToFace(site)
      const zFacing = -x * Math.sin(r) + z * Math.cos(r)
      expect(zFacing).toBeCloseTo(Math.cos(Math.asin(y)), 5)
    }
  })

  it('skips the briefing on the second landing', () => {
    let save = createJourney('Ada', 1000)
    expect(hasPriorFieldWork(save, 'spirit')).toBe(false)
    save = markMissionDiscovered(save, 'opportunity', 1100)
    expect(hasPriorFieldWork(save, 'spirit')).toBe(true)
    expect(hasPriorFieldWork(save, 'opportunity')).toBe(false)
  })

  it('skips the tutorial on Mars once it was done on the Moon', () => {
    let save = createJourney('Ada', 1000)
    save = markMissionDiscovered(save, 'surveyor-3', 1100)
    expect(hasPriorFieldWork(save, 'opportunity')).toBe(true)
    expect(hasPriorFieldWork(save, 'apollo-11')).toBe(true)
  })
})
