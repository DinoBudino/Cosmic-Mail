import { describe, expect, it } from 'vitest'
import { getMission } from '../data/missions'
import {
  JOURNEY_STORAGE_KEY,
  LEGACY_JOURNEY_STORAGE_KEY,
  type StorageLike,
} from './journeySchema'
import { createJourneyStore } from './journeyStore'

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }
}

const RETIRED_V2_KEY = 'cosmic-mail:explorer:v2'
const RETIRED_TUTORIAL_KEY = 'cosmic-mail:tutorial:v1'

function completeSpirit(store: ReturnType<typeof createJourneyStore>) {
  const state = () => store.getState()
  const mission = getMission('spirit')
  expect(state().startJourney('Ada')).toBe(true)
  for (const component of mission.components) {
    expect(state().scan('spirit', component.id)?.status).toBe('scanned')
  }
  expect(state().completeFullScan('spirit')?.status).toBe('memory-recovered')
  expect(state().prepareSmartLetter('spirit')?.status).toBe('created')
}

describe('journey store', () => {
  it('runs the full A cycle and reloads it', () => {
    const storage = new MemoryStorage()
    const store = createJourneyStore(storage)
    const state = () => store.getState()

    expect(state().loadStatus).toBe('empty')
    expect(state().scan('spirit', 'spirit-pancam')).toBeNull()

    completeSpirit(store)
    expect(state().save?.missions.spirit.memoryRecoveredAt).not.toBeNull()
    expect(state().save?.missions.spirit.smartLetterCreatedAt).not.toBeNull()
    expect(state().save?.missions.spirit.stampEarned).toBe(false)

    const delivered = state().transmit('spirit')
    expect(delivered?.status).toBe('transmitted')
    expect(state().save?.missions.spirit.stampEarned).toBe(true)

    const reloaded = createJourneyStore(storage)
    expect(reloaded.getState().loadStatus).toBe('loaded')
    expect(reloaded.getState().save?.playerName).toBe('Ada')
    expect(
      reloaded.getState().save?.missions.spirit.scannedComponentIds,
    ).toHaveLength(3)
    expect(reloaded.getState().save?.missions.spirit.stampEarned).toBe(true)
  })

  it('starts a brand-new journey with every mission empty', () => {
    const storage = new MemoryStorage()
    const store = createJourneyStore(storage)
    const state = () => store.getState()

    completeSpirit(store)
    state().setDestination('mars')
    state().transmit('spirit')

    expect(state().startJourney('New Pilot')).toBe(true)
    const fresh = state().save!
    expect(fresh.playerName).toBe('New Pilot')
    expect(fresh.currentDestination).toBeNull()
    expect(fresh.onboardingComplete).toBe(false)
    expect(fresh.missions.spirit.scannedComponentIds).toEqual([])
    expect(fresh.missions.spirit.memoryRecoveredAt).toBeNull()
    expect(fresh.missions.spirit.stampEarned).toBe(false)

    const reloaded = createJourneyStore(storage)
    expect(reloaded.getState().save?.playerName).toBe('New Pilot')
    expect(
      reloaded.getState().save?.missions.spirit.scannedComponentIds,
    ).toEqual([])
  })

  it('records machine discovery and persists it', () => {
    const storage = new MemoryStorage()
    const store = createJourneyStore(storage)
    const state = () => store.getState()

    expect(state().startJourney('Ada')).toBe(true)
    expect(state().save?.missions.spirit.discovered).toBe(false)
    expect(state().discoverMission('spirit')).toBe(true)
    expect(state().save?.missions.spirit.discovered).toBe(true)

    const reloaded = createJourneyStore(storage)
    expect(reloaded.getState().save?.missions.spirit.discovered).toBe(true)
  })

  it('rejects an invalid player name without touching the save', () => {
    const store = createJourneyStore(new MemoryStorage())
    expect(store.getState().startJourney(' x ')).toBe(false)
    expect(store.getState().save).toBeNull()
  })

  it('keeps the full scan locked before all three fragments', () => {
    const store = createJourneyStore(new MemoryStorage())
    const state = () => store.getState()

    expect(state().startJourney('Ada')).toBe(true)
    expect(state().scan('spirit', 'spirit-pancam')?.status).toBe('scanned')
    expect(state().completeFullScan('spirit')?.status).toBe('locked')
    expect(state().save?.missions.spirit.memoryRecoveredAt).toBeNull()
    expect(state().prepareSmartLetter('spirit')?.status).toBe('locked')
    expect(state().transmit('spirit')?.status).toBe('letter-missing')
    expect(state().save?.missions.spirit.stampEarned).toBe(false)
  })

  it('is idempotent for memory, letter, recreation and transmission', () => {
    const store = createJourneyStore(new MemoryStorage())
    const state = () => store.getState()
    completeSpirit(store)

    expect(state().completeFullScan('spirit')?.status).toBe('already-recovered')
    expect(state().prepareSmartLetter('spirit')?.status).toBe('already-created')
    expect(state().markReconstructionWatched('spirit')).toBe(true)
    expect(state().markReconstructionWatched('spirit')).toBe(true)
    expect(state().transmit('spirit')?.status).toBe('transmitted')
    expect(state().transmit('spirit')?.status).toBe('already-transmitted')

    const reloaded = createJourneyStore(new MemoryStorage())
    expect(reloaded.getState().save).toBeNull()
  })

  it('continues a partially scanned mission after a reload', () => {
    const storage = new MemoryStorage()
    const first = createJourneyStore(storage)
    expect(first.getState().startJourney('Ada')).toBe(true)
    expect(first.getState().scan('spirit', 'spirit-pancam')?.status).toBe(
      'scanned',
    )

    const reloaded = createJourneyStore(storage)
    expect(
      reloaded.getState().save?.missions.spirit.scannedComponentIds,
    ).toEqual(['spirit-pancam'])
    expect(
      reloaded.getState().scan('spirit', 'spirit-rock-abrasion-tool')?.status,
    ).toBe('scanned')
    expect(
      reloaded.getState().scan('spirit', 'spirit-mini-tes')?.status,
    ).toBe('scanned')
  })

  it('never touches legacy saves while scanning', () => {
    const storage = new MemoryStorage()
    const legacy = JSON.stringify({
      schemaVersion: 3,
      playerName: 'Old',
      missions: {
        spirit: {
          discovered: true,
          scannedComponentIds: ['spirit-pancam'],
          stampEarned: true,
          letterCompletedAt: 900,
        },
      },
    })
    storage.setItem(RETIRED_V2_KEY, '{"explorerName":"Ada"}')
    storage.setItem(RETIRED_TUTORIAL_KEY, 'done')
    storage.setItem(LEGACY_JOURNEY_STORAGE_KEY, legacy)

    const store = createJourneyStore(storage)
    expect(store.getState().loadStatus).toBe('migrated')
    expect(store.getState().save?.migratedFrom).toBe(3)
    expect(
      store.getState().save?.missions.spirit.legacySealAt,
    ).toBe(900)
    expect(store.getState().save?.missions.spirit.stampEarned).toBe(false)
    expect(store.getState().save?.missions.spirit.memoryRecoveredAt).toBeNull()

    expect(store.getState().scan('spirit', 'spirit-mini-tes')?.status).toBe(
      'scanned',
    )
    expect(storage.getItem(LEGACY_JOURNEY_STORAGE_KEY)).toBe(legacy)
    expect(storage.getItem(RETIRED_V2_KEY)).not.toBeNull()
    expect(storage.getItem(RETIRED_TUTORIAL_KEY)).toBe('done')
  })

  it('resets only Spirit progress and persists every other field', () => {
    const storage = new MemoryStorage()
    storage.setItem(RETIRED_V2_KEY, 'v2')
    storage.setItem(RETIRED_TUTORIAL_KEY, 'done')

    const store = createJourneyStore(storage)
    const state = () => store.getState()

    completeSpirit(store)
    state().completeOnboarding()
    state().setDestination('mars')
    expect(
      state().scan('surveyor-3', 'surveyor-3-tv-camera')?.status,
    ).toBe('scanned')

    const before = state().save!
    const surveyorBefore = before.missions['surveyor-3']

    expect(state().resetMission('spirit')).toBe(true)
    const after = state().save!

    expect(after.missions.spirit.scannedComponentIds).toEqual([])
    expect(after.missions.spirit.memoryRecoveredAt).toBeNull()
    expect(after.missions.spirit.smartLetterCreatedAt).toBeNull()
    expect(after.missions.spirit.stampEarned).toBe(false)
    expect(after.missions['surveyor-3']).toEqual(surveyorBefore)
    expect(after.playerName).toBe('Ada')
    expect(after.schemaVersion).toBe(before.schemaVersion)
    expect(after.onboardingComplete).toBe(true)
    expect(after.currentDestination).toBe('mars')

    expect(storage.getItem(RETIRED_V2_KEY)).toBe('v2')
    expect(storage.getItem(RETIRED_TUTORIAL_KEY)).toBe('done')
  })

  it('rejects a mission reset when there is no save', () => {
    const store = createJourneyStore(new MemoryStorage())
    expect(store.getState().resetMission('spirit')).toBe(false)
  })

  it('resets only the v4 key', () => {
    const storage = new MemoryStorage()
    storage.setItem(RETIRED_V2_KEY, 'v2')
    storage.setItem(LEGACY_JOURNEY_STORAGE_KEY, 'v3')

    const store = createJourneyStore(storage)
    expect(store.getState().startJourney('Ada')).toBe(true)
    expect(storage.getItem(JOURNEY_STORAGE_KEY)).not.toBeNull()

    expect(store.getState().resetJourney()).toBe(true)
    expect(store.getState().save).toBeNull()
    expect(store.getState().loadStatus).toBe('empty')
    expect(storage.getItem(JOURNEY_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_JOURNEY_STORAGE_KEY)).toBe('v3')
    expect(storage.getItem(RETIRED_V2_KEY)).toBe('v2')
  })
})
