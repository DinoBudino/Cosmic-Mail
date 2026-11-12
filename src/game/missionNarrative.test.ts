import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import {
  inspectSpirit,
  requestMissionHint,
  resetMissionHintLadder,
} from './missionNarrative'

const SPIRIT = 'spirit'

beforeEach(() => {
  useJourneyStore.getState().startJourney('Tester')
  useGameStore.getState().unequipScanner()
  useNarrativeStore.getState().reset()
  resetMissionHintLadder()
})

afterEach(() => {
  useJourneyStore.getState().resetJourney()
  useNarrativeStore.getState().reset()
  resetMissionHintLadder()
})

describe('explicit explorer inspection', () => {
  it('is the valid discovery event and is idempotent', () => {
    expect(
      useJourneyStore.getState().save?.missions[SPIRIT].discovered,
    ).toBe(false)
    expect(inspectSpirit()).toBe(true)
    expect(
      useJourneyStore.getState().save?.missions[SPIRIT].discovered,
    ).toBe(true)
    expect(inspectSpirit()).toBe(false)
  })

  it('keeps Ask PIP anonymous before inspection', () => {
    expect(requestMissionHint()).toBe(true)
    const line = useNarrativeStore.getState().current
    expect(line).not.toBeNull()
    expect(line?.text).not.toMatch(/spirit|pancam|mini-tes|rock abrasion/i)
  })
})
