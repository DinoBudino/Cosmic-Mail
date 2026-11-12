/**
 * Pure timing rules for PIP's voluntary help. They deliberately do not use
 * a bare timer: a player who is still moving is exploring, not stuck.
 */

export interface GuideTimingState {
  /** Last real progress change: a fragment, stage or discovery. */
  lastProgressAt: number
  /** Last meaningful player displacement. */
  lastMovementAt: number
  /** Last proactive help line. */
  lastSoftHintAt: number
  /** Last ambient observation. */
  lastAmbientAt: number
  /** Ambient observations already played this visit. */
  ambientShown: number
}

export const SOFT_HINT_PROGRESS_MS = 45_000
export const SOFT_HINT_STILL_MS = 12_000
export const SOFT_HINT_COOLDOWN_MS = 90_000
export const AMBIENT_INTERVAL_MS = 150_000
export const MAX_AMBIENT_PER_VISIT = 2

export function createGuideTiming(now: number): GuideTimingState {
  return {
    lastProgressAt: now,
    lastMovementAt: now,
    // The visit itself is not a hint: the first gentle nudge can arrive
    // after the progress window instead of waiting a full extra cooldown.
    lastSoftHintAt: now - SOFT_HINT_COOLDOWN_MS,
    lastAmbientAt: now,
    ambientShown: 0,
  }
}

/**
 * A soft hint needs three conditions: real time without progress, the player
 * has stopped moving recently, and the last voluntary hint is old enough.
 */
export function shouldOfferSoftHint(
  state: GuideTimingState,
  now: number,
): boolean {
  return (
    now - state.lastProgressAt >= SOFT_HINT_PROGRESS_MS &&
    now - state.lastMovementAt >= SOFT_HINT_STILL_MS &&
    now - state.lastSoftHintAt >= SOFT_HINT_COOLDOWN_MS
  )
}

export function shouldOfferAmbient(
  state: GuideTimingState,
  now: number,
): boolean {
  return (
    state.ambientShown < MAX_AMBIENT_PER_VISIT &&
    now - state.lastAmbientAt >= AMBIENT_INTERVAL_MS
  )
}

export function noteProgress(
  state: GuideTimingState,
  now: number,
): GuideTimingState {
  return { ...state, lastProgressAt: now }
}

export function noteMovement(
  state: GuideTimingState,
  now: number,
): GuideTimingState {
  return { ...state, lastMovementAt: now }
}

export function noteSoftHint(
  state: GuideTimingState,
  now: number,
): GuideTimingState {
  return { ...state, lastSoftHintAt: now }
}

export function noteAmbient(
  state: GuideTimingState,
  now: number,
): GuideTimingState {
  return {
    ...state,
    lastAmbientAt: now,
    ambientShown: state.ambientShown + 1,
  }
}
