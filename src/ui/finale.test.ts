import { describe, expect, it } from 'vitest'
import { ACTIVE_MISSION_IDS, getMission } from '../data/missions'
import { PIP_VOICE_LINE_CATALOG } from '../data/pipVoiceCatalog'
import { createJourney } from '../store/journeySchema'
import { keepsakeDataFor } from './keepsakeData'

describe('journey finale', () => {
  it('records every finale line for PIP', () => {
    const keys = new Set(PIP_VOICE_LINE_CATALOG.map((line) => line.key))
    for (const key of ['finale-last-story', 'finale-wake', 'finale-files', 'finale-memory', 'finale-thanks', 'finale-keepsake']) {
      expect(keys.has(key), key).toBe(true)
    }
  })

  it('fills the keepsakes with the carrier and every explorer, with no agency names', () => {
    const save = createJourney('Ada', 1000)
    const data = keepsakeDataFor(save, new Date(Date.UTC(2026, 10, 15, 12)))
    expect(data.carrierName).toBe('Ada')
    expect(data.carrierId).toMatch(/^CM-\d{5}$/)
    expect(data.date).toBe('15 November 2026')
    expect(data.explorers.map((e) => e.name)).toEqual(ACTIVE_MISSION_IDS.map((id) => getMission(id).machineName))
    expect(new Set(data.explorers.map((e) => e.world))).toEqual(new Set(['Moon', 'Mars']))
    for (const explorer of data.explorers) {
      expect(explorer.year).toMatch(/^\d{4}$/)
      expect(`${explorer.name} ${explorer.world}`).not.toMatch(/nasa/i)
    }
  })
})
