import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import {
  inspectSpirit,
  requestDistractorNote,
  requestMissionHint,
  resetMissionHintLadder,
} from './missionNarrative'

const SPIRIT = 'opportunity'

beforeEach(() => {
  useJourneyStore.getState().startJourney('Tester')
  useGameStore.getState().unequipScanner()
  useNarrativeStore.getState().reset()
  // The arrival protocol is covered separately below; the legacy tests start
  // from a calibrated pilot so they exercise the mission rules themselves.
  useNarrativeStore.getState().markProtocol('calibrated')
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

describe('single scan mode and distractors', () => {
  it('never mentions scanner lenses in Ask PIP, before or after discovery', () => {
    requestMissionHint()
    requestMissionHint()
    inspectSpirit()
    requestMissionHint()
    requestMissionHint()
    requestMissionHint()
    const state = useNarrativeStore.getState()
    const texts = [state.current, ...state.queue]
      .map((l) => l?.text ?? '')
      .join(' ')
    expect(texts).not.toMatch(/\blens\b/i)
  })

  it('plays a distractor note only after discovery and adds no progress', () => {
    expect(requestDistractorNote('opportunity-wheels', 'opportunity', 10_000)).toBe(false)
    inspectSpirit()
    expect(requestDistractorNote('opportunity-wheels', 'opportunity', 10_000)).toBe(true)
    expect(useNarrativeStore.getState().current?.text).toMatch(/wheels/i)
    expect(requestDistractorNote('unknown-part', 'opportunity', 30_000)).toBe(false)
    const mission = useJourneyStore.getState().save?.missions[SPIRIT]
    expect(mission?.scannedComponentIds).toEqual([])
    expect(
      useJourneyStore.getState().scan(SPIRIT, 'opportunity-wheels')?.status,
    ).toBe('invalid-component')
  })
})

describe('arrival protocol', () => {
  beforeEach(() => {
    // Start each case from a fresh landing (nothing calibrated yet).
    useNarrativeStore.getState().reset()
    useGameStore.getState().setScannerLocked(false)
  })

  it('refuses to inspect the signal before the scanner is calibrated', () => {
    expect(inspectSpirit()).toBe(false)
    expect(
      useJourneyStore.getState().save?.missions[SPIRIT].discovered,
    ).toBe(false)
    // One short line points the player back to the protocol, never a name.
    const text = useNarrativeStore.getState().current?.text ?? ''
    expect(text).toMatch(/practice/i)
    expect(text).not.toMatch(/spirit|rover/i)
  })

  it('opens inspection once calibrated', () => {
    useNarrativeStore.getState().markProtocol('calibrated')
    expect(inspectSpirit()).toBe(true)
  })

  it('gives step-by-step Ask PIP hints that never name the explorer', () => {
    requestMissionHint()
    const first = useNarrativeStore.getState().current?.text ?? ''
    expect(first).toMatch(/walk|joystick|WASD/i)
    expect(first).not.toMatch(/spirit|rover|pancam/i)

    useNarrativeStore.getState().clearDialogue()
    useNarrativeStore.getState().markProtocol('walked')
    requestMissionHint()
    expect(useNarrativeStore.getState().current?.text).toMatch(/radar/i)
  })

  it('locks the scanner until the station and ignores Q while locked', () => {
    useGameStore.getState().setScannerLocked(true)
    useGameStore.getState().equipScanner(SPIRIT)
    expect(useGameStore.getState().scannerEquipped).toBe(false)
    useGameStore.getState().setScannerLocked(false)
    useGameStore.getState().equipScanner(SPIRIT)
    expect(useGameStore.getState().scannerEquipped).toBe(true)
  })

  it('locks memorial landmarks until free exploration', () => {
    const game = useGameStore.getState()
    game.setLandmarksLocked(true)
    useGameStore.setState({ nearbySiteId: 'opportunity' })
    useGameStore.getState().openNearbySite()
    expect(useGameStore.getState().activeSiteId).toBeNull()
    game.setLandmarksLocked(false)
    useGameStore.getState().openNearbySite()
    expect(useGameStore.getState().activeSiteId).toBe('opportunity')
    useGameStore.getState().closeSite()
    useGameStore.setState({ nearbySiteId: null })
  })

  it('keeps protocol notices from piling up and respects cooldowns', async () => {
    const { requestProtocolLine, resetProtocolNotices } = await import(
      './missionNarrative'
    )
    const { OFF_TRAIL_LINE } = await import('../data/arrivalProtocol')
    resetProtocolNotices()
    expect(requestProtocolLine(OFF_TRAIL_LINE, 25_000, 1000)).toBe(true)
    useNarrativeStore.getState().clearDialogue()
    // Same notice inside the cooldown: dropped.
    expect(requestProtocolLine(OFF_TRAIL_LINE, 25_000, 2000)).toBe(false)
    // After the cooldown: allowed again, but only if PIP is not talking.
    expect(requestProtocolLine(OFF_TRAIL_LINE, 25_000, 30_000)).toBe(true)
    useNarrativeStore.getState().reset()
    resetProtocolNotices()
    expect(requestProtocolLine(OFF_TRAIL_LINE, 25_000, 40_000)).toBe(true)
    // Already speaking: a different notice is dropped, not queued.
    const { LATER_LINE } = await import('../data/arrivalProtocol')
    expect(requestProtocolLine(LATER_LINE, 0, 41_000)).toBe(false)
    expect(useNarrativeStore.getState().queue).toHaveLength(0)
  })
})
