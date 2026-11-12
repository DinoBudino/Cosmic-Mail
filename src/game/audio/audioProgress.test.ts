import { describe, expect, it } from 'vitest'
import {
  diffMissionAudio,
  snapshotFromProgress,
  type MissionAudioSnapshot,
} from './audioProgress'

const empty: MissionAudioSnapshot = {
  scannedIds: [],
  memoryRecovered: false,
  smartLetterCreated: false,
  reconstructionWatched: false,
  transmitted: false,
}

describe('mission audio progress', () => {
  it('fires one fragment event per newly recognized component', () => {
    expect(
      diffMissionAudio(empty, {
        ...empty,
        scannedIds: ['a'],
      }),
    ).toEqual(['fragmentRecovered'])
    expect(
      diffMissionAudio(
        { ...empty, scannedIds: ['a'] },
        { ...empty, scannedIds: ['a', 'b'] },
      ),
    ).toEqual(['fragmentRecovered'])
  })

  it('does not re-fire when the save is rewritten without changes', () => {
    const snapshot = snapshotFromProgress({
      scannedComponentIds: ['a', 'b', 'c'],
      memoryRecoveredAt: 10,
      smartLetterCreatedAt: 20,
      reconstructionWatchedAt: 30,
      transmittedAt: null,
    })
    expect(diffMissionAudio(snapshot, snapshot)).toEqual([])
  })

  it('fires the full chain exactly once', () => {
    const steps: MissionAudioSnapshot[] = [
      empty,
      { ...empty, scannedIds: ['a'] },
      { ...empty, scannedIds: ['a', 'b', 'c'], memoryRecovered: true },
      {
        ...empty,
        scannedIds: ['a', 'b', 'c'],
        memoryRecovered: true,
        smartLetterCreated: true,
      },
      {
        ...empty,
        scannedIds: ['a', 'b', 'c'],
        memoryRecovered: true,
        smartLetterCreated: true,
        reconstructionWatched: true,
      },
      {
        ...empty,
        scannedIds: ['a', 'b', 'c'],
        memoryRecovered: true,
        smartLetterCreated: true,
        reconstructionWatched: true,
        transmitted: true,
      },
      {
        ...empty,
        scannedIds: ['a', 'b', 'c'],
        memoryRecovered: true,
        smartLetterCreated: true,
        reconstructionWatched: true,
        transmitted: true,
      },
    ]
    const events = steps.flatMap((step, index) =>
      index === 0 ? [] : diffMissionAudio(steps[index - 1]!, step),
    )
    expect(events).toEqual([
      'fragmentRecovered',
      'fragmentRecovered',
      'fragmentRecovered',
      'memoryRecovered',
      'smartLetterCreated',
      'reconstructionWatched',
      'transmissionCompleted',
    ])
  })

  it('does not treat a reset as a new delivery', () => {
    const transmitted: MissionAudioSnapshot = {
      ...empty,
      scannedIds: ['a', 'b', 'c'],
      memoryRecovered: true,
      smartLetterCreated: true,
      transmitted: true,
    }
    expect(diffMissionAudio(transmitted, empty)).toEqual([])
  })
})
