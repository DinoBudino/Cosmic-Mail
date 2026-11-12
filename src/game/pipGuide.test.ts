import { describe, expect, it } from 'vitest'
import {
  AMBIENT_INTERVAL_MS,
  MAX_AMBIENT_PER_VISIT,
  SOFT_HINT_COOLDOWN_MS,
  SOFT_HINT_PROGRESS_MS,
  SOFT_HINT_STILL_MS,
  createGuideTiming,
  noteAmbient,
  noteMovement,
  noteProgress,
  noteSoftHint,
  shouldOfferAmbient,
  shouldOfferSoftHint,
} from './pipGuide'

const START = 1_000_000

describe('PIP voluntary guidance timing', () => {
  it('starts from a clean visit', () => {
    const state = createGuideTiming(START)
    expect(state.ambientShown).toBe(0)
    expect(shouldOfferSoftHint(state, START)).toBe(false)
  })

  it('needs both a long time without progress and real stillness', () => {
    const state = createGuideTiming(START)
    const now = START + SOFT_HINT_PROGRESS_MS + 1
    const stillButRecentProgress = {
      ...state,
      lastProgressAt: now - 1_000,
      lastMovementAt: START,
    }
    expect(shouldOfferSoftHint(stillButRecentProgress, now)).toBe(false)

    const stuck = {
      ...state,
      lastProgressAt: START,
      lastMovementAt: START,
    }
    expect(
      shouldOfferSoftHint(
        stuck,
        START + SOFT_HINT_PROGRESS_MS + SOFT_HINT_STILL_MS + 1,
      ),
    ).toBe(true)
  })

  it('never nags a player who keeps exploring', () => {
    let state = createGuideTiming(START)
    const later = START + SOFT_HINT_PROGRESS_MS + SOFT_HINT_STILL_MS + 1
    // Continuous movement keeps the stillness clock fresh.
    state = noteMovement(state, later)
    expect(shouldOfferSoftHint(state, later)).toBe(false)
  })

  it('respects the soft-hint cooldown', () => {
    const state = {
      ...createGuideTiming(START),
      lastProgressAt: START,
      lastMovementAt: START,
    }
    const now = START + SOFT_HINT_PROGRESS_MS + SOFT_HINT_STILL_MS + 1
    expect(shouldOfferSoftHint(state, now)).toBe(true)
    const offered = noteSoftHint(state, now)
    expect(shouldOfferSoftHint(offered, now + 1_000)).toBe(false)
    expect(
      shouldOfferSoftHint(offered, now + SOFT_HINT_COOLDOWN_MS + 1),
    ).toBe(true)
  })

  it('caps ambient observations per visit', () => {
    let state = createGuideTiming(START)
    const first = START + AMBIENT_INTERVAL_MS + 1
    expect(shouldOfferAmbient(state, first)).toBe(true)
    state = noteAmbient(state, first)
    expect(state.ambientShown).toBe(1)

    const second = first + AMBIENT_INTERVAL_MS + 1
    expect(shouldOfferAmbient(state, second)).toBe(true)
    state = noteAmbient(state, second)
    expect(state.ambientShown).toBe(MAX_AMBIENT_PER_VISIT)
    expect(shouldOfferAmbient(state, second + AMBIENT_INTERVAL_MS * 2)).toBe(
      false,
    )
  })

  it('resets the progress clock when something real happens', () => {
    const state = {
      ...createGuideTiming(START),
      lastProgressAt: START,
      lastMovementAt: START,
    }
    const progressed = noteProgress(state, START + 30_000)
    expect(
      shouldOfferSoftHint(
        progressed,
        START + SOFT_HINT_PROGRESS_MS + SOFT_HINT_STILL_MS + 10,
      ),
    ).toBe(false)
  })
})
