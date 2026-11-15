import { describe, expect, it } from 'vitest'
import {
  JOURNEY_SCHEMA_VERSION,
  JOURNEY_STORAGE_KEY,
  LEGACY_JOURNEY_STORAGE_KEY,
  createJourney,
  loadJourney,
  migrateV3Save,
  parseJourneySave,
  removeJourney,
  saveJourney,
  sanitizePlayerName,
  type StorageLike,
} from './journeySchema'

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

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('blocked')
  }

  setItem(): void {
    throw new Error('blocked')
  }

  removeItem(): void {
    throw new Error('blocked')
  }
}

const RETIRED_V2_KEY = 'cosmic-mail:explorer:v2'
const RETIRED_TUTORIAL_KEY = 'cosmic-mail:tutorial:v1'

const SPIRIT_IDS = [
  'spirit-pancam',
  'spirit-rock-abrasion-tool',
  'spirit-mini-tes',
] as const

function v3Save(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 3,
    playerName: 'Ada',
    introSeen: true,
    onboardingComplete: true,
    currentDestination: 'mars',
    finalQuoteShown: false,
    createdAt: 1000,
    updatedAt: 2000,
    missions: {
      spirit: {
        discovered: true,
        scannedComponentIds: [...SPIRIT_IDS],
        letterCompletedAt: 1500,
        letterAttempts: 2,
        hintShown: true,
        stampEarned: true,
      },
    },
    ...overrides,
  }
}

describe('JourneySaveV4 creation', () => {
  it('creates a clean Proposal A journey with every mission unknown', () => {
    const save = createJourney('  Ada  ', 1000)
    expect(save.schemaVersion).toBe(JOURNEY_SCHEMA_VERSION)
    expect(save.playerName).toBe('Ada')
    expect(save.currentDestination).toBeNull()
    expect(save.introSeen).toBe(false)
    expect(save.onboardingComplete).toBe(false)
    expect(save.finalQuoteShown).toBe(false)
    expect(save.migratedFrom).toBeNull()
    expect(save.createdAt).toBe(1000)
    expect(save.updatedAt).toBe(1000)
    expect(Object.keys(save.missions)).toEqual([
      'surveyor-3',
      'spirit',
      'pioneer-10',
      'opportunity',
    ])
    for (const progress of Object.values(save.missions)) {
      expect(progress).toEqual({
        discovered: false,
        scannedComponentIds: [],
        fullScanCompletedAt: null,
        memoryRecoveredAt: null,
        smartLetterCreatedAt: null,
        reconstructionWatchedAt: null,
        transmittedAt: null,
        stampEarned: false,
        legacySealAt: null,
      })
    }
  })

  it('rejects short names and sanitizes long ones', () => {
    expect(() => createJourney(' x ')).toThrow()
    expect(sanitizePlayerName('  Ada   Lovelace  ')).toBe('Ada Lovelace')
    expect(sanitizePlayerName('x'.repeat(30))).toHaveLength(20)
  })
})

describe('V4 validation invariants', () => {
  it('round-trips A progress without losing fields', () => {
    const storage = new MemoryStorage()
    const save = createJourney('Ada', 1000)
    save.missions.spirit = {
      ...save.missions.spirit,
      discovered: true,
      scannedComponentIds: [...SPIRIT_IDS],
      fullScanCompletedAt: 1100,
      memoryRecoveredAt: 1100,
      smartLetterCreatedAt: 1200,
      reconstructionWatchedAt: 1300,
      transmittedAt: 1400,
      stampEarned: true,
    }

    expect(saveJourney(storage, save)).toBe(true)
    const result = loadJourney(storage)

    expect(result.status).toBe('loaded')
    expect(result.persisted).toBe(true)
    expect(result.save).toEqual(save)
  })

  it('never allows 3/3 scans to become a transmitted history', () => {
    const save = parseJourneySave({
      schemaVersion: 4,
      playerName: 'Ada',
      missions: {
        spirit: {
          discovered: true,
          scannedComponentIds: [...SPIRIT_IDS],
          stampEarned: true,
          transmittedAt: 900,
        },
      },
    })

    expect(save).not.toBeNull()
    expect(save!.missions.spirit.fullScanCompletedAt).toBeNull()
    expect(save!.missions.spirit.memoryRecoveredAt).toBeNull()
    expect(save!.missions.spirit.smartLetterCreatedAt).toBeNull()
    expect(save!.missions.spirit.transmittedAt).toBeNull()
    expect(save!.missions.spirit.stampEarned).toBe(false)
  })

  it('drops memory, letter and transmission without their prerequisites', () => {
    const save = parseJourneySave({
      schemaVersion: 4,
      playerName: 'Ada',
      missions: {
        spirit: {
          discovered: true,
          scannedComponentIds: ['spirit-pancam'],
          memoryRecoveredAt: 500,
          smartLetterCreatedAt: 600,
          transmittedAt: 700,
          stampEarned: true,
        },
      },
    })

    expect(save!.missions.spirit.fullScanCompletedAt).toBeNull()
    expect(save!.missions.spirit.memoryRecoveredAt).toBeNull()
    expect(save!.missions.spirit.smartLetterCreatedAt).toBeNull()
    expect(save!.missions.spirit.transmittedAt).toBeNull()
    expect(save!.missions.spirit.stampEarned).toBe(false)
  })

  it('accepts a fully consistent A chain', () => {
    const save = parseJourneySave({
      schemaVersion: 4,
      playerName: 'Ada',
      missions: {
        spirit: {
          discovered: true,
          scannedComponentIds: [...SPIRIT_IDS, 'spirit-pancam', 'unknown-part'],
          fullScanCompletedAt: 500,
          memoryRecoveredAt: 500,
          smartLetterCreatedAt: 600,
          reconstructionWatchedAt: 700,
          transmittedAt: 800,
          stampEarned: true,
        },
      },
    })

    expect(save!.missions.spirit.scannedComponentIds).toEqual([...SPIRIT_IDS])
    expect(save!.missions.spirit.transmittedAt).toBe(800)
    expect(save!.missions.spirit.stampEarned).toBe(true)
  })

  it('leaves corrupt v4 JSON untouched and reports it', () => {
    const storage = new MemoryStorage()
    storage.setItem(JOURNEY_STORAGE_KEY, '{not-json')

    const result = loadJourney(storage)

    expect(result.status).toBe('corrupt')
    expect(result.save).toBeNull()
    expect(result.persisted).toBe(false)
    expect(storage.getItem(JOURNEY_STORAGE_KEY)).toBe('{not-json')
  })

  it('rejects the wrong schema version or an invalid name', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 3, playerName: 'Ada' }),
    )
    expect(loadJourney(storage).status).toBe('corrupt')

    storage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 4, playerName: ' ' }),
    )
    expect(loadJourney(storage).status).toBe('corrupt')
  })

  it('reports unavailable storage instead of throwing', () => {
    expect(loadJourney(null).status).toBe('unavailable')
    expect(loadJourney(new ThrowingStorage()).status).toBe('unavailable')
    expect(saveJourney(null, createJourney('Ada'))).toBe(false)
    expect(saveJourney(new ThrowingStorage(), createJourney('Ada'))).toBe(false)
  })
})

describe('Proposal B migration', () => {
  it('preserves scans, identity and legacy seal without granting A progress', () => {
    const storage = new MemoryStorage()
    const legacyRaw = JSON.stringify(v3Save())
    storage.setItem(LEGACY_JOURNEY_STORAGE_KEY, legacyRaw)

    const result = loadJourney(storage)

    expect(result.status).toBe('migrated')
    expect(result.persisted).toBe(true)
    expect(result.save).not.toBeNull()
    expect(result.save!.schemaVersion).toBe(4)
    expect(result.save!.migratedFrom).toBe(3)
    expect(result.save!.playerName).toBe('Ada')
    expect(result.save!.onboardingComplete).toBe(true)
    expect(result.save!.currentDestination).toBe('mars')

    const spirit = result.save!.missions.spirit
    expect(spirit.scannedComponentIds).toEqual([...SPIRIT_IDS])
    expect(spirit.discovered).toBe(true)
    expect(spirit.fullScanCompletedAt).toBeNull()
    expect(spirit.memoryRecoveredAt).toBeNull()
    expect(spirit.smartLetterCreatedAt).toBeNull()
    expect(spirit.transmittedAt).toBeNull()
    expect(spirit.stampEarned).toBe(false)
    expect(spirit.legacySealAt).toBe(1500)

    // The B save is preserved byte-for-byte; only a new v4 key is written.
    expect(storage.getItem(LEGACY_JOURNEY_STORAGE_KEY)).toBe(legacyRaw)
    expect(storage.getItem(JOURNEY_STORAGE_KEY)).not.toBeNull()

    // A second load reads the migrated v4 save instead of migrating again.
    const second = loadJourney(storage)
    expect(second.status).toBe('loaded')
    expect(second.save).toEqual(result.save)
  })

  it('preserves a legacy seal even when the old timestamp is missing', () => {
    const save = migrateV3Save(
      v3Save({
        updatedAt: 2222,
        missions: {
          spirit: {
            scannedComponentIds: [],
            stampEarned: true,
          },
        },
      }),
    )
    expect(save).not.toBeNull()
    expect(save!.missions.spirit.legacySealAt).toBe(2222)
    expect(save!.missions.spirit.stampEarned).toBe(false)
    expect(save!.missions.spirit.scannedComponentIds).toEqual([])
  })

  it('migrates a partially investigated B save without inventing a seal', () => {
    const save = migrateV3Save(
      v3Save({
        missions: {
          spirit: {
            discovered: false,
            scannedComponentIds: ['spirit-pancam', 'unknown-part'],
            letterCompletedAt: null,
            letterAttempts: 0,
            hintShown: false,
            stampEarned: false,
          },
        },
      }),
    )
    expect(save!.missions.spirit.discovered).toBe(true)
    expect(save!.missions.spirit.scannedComponentIds).toEqual([
      'spirit-pancam',
    ])
    expect(save!.missions.spirit.legacySealAt).toBeNull()
    expect(save!.missions.spirit.memoryRecoveredAt).toBeNull()
  })

  it('reports corrupt legacy data without writing the new key', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_JOURNEY_STORAGE_KEY, '{not-json')

    const result = loadJourney(storage)

    expect(result.status).toBe('corrupt')
    expect(result.save).toBeNull()
    expect(storage.getItem(JOURNEY_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_JOURNEY_STORAGE_KEY)).toBe('{not-json')
  })

  it('prefers a valid v4 save and leaves v3 untouched', () => {
    const storage = new MemoryStorage()
    const current = createJourney('New', 5000)
    saveJourney(storage, current)
    storage.setItem(LEGACY_JOURNEY_STORAGE_KEY, JSON.stringify(v3Save()))

    const result = loadJourney(storage)
    expect(result.status).toBe('loaded')
    expect(result.save!.playerName).toBe('New')
    expect(storage.getItem(LEGACY_JOURNEY_STORAGE_KEY)).not.toBeNull()
  })
})

describe('safe reset and retired keys', () => {
  it('ignores the retired v2 passport, tutorial and v3 key without touching them', () => {
    const storage = new MemoryStorage()
    storage.setItem(RETIRED_V2_KEY, '{"explorerName":"Ada","completed":true}')
    storage.setItem(RETIRED_TUTORIAL_KEY, 'done')

    const result = loadJourney(storage)

    expect(result.status).toBe('empty')
    expect(result.save).toBeNull()
    expect(storage.getItem(JOURNEY_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(RETIRED_V2_KEY)).not.toBeNull()
    expect(storage.getItem(RETIRED_TUTORIAL_KEY)).toBe('done')
  })

  it('removes only the v4 key when resetting', () => {
    const storage = new MemoryStorage()
    storage.setItem(JOURNEY_STORAGE_KEY, 'v4')
    storage.setItem(LEGACY_JOURNEY_STORAGE_KEY, 'v3')
    storage.setItem(RETIRED_V2_KEY, 'v2')

    expect(removeJourney(storage)).toBe(true)
    expect(storage.getItem(JOURNEY_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_JOURNEY_STORAGE_KEY)).toBe('v3')
    expect(storage.getItem(RETIRED_V2_KEY)).toBe('v2')
  })
})

describe('optional environmental persistence', () => {
  it('round-trips known field observations and drops unknown ids', () => {
    const save = parseJourneySave({
      schemaVersion: 4,
      playerName: 'Ada',
      environmentalDiscoveries: [
        'env-soil-landing',
        'not-a-real-site',
        'env-soil-landing',
      ],
      environmentalDetailedDiscoveries: ['env-wind-passage'],
    })
    expect(save).not.toBeNull()
    expect(save!.environmentalDiscoveries).toEqual([
      'env-soil-landing',
      'env-wind-passage',
    ])
    expect(save!.environmentalDetailedDiscoveries).toEqual([
      'env-wind-passage',
    ])
    expect(save!.missions.spirit.discovered).toBe(false)
    expect(save!.missions.spirit.transmittedAt).toBeNull()
  })

  it('defaults to no field observations for older v4 saves', () => {
    const save = parseJourneySave({
      schemaVersion: 4,
      playerName: 'Ada',
      missions: {},
    })
    expect(save).not.toBeNull()
    expect(save!.environmentalDiscoveries).toEqual([])
    expect(save!.environmentalDetailedDiscoveries).toEqual([])
  })
})

describe('memorialVisits (additive field)', () => {
  it('reads a v4 save written before the field existed as an empty list', () => {
    const base = createJourney('Ada', 1000)
    const { memorialVisits: _omitted, ...legacy } = base
    void _omitted
    const parsed = parseJourneySave(legacy)
    expect(parsed?.memorialVisits).toEqual([])
    // Nothing else is altered by the missing field.
    expect(parsed?.playerName).toBe('Ada')
    expect(parsed?.missions).toEqual(base.missions)
  })

  it('keeps only valid, unique memorial ids', () => {
    const parsed = parseJourneySave({
      ...createJourney('Ada', 1000),
      memorialVisits: ['insight', 'insight', 'bogus', 42, 'opportunity'],
    })
    expect(parsed?.memorialVisits).toEqual(['insight', 'opportunity'])
    expect(
      parseJourneySave({
        ...createJourney('Ada', 1000),
        memorialVisits: 'insight',
      })?.memorialVisits,
    ).toEqual([])
  })

  it('migrated v3 saves start without memorial visits', () => {
    const migrated = migrateV3Save({
      schemaVersion: 3,
      playerName: 'Ada',
      missions: {},
    })
    expect(migrated?.memorialVisits).toEqual([])
  })
})
