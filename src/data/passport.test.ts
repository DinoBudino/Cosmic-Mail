import { describe, expect, it } from 'vitest'
import { getMission } from './missions'
import {
  STORY_STATUS_LABEL,
  getPassportView,
  getStoryForMission,
} from './passport'
import {
  createJourney,
  createMissionProgress,
  migrateV3Save,
} from '../store/journeySchema'
import {
  completeFullScan,
  markMissionDiscovered,
  prepareSmartLetter,
  scanComponent,
  transmitLetter,
} from '../store/journeyLogic'

const ALL_SPIRIT = [
  'spirit-pancam',
  'spirit-rock-abrasion-tool',
  'spirit-mini-tes',
] as const

function scanAll(save = createJourney('Ada', 1000)) {
  return ALL_SPIRIT.reduce(
    (current, componentId, index) =>
      scanComponent(current, 'spirit', componentId, 2000 + index).save,
    save,
  )
}

describe('Cosmic Passport projection', () => {
  it('shows the carrier name and a stable carrier id', () => {
    const save = createJourney('Ada', 123456)
    const view = getPassportView(save)
    expect(view.carrierName).toBe('Ada')
    expect(view.carrierId).toMatch(/^CM-\d{5}$/)
    expect(view.stories).toHaveLength(3)
    expect(view.transmittedCount).toBe(0)
  })

  it('keeps machine names hidden until discovery', () => {
    const save = createJourney('Ada', 1000)
    const view = getPassportView(save)
    const mars = view.stories.find((story) => story.missionId === 'spirit')!
    expect(mars.machineName).toBeNull()
    expect(mars.status).toBe('unknown')
    expect(STORY_STATUS_LABEL[mars.status]).toBe('Unidentified signal')

    const discovered = markMissionDiscovered(save, 'spirit', 2000)
    const discoveredMars = getStoryForMission(discovered, 'spirit')!
    expect(discoveredMars.machineName).toBe('Spirit')
    expect(discoveredMars.status).toBe('discovered')
    expect(discoveredMars.statusLabel).toBe('Explorer identified')
  })

  it('exposes each A stage instead of collapsing it into a seal', () => {
    let save = markMissionDiscovered(createJourney('Ada', 1000), 'spirit', 1100)
    save = scanComponent(save, 'spirit', ALL_SPIRIT[0], 1200).save

    const investigating = getStoryForMission(save, 'spirit')!
    expect(investigating.status).toBe('investigating')
    expect(investigating.scanned).toBe(1)
    expect(investigating.memoryRecovered).toBe(false)
    expect(investigating.stampEarned).toBe(false)

    save = scanAll(save)
    const ready = getStoryForMission(save, 'spirit')!
    expect(ready.status).toBe('ready_for_full_scan')
    expect(ready.hasSmartLetter).toBe(false)
    expect(ready.canTransmit).toBe(false)

    save = completeFullScan(save, 'spirit', 3000).save
    const recovered = getStoryForMission(save, 'spirit')!
    expect(recovered.status).toBe('memory_recovered')
    expect(recovered.memoryRecovered).toBe(true)
    expect(recovered.stampEarned).toBe(false)

    save = prepareSmartLetter(save, 'spirit', 4000).save
    const letter = getStoryForMission(save, 'spirit')!
    expect(letter.status).toBe('smart_letter_ready')
    expect(letter.hasSmartLetter).toBe(true)
    expect(letter.canTransmit).toBe(true)
    expect(letter.stampEarned).toBe(false)

    save = transmitLetter(save, 'spirit', 5000).save
    const transmitted = getStoryForMission(save, 'spirit')!
    expect(transmitted.status).toBe('transmitted')
    expect(transmitted.stampEarned).toBe(true)
    expect(transmitted.stampLabel).toBe(getMission('spirit').stampLabel)
    expect(transmitted.canTransmit).toBe(false)
    expect(getPassportView(save).transmittedCount).toBe(1)
  })

  it('shows a legacy B seal as history, never as an Archive delivery', () => {
    const migrated = migrateV3Save({
      schemaVersion: 3,
      playerName: 'Ada',
      missions: {
        spirit: {
          discovered: true,
          scannedComponentIds: [...ALL_SPIRIT],
          letterCompletedAt: 900,
          stampEarned: true,
        },
      },
      createdAt: 1,
      updatedAt: 900,
    })!
    const story = getStoryForMission(migrated, 'spirit')!
    expect(story.legacySealAt).toBe(900)
    expect(story.stampEarned).toBe(false)
    expect(story.status).not.toBe('transmitted')
    expect(getPassportView(migrated).transmittedCount).toBe(0)
  })

  it('never marks a mission undiscovered when scans already exist', () => {
    const save = createJourney('Ada', 1000)
    save.missions.spirit = {
      ...createMissionProgress(),
      scannedComponentIds: ['spirit-pancam'],
    }
    const story = getStoryForMission(save, 'spirit')!
    expect(story.machineName).toBe('Spirit')
    expect(story.status).toBe('investigating')
  })
})
