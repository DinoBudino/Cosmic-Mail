/**
 * Pure scanner-progress audio logic. The store updates progress every
 * ~50 ms; this function turns only meaningful crossings into events so a
 * held scan never becomes a machine-gun of beeps.
 */

export type ScannerAudioEvent =
  | 'scanStarted'
  | 'scanProgressHalf'
  | 'scanInterrupted'
  | 'scanCompleted'

export interface ScannerAudioStep {
  events: ScannerAudioEvent[]
  halfPlayed: boolean
  stopLoop: boolean
}

export function stepScannerAudio(
  previous: number,
  next: number,
  halfPlayed: boolean,
): ScannerAudioStep {
  const events: ScannerAudioEvent[] = []
  let half = halfPlayed

  if (next > 0 && previous === 0) {
    events.push('scanStarted')
    half = false
  }
  if (!half && next >= 0.5 && previous < 0.5) {
    events.push('scanProgressHalf')
    half = true
  }

  let stopLoop = false
  if (next === 0 && previous > 0.05) {
    stopLoop = true
    if (previous >= 0.95) events.push('scanCompleted')
    else events.push('scanInterrupted')
    half = false
  }

  return { events, halfPlayed: half, stopLoop }
}
