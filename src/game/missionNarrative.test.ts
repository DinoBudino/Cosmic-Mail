import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import {
  inspectSpirit,
  requestDistractorNote,
  requestMissionHint,
  requestWrongLensFeedback,
  resetMissionHintLadder,
} from './missionNarrative'

const SPIRIT = 'spirit'

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

describe('scanner lenses and distractors', () => {
  it('climbs panel → one PIP line → pulse, with a cooldown and no penalty', () => {
    inspectSpirit()
    // Attempt 1 is panel-only: PIP stays quiet.
    expect(
      requestWrongLensFeedback('spirit-pancam', 'spirit', 1, 10_000),
    ).toBe(false)
    expect(useNarrativeStore.getState().current).toBeNull()
    // Attempt 2: one soft PIP line that never names a lens.
    expect(
      requestWrongLensFeedback('spirit-pancam', 'spirit', 2, 10_500),
    ).toBe(true)
    const first = useNarrativeStore.getState().current
    expect(first?.priority).toBe('hint')
    expect(first?.text).not.toMatch(/visual lens|contact lens|thermal lens/i)
    // Same kind of hint inside the cooldown: nothing is added.
    useNarrativeStore.getState().clearDialogue()
    expect(
      requestWrongLensFeedback('spirit-pancam', 'spirit', 2, 11_000),
    ).toBe(false)
    // Attempt 3+: the lens button pulses instead; PIP does not speak.
    expect(
      requestWrongLensFeedback('spirit-pancam', 'spirit', 3, 40_000),
    ).toBe(false)
    expect(useNarrativeStore.getState().current).toBeNull()
    expect(
      useJourneyStore.getState().save?.missions[SPIRIT].scannedComponentIds,
    ).toEqual([])
  })

  it('describes the instrument function on the PIP line', () => {
    inspectSpirit()
    expect(
      requestWrongLensFeedback('spirit-pancam', 'spirit', 2, 20_000),
    ).toBe(true)
    expect(useNarrativeStore.getState().current?.text).toMatch(/looking/i)
  })

  it('never talks over PIP and never repeats the same line back to back', () => {
    inspectSpirit()
    useNarrativeStore.getState().enqueue({
      id: 'other',
      text: 'Something else.',
      priority: 'mission',
    })
    expect(
      requestWrongLensFeedback('spirit-pancam', 'spirit', 2, 20_000),
    ).toBe(false)
    expect(useNarrativeStore.getState().queue).toHaveLength(0)
  })

  it('counts wrong-lens presses per component and remembers a lens change', () => {
    const game = useGameStore.getState()
    expect(game.registerWrongLensAttempt('spirit-pancam')).toBe(1)
    expect(game.registerWrongLensAttempt('spirit-pancam')).toBe(2)
    expect(game.registerWrongLensAttempt('spirit-mini-tes')).toBe(1)
    expect(useGameStore.getState().lensTouched).toBe(false)
    game.setScannerLens('contact')
    expect(useGameStore.getState().lensTouched).toBe(true)
    useGameStore.setState({ wrongLensAttempts: {}, lensTouched: false })
    game.setScannerLens('visual')
  })

  it('orients Ask PIP toward the lens only after discovery and in levels', () => {
    // Before discovery: no lens cue at all.
    requestMissionHint()
    requestMissionHint()
    const before = useNarrativeStore.getState()
    const beforeTexts = [before.current, ...before.queue].map((l) => l?.text)
    expect(beforeTexts.join(' ')).not.toMatch(/lens|camera|infrared/i)

    useNarrativeStore.getState().reset()
    useNarrativeStore.getState().markProtocol('calibrated')
    resetMissionHintLadder()
    inspectSpirit()
    requestMissionHint() // level 0: no lens cue
    requestMissionHint() // level 1: function, not the lens name
    const mid = useNarrativeStore.getState()
    const midTexts = [mid.current, ...mid.queue]
      .map((l) => l?.text ?? '')
      .join(' ')
    expect(midTexts).toMatch(/look|touch|heat/i)
    expect(midTexts).not.toMatch(/visual lens|contact lens|thermal lens/i)

    useNarrativeStore.getState().reset()
    requestMissionHint() // level 2: may name the lens
    const last = useNarrativeStore.getState()
    const lastTexts = [last.current, ...last.queue]
      .map((l) => l?.text ?? '')
      .join(' ')
    expect(lastTexts).toMatch(/lens/i)
  })

  it('plays a distractor note only after discovery and adds no progress', () => {
    expect(requestDistractorNote('spirit-wheels', 'spirit', 10_000)).toBe(false)
    inspectSpirit()
    expect(requestDistractorNote('spirit-wheels', 'spirit', 10_000)).toBe(true)
    expect(useNarrativeStore.getState().current?.text).toMatch(/wheels/i)
    expect(requestDistractorNote('unknown-part', 'spirit', 30_000)).toBe(false)
    const mission = useJourneyStore.getState().save?.missions[SPIRIT]
    expect(mission?.scannedComponentIds).toEqual([])
    expect(
      useJourneyStore.getState().scan(SPIRIT, 'spirit-wheels')?.status,
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
    expect(text).toMatch(/calibrate/i)
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
