/**
 * Pure mission-progress diffing. The React director turns these events
 * into audio exactly once, even when a save object is rewritten without
 * a meaningful change.
 */

export interface MissionAudioSnapshot {
  scannedIds: readonly string[]
  memoryRecovered: boolean
  smartLetterCreated: boolean
  reconstructionWatched: boolean
  transmitted: boolean
}

export type MissionAudioEvent =
  | 'fragmentRecovered'
  | 'memoryRecovered'
  | 'smartLetterCreated'
  | 'reconstructionWatched'
  | 'transmissionCompleted'

export interface MissionProgressLike {
  scannedComponentIds?: readonly string[]
  memoryRecoveredAt?: number | null
  smartLetterCreatedAt?: number | null
  reconstructionWatchedAt?: number | null
  transmittedAt?: number | null
}

export function snapshotFromProgress(
  progress: MissionProgressLike | null | undefined,
): MissionAudioSnapshot {
  return {
    scannedIds: [...(progress?.scannedComponentIds ?? [])],
    memoryRecovered: progress?.memoryRecoveredAt != null,
    smartLetterCreated: progress?.smartLetterCreatedAt != null,
    reconstructionWatched: progress?.reconstructionWatchedAt != null,
    transmitted: progress?.transmittedAt != null,
  }
}

export function diffMissionAudio(
  previous: MissionAudioSnapshot,
  next: MissionAudioSnapshot,
): MissionAudioEvent[] {
  const events: MissionAudioEvent[] = []
  const known = new Set(previous.scannedIds)
  for (const id of next.scannedIds) {
    if (!known.has(id)) events.push('fragmentRecovered')
  }
  if (!previous.memoryRecovered && next.memoryRecovered) {
    events.push('memoryRecovered')
  }
  if (!previous.smartLetterCreated && next.smartLetterCreated) {
    events.push('smartLetterCreated')
  }
  if (!previous.reconstructionWatched && next.reconstructionWatched) {
    events.push('reconstructionWatched')
  }
  if (!previous.transmitted && next.transmitted) {
    events.push('transmissionCompleted')
  }
  return events
}
