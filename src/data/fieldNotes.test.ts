import { describe, expect, it } from 'vitest'
import { ENVIRONMENTAL_CATEGORY_IDS } from './environmentalSites'
import {
  ENVIRONMENT_FIELD_NOTES,
  MEMORIAL_FIELD_NOTES,
  getFieldNotesView,
} from './fieldNotes'
import { MARS_OBJECTS } from './marsObjects'
import { MISSIONS } from './missions'

const ALL_NOTES = [
  ...Object.values(ENVIRONMENT_FIELD_NOTES),
  ...Object.values(MEMORIAL_FIELD_NOTES),
]

describe('field notes content', () => {
  it('covers every environmental category and every memorial', () => {
    expect(Object.keys(ENVIRONMENT_FIELD_NOTES).sort()).toEqual(
      [...ENVIRONMENTAL_CATEGORY_IDS].sort(),
    )
    expect(Object.keys(MEMORIAL_FIELD_NOTES).sort()).toEqual(
      MARS_OBJECTS.map((o) => o.id).sort(),
    )
    expect(new Set(ALL_NOTES.map((n) => n.id)).size).toBe(ALL_NOTES.length)
  })

  it('is source-checked with NASA sources on every note', () => {
    for (const note of ALL_NOTES) {
      expect(note.validation).toBe('source-checked')
      expect(note.sources.length).toBeGreaterThan(0)
      for (const source of note.sources) {
        expect(source.url).toMatch(/^https:\/\/science\.nasa\.gov\//)
      }
    }
  })

  it('never names the Spirit rover (identity discipline)', () => {
    const spirit = MISSIONS.find((m) => m.id === 'spirit')!.machineName
    for (const note of ALL_NOTES) {
      expect(note.title).not.toContain(spirit)
      expect(note.body).not.toContain(spirit)
    }
  })

  it('does not state claims that could not be verified', () => {
    const text = ALL_NOTES.map((n) => n.body).join(' ')
    expect(text).not.toMatch(/basalt/i)
    expect(text).not.toMatch(/ripple|dune/i)
    expect(text).not.toMatch(/hematite|blueberr/i)
    expect(text).not.toMatch(/marsquake/i)
  })
})

describe('field notes projection', () => {
  it('starts fully locked with only what is on the ground today', () => {
    const view = getFieldNotesView({
      environmentalDiscoveries: [],
      memorialVisits: [],
    })
    // Volcanic rocks and layered outcrops; soil/wind marks and the other
    // missions' memorials are no longer on this map.
    expect(view.totalCount).toBe(2)
    expect(view.unlockedCount).toBe(0)
  })

  it('keeps notes an older save already earned', () => {
    const view = getFieldNotesView({
      environmentalDiscoveries: ['env-soil-landing'],
      memorialVisits: ['viking1'],
    })
    expect(view.totalCount).toBe(4)
    expect(view.unlockedCount).toBe(2)
  })

  it('unlocks a category note from any of its sites and counts them', () => {
    const view = getFieldNotesView({
      environmentalDiscoveries: ['env-volcanic-landing'],
      memorialVisits: ['insight'],
    })
    expect(view.unlockedCount).toBe(2)
    const volcanic = view.entries.find(
      (e) => e.note.id === ENVIRONMENT_FIELD_NOTES['volcanic-rock'].id,
    )
    expect(volcanic?.unlocked).toBe(true)
    expect(volcanic?.detail).toMatch(/^1 of \d+ sites observed$/)
    const insight = view.entries.find((e) => e.note.id === 'note-insight')
    expect(insight?.unlocked).toBe(true)
  })
})
