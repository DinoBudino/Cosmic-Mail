import { describe, expect, it } from 'vitest'
import {
  areAllMissionsComplete,
  completeFullScan,
  prepareSmartLetter,
  scanComponent,
  transmitLetter,
  markMissionDiscovered,
} from '../store/journeyLogic'
import { createJourney, type JourneySave } from '../store/journeySchema'
import { MISSIONS, MISSION_IDS } from './missions'
import {
  HUB_RETURNING_LINE,
  NEW_SIGNAL_LINE,
  hubDialogueLines,
  restoredLine,
} from './onboardingNarrative'
import {
  getRevisitExploreCue,
  getSliceClosure,
} from './sliceClosure'

function deliverSpirit(): JourneySave {
  let save = markMissionDiscovered(createJourney('Ada', 1000), 'spirit', 1100)
  for (const [index, component] of MISSIONS.find(
    (m) => m.id === 'spirit',
  )!.components.entries()) {
    save = scanComponent(save, 'spirit', component.id, 2000 + index).save
  }
  save = completeFullScan(save, 'spirit', 3000).save
  save = prepareSmartLetter(save, 'spirit', 4000).save
  return transmitLetter(save, 'spirit', 5000).save
}

describe('slice closure after Spirit', () => {
  it('shows nothing before the first delivery', () => {
    const closure = getSliceClosure(createJourney('Ada', 1000))
    expect(closure.restored).toBe(0)
    expect(closure.label).toBeNull()
    expect(closure.newSignal).toBe(false)
    expect(getSliceClosure(null).label).toBeNull()
  })

  it('reports 1 of 3 stories restored and a new signal', () => {
    const closure = getSliceClosure(deliverSpirit())
    expect(closure.restored).toBe(1)
    expect(closure.total).toBe(3)
    expect(closure.label).toBe('1 of 3 stories restored')
    expect(closure.newSignal).toBe(true)
    expect(closure.allRestored).toBe(false)
  })

  it('does not lower the Act III requirement: all three are still needed', () => {
    const save = deliverSpirit()
    expect(areAllMissionsComplete(save)).toBe(false)
    expect(MISSION_IDS).toHaveLength(3)
  })

  it('never names a machine, planet or mission order in the new signal', () => {
    const names = [
      ...MISSIONS.map((m) => m.machineName),
      'Moon',
      'Lunar',
      'Mars',
      'Deep Space',
      'Pioneer',
      'Surveyor',
    ]
    for (const text of [NEW_SIGNAL_LINE, restoredLine(1, 3)]) {
      for (const name of names) expect(text).not.toContain(name)
    }
    // It promises nothing playable: no unlock is invented.
    expect(NEW_SIGNAL_LINE).toMatch(/too weak to follow/)
  })

  it('has the hub speak the closure only on a return with deliveries', () => {
    const base = { routeConfirmed: false, hubVisited: true, hubTourDone: true }
    expect(hubDialogueLines({ ...base, restoredCount: 1, totalStories: 3 })).toEqual(
      [restoredLine(1, 3), NEW_SIGNAL_LINE],
    )
    expect(hubDialogueLines({ ...base, restoredCount: 0 })).toEqual([
      HUB_RETURNING_LINE,
    ])
    expect(hubDialogueLines({ ...base })).toEqual([HUB_RETURNING_LINE])
    // Route-ready and first-visit tour keep priority.
    expect(
      hubDialogueLines({ ...base, routeConfirmed: true, restoredCount: 1 }),
    ).toHaveLength(1)
    expect(
      hubDialogueLines({
        routeConfirmed: false,
        hubVisited: false,
        hubTourDone: false,
        restoredCount: 1,
      }).length,
    ).toBeGreaterThan(2)
  })
})

describe('returning to a restored Mars', () => {
  it('cannot duplicate any delivery step: every call returns the same save', () => {
    const save = deliverSpirit()
    expect(scanComponent(save, 'spirit', 'spirit-pancam', 9000).save).toBe(save)
    expect(completeFullScan(save, 'spirit', 9000).save).toBe(save)
    expect(prepareSmartLetter(save, 'spirit', 9000).save).toBe(save)
    const again = transmitLetter(save, 'spirit', 9000)
    expect(again.status).toBe('already-transmitted')
    expect(again.save).toBe(save)
    expect(again.save.missions.spirit.transmittedAt).toBe(5000)
  })

  it('offers free exploration and field notes through PIP, only once restored', () => {
    const save = deliverSpirit()
    const cue = getRevisitExploreCue('spirit', save.missions.spirit, 5)
    expect(cue?.text).toMatch(/field notes/i)
    expect(cue?.priority).toBe('ambient')
    expect(
      getRevisitExploreCue('spirit', save.missions.spirit, 0)?.text,
    ).toMatch(/already in your passport/i)
    expect(
      getRevisitExploreCue('spirit', createJourney('Ada').missions.spirit, 5),
    ).toBeNull()
  })
})
