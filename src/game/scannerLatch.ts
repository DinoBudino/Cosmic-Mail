/**
 * Touch ergonomics for the scanner. Aiming (drag) and scanning (hold the
 * button) used to need two thumbs at once. A quick tap on Scan now latches
 * the scan on the current target: the player can lift the finger while the
 * reading completes. A longer press keeps the classic hold behavior.
 */

/** A press shorter than this counts as a tap. */
export const SCAN_TAP_MAX_MS = 250

export type ScanPress = 'tap' | 'hold'

export function classifyScanPress(durationMs: number): ScanPress {
  return durationMs >= 0 && durationMs < SCAN_TAP_MAX_MS ? 'tap' : 'hold'
}

/**
 * Only touch and pen presses may latch: with a mouse the click is the hold,
 * and keyboard users already hold Space/Enter.
 */
export function canLatchPointer(pointerType: string): boolean {
  return pointerType === 'touch' || pointerType === 'pen'
}

export type LatchAction = 'release' | 'latch' | 'unlatch' | 'none'

/**
 * Decides what a finished press on the Scan button does.
 * - A press that started while latched only unlatches.
 * - A quick touch tap with a valid target latches it.
 * - Anything else releases the trigger as before.
 */
export function resolveScanRelease(options: {
  pointerType: string
  durationMs: number
  hasTarget: boolean
  startedLatched: boolean
}): LatchAction {
  if (options.startedLatched) return 'unlatch'
  if (
    canLatchPointer(options.pointerType) &&
    options.hasTarget &&
    classifyScanPress(options.durationMs) === 'tap'
  ) {
    return 'latch'
  }
  return 'release'
}
