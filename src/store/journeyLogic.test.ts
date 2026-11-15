import { describe, expect, it } from 'vitest'
import {
  ACTIVE_MISSION_IDS,
  MISSION_IDS,
  getMission,
  type MissionId,
} from '../data/missions'
import {
  areAllMissionsComplete,
  completeFullScan,
  countScannedComponents,
  getEarnedStampIds,
  getMissionStage,
  isFullScanUnlocked,
  isMissionComplete,
  markFinalQuoteShown,
  markIntroSeen,
  markMissionDiscovered,
  markOnboardingComplete,
  markReconstructionWatched,
  prepareSmartLetter,
  recordEnvironmentalScan,
  recordMemorialVisit,
  resetMissionProgress,
  scanComponent,
  setCurrentDestination,
  transmitLetter,
} from './journeyLogic'
import {
  createJourney,
  createMissionProgress,
  saveJourney,
  loadJourney,
  type JourneySave,
  type StorageLike,
} from './journeySchema'

class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>()

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

/** A journey where every mission explorer was already identified on site. */
function createDiscoveredJourney(): JourneySave {
  return MISSION_IDS.reduce(
    (current, id) => markMissionDiscovered(current, id, 1050),
    createJourney('Ada', 1000),
  )
}

const SPIRIT_COMPONENTS = [
  'opportunity-pancam',
  'opportunity-rock-abrasion-tool',
  'opportunity-mini-tes',
] as const

function scanAllSpirit(save = createDiscoveredJourney()) {
  return SPIRIT_COMPONENTS.reduce(
    (current, componentId, index) =>
      scanComponent(current, 'opportunity', componentId, 2000 + index).save,
    save,
  )
}

/** A save written before the third part recovered the memory by itself. */
function legacyScannedSave(): JourneySave {
  const save = scanAllSpirit()
  return {
    ...save,
    missions: {
      ...save.missions,
      opportunity: {
        ...save.missions.opportunity,
        fullScanCompletedAt: null,
        memoryRecoveredAt: null,
      },
    },
  }
}

/** Full A cycle up to a prepared smart letter. */
function readyLetter(save = createDiscoveredJourney()): JourneySave {
  let current = scanAllSpirit(save)
  current = completeFullScan(current, 'opportunity', 3000).save
  return prepareSmartLetter(current, 'opportunity', 4000).save
}

describe('mission stage projection', () => {
  it('walks the canonical chain without skipping states', () => {
    let save = createJourney('Ada', 1000)
    expect(getMissionStage(save.missions.opportunity)).toBe('unknown')

    save = markMissionDiscovered(save, 'opportunity', 1100)
    expect(getMissionStage(save.missions.opportunity)).toBe('discovered')

    save = scanComponent(save, 'opportunity', SPIRIT_COMPONENTS[0], 1200).save
    expect(getMissionStage(save.missions.opportunity)).toBe('investigating')

    // The third part recovers the memory: no separate full scan.
    save = scanAllSpirit(save)
    expect(getMissionStage(save.missions.opportunity)).toBe('memory_recovered')

    const letter = prepareSmartLetter(save, 'opportunity', 4000)
    expect(letter.status).toBe('created')
    expect(getMissionStage(letter.save.missions.opportunity)).toBe(
      'smart_letter_ready',
    )

    const delivery = transmitLetter(letter.save, 'opportunity', 5000)
    expect(delivery.status).toBe('transmitted')
    expect(getMissionStage(delivery.save.missions.opportunity)).toBe('transmitted')
  })
})

describe('Cosmic Scanner rules', () => {
  it('marks a mission as discovered without changing scans or rewards', () => {
    const save = createJourney('Ada', 1000)
    expect(save.missions.opportunity.discovered).toBe(false)

    const discovered = markMissionDiscovered(save, 'opportunity', 2000)
    expect(discovered.missions.opportunity.discovered).toBe(true)
    expect(discovered.missions.opportunity.scannedComponentIds).toEqual([])
    expect(discovered.missions.opportunity.stampEarned).toBe(false)
    expect(discovered.updatedAt).toBe(2000)

    expect(markMissionDiscovered(discovered, 'opportunity', 3000)).toBe(discovered)
    expect(markMissionDiscovered(save, 'apollo-11' as MissionId, 3000)).toBe(
      save,
    )
  })

  it('scans a valid component once and persists the progress snapshot', () => {
    const save = createDiscoveredJourney()
    const result = scanComponent(save, 'opportunity', 'opportunity-pancam', 2000)

    expect(result.status).toBe('scanned')
    expect(result.scannedCount).toBe(1)
    expect(result.fullScanUnlocked).toBe(false)
    expect(result.save.missions.opportunity.scannedComponentIds).toEqual([
      'opportunity-pancam',
    ])
    expect(result.save.updatedAt).toBe(2000)
    expect(save.missions.opportunity.scannedComponentIds).toEqual([])
  })

  it('does not record a scan before the explorer is discovered', () => {
    const save = createJourney('Ada', 1000)
    const result = scanComponent(save, 'opportunity', 'opportunity-pancam', 2000)

    expect(result.status).toBe('not-discovered')
    expect(result.scannedCount).toBe(0)
    expect(result.save).toBe(save)
    expect(save.missions.opportunity.discovered).toBe(false)
    expect(save.missions.opportunity.scannedComponentIds).toEqual([])

    const discovered = markMissionDiscovered(save, 'opportunity', 1100)
    const first = scanComponent(discovered, 'opportunity', 'opportunity-pancam', 2000)
    expect(first.status).toBe('scanned')
    expect(
      scanComponent(first.save, 'opportunity', 'opportunity-pancam', 3000).status,
    ).toBe('duplicate')
  })

  it('rejects components from another mission and unknown missions', () => {
    const save = createJourney('Ada', 1000)
    expect(scanComponent(save, 'opportunity', 'surveyor-3-tv-camera').status).toBe(
      'invalid-component',
    )
    expect(
      scanComponent(save, 'apollo-11' as MissionId, 'anything').status,
    ).toBe('unknown-mission')
  })

  it('never duplicates a scanned component', () => {
    const save = createDiscoveredJourney()
    const first = scanComponent(save, 'opportunity', 'opportunity-pancam', 2000)
    const duplicate = scanComponent(first.save, 'opportunity', 'opportunity-pancam', 3000)

    expect(duplicate.status).toBe('duplicate')
    expect(duplicate.scannedCount).toBe(1)
    expect(duplicate.save).toBe(first.save)
    expect(duplicate.save.updatedAt).toBe(2000)
  })

  it('recovers the memory with the third fragment, never earlier', () => {
    let save = createDiscoveredJourney()
    for (const componentId of SPIRIT_COMPONENTS.slice(0, 2)) {
      save = scanComponent(save, 'opportunity', componentId, 2000).save
      expect(save.missions.opportunity.memoryRecoveredAt).toBeNull()
    }
    save = scanComponent(save, 'opportunity', SPIRIT_COMPONENTS[2], 2500).save
    expect(countScannedComponents(save, 'opportunity')).toBe(3)
    expect(save.missions.opportunity.memoryRecoveredAt).toBe(2500)
    expect(isFullScanUnlocked(save, 'opportunity')).toBe(false)
  })
})

describe('Full recognition scan and memory core', () => {
  it('is locked before all three fragments', () => {
    const save = scanComponent(
      createDiscoveredJourney(),
      'opportunity',
      'opportunity-pancam',
    ).save
    const result = completeFullScan(save, 'opportunity', 3000)

    expect(result.status).toBe('locked')
    expect(result.save).toBe(save)
    expect(result.progress?.memoryRecoveredAt).toBeNull()
  })

  it('recovers memory exactly once for a legacy save stuck at 3/3', () => {
    const scanned = legacyScannedSave()
    const first = completeFullScan(scanned, 'opportunity', 3000)
    expect(first.status).toBe('memory-recovered')
    expect(first.save.missions.opportunity.fullScanCompletedAt).toBe(3000)
    expect(first.save.missions.opportunity.memoryRecoveredAt).toBe(3000)

    const repeat = completeFullScan(first.save, 'opportunity', 4000)
    expect(repeat.status).toBe('already-recovered')
    expect(repeat.save).toBe(first.save)
    expect(repeat.save.missions.opportunity.memoryRecoveredAt).toBe(3000)
  })

  it('rejects an unknown mission safely', () => {
    const save = createDiscoveredJourney()
    const result = completeFullScan(save, 'apollo-11' as MissionId)
    expect(result.status).toBe('unknown-mission')
    expect(result.save).toBe(save)
  })
})

describe('Smart letter, reconstruction and transmission', () => {
  it('requires the recovered memory before creating the letter', () => {
    const scanned = legacyScannedSave()
    const result = prepareSmartLetter(scanned, 'opportunity', 3000)
    expect(result.status).toBe('locked')
    expect(result.save).toBe(scanned)
  })

  it('creates one letter and unlocks the recreation', () => {
    const save = completeFullScan(scanAllSpirit(), 'opportunity', 3000).save
    const first = prepareSmartLetter(save, 'opportunity', 4000)
    expect(first.status).toBe('created')
    expect(first.save.missions.opportunity.smartLetterCreatedAt).toBe(4000)

    const repeat = prepareSmartLetter(first.save, 'opportunity', 5000)
    expect(repeat.status).toBe('already-created')
    expect(repeat.save).toBe(first.save)

    const watched = markReconstructionWatched(first.save, 'opportunity', 6000)
    expect(watched.status).toBe('watched')
    expect(watched.save.missions.opportunity.reconstructionWatchedAt).toBe(6000)

    const replay = markReconstructionWatched(watched.save, 'opportunity', 7000)
    expect(replay.status).toBe('already-watched')
    expect(replay.save).toBe(watched.save)
  })

  it('never lets the recreation create rewards', () => {
    const save = createDiscoveredJourney()
    const locked = markReconstructionWatched(save, 'opportunity', 2000)
    expect(locked.status).toBe('locked')
    expect(locked.save).toBe(save)
  })

  it('transmits only a prepared smart letter and never duplicates the stamp', () => {
    const mission = getMission('opportunity')
    const scanned = scanAllSpirit()

    const missing = transmitLetter(scanned, 'opportunity', 3000)
    expect(missing.status).toBe('letter-missing')
    expect(missing.save).toBe(scanned)
    expect(missing.stampId).toBeNull()

    const letter = readyLetter()
    const delivered = transmitLetter(letter, 'opportunity', 5000)
    expect(delivered.status).toBe('transmitted')
    expect(delivered.stampId).toBe(mission.stampId)
    expect(delivered.save.missions.opportunity.transmittedAt).toBe(5000)
    expect(delivered.save.missions.opportunity.stampEarned).toBe(true)
    expect(getEarnedStampIds(delivered.save)).toEqual(['opportunity'])

    const repeat = transmitLetter(delivered.save, 'opportunity', 6000)
    expect(repeat.status).toBe('already-transmitted')
    expect(repeat.save).toBe(delivered.save)
    expect(repeat.save.missions.opportunity.transmittedAt).toBe(5000)
    expect(getEarnedStampIds(repeat.save)).toEqual(['opportunity'])
  })

  it('records exactly one stamp per transmitted mission', () => {
    let save = createDiscoveredJourney()
    let now = 2000

    for (const mission of ACTIVE_MISSION_IDS.map((id) => getMission(id))) {
      for (const component of mission.components) {
        save = scanComponent(save, mission.id, component.id, now).save
        now += 1
      }
      save = completeFullScan(save, mission.id, now).save
      now += 1
      save = prepareSmartLetter(save, mission.id, now).save
      now += 1
      save = transmitLetter(save, mission.id, now).save
      now += 1
    }

    expect(getEarnedStampIds(save)).toEqual([...ACTIVE_MISSION_IDS])
    expect(new Set(getEarnedStampIds(save)).size).toBe(ACTIVE_MISSION_IDS.length)
    expect(areAllMissionsComplete(save)).toBe(true)
  })

  it('reports an unknown mission safely', () => {
    const save = createDiscoveredJourney()
    expect(
      prepareSmartLetter(save, 'apollo-11' as MissionId).status,
    ).toBe('unknown-mission')
    expect(transmitLetter(save, 'apollo-11' as MissionId).status).toBe(
      'unknown-mission',
    )
  })
})

describe('Reset pilot rules', () => {
  it('clears only the selected mission while preserving identity and others', () => {
    let save = createDiscoveredJourney()
    save = markOnboardingComplete(
      setCurrentDestination(save, 'mars', 1100),
      1200,
    )
    save = readyLetter(save)
    save = transmitLetter(save, 'opportunity', 5000).save
    save = scanComponent(
      save,
      'surveyor-3',
      'surveyor-3-tv-camera',
      6000,
    ).save

    const surveyorBefore = save.missions['surveyor-3']
    const reset = resetMissionProgress(save, 'opportunity', 7000)

    expect(reset.missions.opportunity).toEqual(createMissionProgress())
    expect(countScannedComponents(reset, 'opportunity')).toBe(0)
    expect(isMissionComplete(reset, 'opportunity')).toBe(false)
    expect(getEarnedStampIds(reset)).toEqual([])

    expect(reset.missions['surveyor-3']).toEqual(surveyorBefore)
    expect(reset.playerName).toBe('Ada')
    expect(reset.schemaVersion).toBe(save.schemaVersion)
    expect(reset.onboardingComplete).toBe(true)
    expect(reset.currentDestination).toBe('mars')
    expect(reset.createdAt).toBe(save.createdAt)
    expect(reset.updatedAt).toBe(7000)
    expect(save.missions.opportunity.stampEarned).toBe(true)
  })

  it('returns the same save for an unknown mission', () => {
    const save = createJourney('Ada', 1000)
    expect(resetMissionProgress(save, 'apollo-11' as MissionId, 2000)).toBe(
      save,
    )
  })
})

describe('progress survives a reload', () => {
  it('persists scans, memory, letter and transmission through v4 storage', () => {
    const storage = new MemoryStorage()
    let save = readyLetter()
    expect(saveJourney(storage, save)).toBe(true)

    const loaded = loadJourney(storage).save
    expect(loaded).not.toBeNull()
    expect(loaded!.missions.opportunity.scannedComponentIds).toEqual([
      ...SPIRIT_COMPONENTS,
    ])
    expect(loaded!.missions.opportunity.memoryRecoveredAt).not.toBeNull()
    expect(loaded!.missions.opportunity.smartLetterCreatedAt).not.toBeNull()

    save = transmitLetter(loaded!, 'opportunity', 7000).save
    expect(saveJourney(storage, save)).toBe(true)

    const reloaded = loadJourney(storage).save
    expect(reloaded).not.toBeNull()
    expect(reloaded!.missions.opportunity.stampEarned).toBe(true)
    expect(reloaded!.missions.opportunity.transmittedAt).toBe(7000)
    expect(getEarnedStampIds(reloaded!)).toEqual(['opportunity'])
    expect(areAllMissionsComplete(reloaded!)).toBe(false)
  })
})

describe('journey flags', () => {
  it('updates destination, intro, onboarding and final quote immutably', () => {
    const save = createJourney('Ada', 1000)

    const withDestination = setCurrentDestination(save, 'deep-space', 2000)
    expect(withDestination.currentDestination).toBe('deep-space')
    expect(withDestination.updatedAt).toBe(2000)
    expect(save.currentDestination).toBeNull()

    const withIntro = markIntroSeen(withDestination, 3000)
    expect(withIntro.introSeen).toBe(true)
    expect(withIntro.onboardingComplete).toBe(false)

    const withOnboarding = markOnboardingComplete(withIntro, 4000)
    expect(withOnboarding.introSeen).toBe(true)
    expect(withOnboarding.onboardingComplete).toBe(true)

    const withQuote = markFinalQuoteShown(withOnboarding, 5000)
    expect(withQuote.finalQuoteShown).toBe(true)
    expect(withQuote.updatedAt).toBe(5000)
  })
})

describe('optional environmental discoveries', () => {
  it('records quick and detailed readings separately from mission progress', () => {
    const save = createJourney('Ada', 1000)
    const quick = recordEnvironmentalScan(
      save,
      'env-soil-landing',
      false,
      2000,
    )
    expect(quick.status).toBe('quick')
    expect(quick.save.environmentalDiscoveries).toEqual([
      'env-soil-landing',
    ])
    expect(quick.save.environmentalDetailedDiscoveries).toEqual([])
    expect(quick.save.missions.opportunity).toEqual(save.missions.opportunity)
    expect(getMissionStage(quick.save.missions.opportunity)).toBe('unknown')

    const detailed = recordEnvironmentalScan(
      quick.save,
      'env-soil-landing',
      true,
      3000,
    )
    expect(detailed.status).toBe('detailed')
    expect(detailed.save.environmentalDiscoveries).toEqual([
      'env-soil-landing',
    ])
    expect(detailed.save.environmentalDetailedDiscoveries).toEqual([
      'env-soil-landing',
    ])
    expect(getMissionStage(detailed.save.missions.opportunity)).toBe('unknown')
  })

  it('is idempotent and rejects unknown sites', () => {
    const save = createJourney('Ada', 1000)
    const quick = recordEnvironmentalScan(
      save,
      'env-wind-passage',
      false,
      2000,
    )
    expect(
      recordEnvironmentalScan(quick.save, 'env-wind-passage', false, 3000)
        .status,
    ).toBe('duplicate')
    const detailed = recordEnvironmentalScan(
      quick.save,
      'env-wind-passage',
      true,
      3000,
    )
    expect(
      recordEnvironmentalScan(detailed.save, 'env-wind-passage', true, 4000)
        .status,
    ).toBe('duplicate')
    expect(
      recordEnvironmentalScan(save, 'not-a-site', true, 5000).status,
    ).toBe('unknown-site')
    expect(save.environmentalDiscoveries).toEqual([])
  })
})

describe('memorial field-note track', () => {
  it('records a memorial once and never touches mission progress', () => {
    const save = createJourney('Ada', 1000)
    const first = recordMemorialVisit(save, 'insight', 2000)
    expect(first.status).toBe('recorded')
    expect(first.save.memorialVisits).toEqual(['insight'])
    expect(first.save.missions).toBe(save.missions)

    const again = recordMemorialVisit(first.save, 'insight', 3000)
    expect(again.status).toBe('duplicate')
    expect(again.save).toBe(first.save)
    expect(recordMemorialVisit(save, 'not-a-site').status).toBe(
      'unknown-memorial',
    )
  })

  it('never grants a stamp, memory or stage', () => {
    let save = createJourney('Ada', 1000)
    for (const id of ['opportunity', 'viking1', 'ingenuity', 'insight']) {
      save = recordMemorialVisit(save, id).save
    }
    save = recordEnvironmentalScan(save, 'env-volcanic-landing', true).save
    expect(getEarnedStampIds(save)).toEqual([])
    expect(getMissionStage(save.missions.opportunity)).toBe('unknown')
    expect(save.missions.opportunity.stampEarned).toBe(false)
  })
})
