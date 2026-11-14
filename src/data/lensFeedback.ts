/**
 * Progressive, rate-limited feedback for a wrong scanner lens. Pure rules.
 *
 *  attempt 1  → panel line only (no PIP)
 *  attempt 2  → one PIP line (describes the instrument's function)
 *  attempt 3+ → the correct lens button pulses softly; PIP stays quiet
 *
 * PIP lines of this kind keep a minimum gap, and an attempt is one press of
 * the scan control, never one frame.
 */

export const LENS_PIP_COOLDOWN_MS = 13_000
export const LENS_PULSE_AFTER_ATTEMPTS = 3

export type LensFeedbackChannel = 'panel' | 'pip' | 'pulse'

export function lensFeedbackChannel(attempt: number): LensFeedbackChannel {
  if (attempt >= LENS_PULSE_AFTER_ATTEMPTS) return 'pulse'
  if (attempt === 2) return 'pip'
  return 'panel'
}

/** True when a PIP line of this kind may play now. */
export function canSpeakLensHint(
  lastSpokenAt: number | null,
  now: number,
): boolean {
  return lastSpokenAt === null || now - lastSpokenAt >= LENS_PIP_COOLDOWN_MS
}

/** The correct lens button pulses once the player has missed enough times. */
export function shouldPulseCorrectLens(attempts: number): boolean {
  return attempts >= LENS_PULSE_AFTER_ATTEMPTS
}

/** Single fixed panel line for a wrong lens; names only the current lens. */
export function wrongLensPanelLine(
  partLabel: string,
  lensLabel: string,
): string {
  return `${partLabel} · ${lensLabel} finds nothing here`
}
