/**
 * Field notes for the passport / album: optional context unlocked by the
 * Mars environmental readings and the four secondary memorials.
 *
 * They are deliberately separate from mission progress. They never touch
 * `stampEarned`, the memory core, the smart letter or any mission stage,
 * and they are never mixed into the smart letter.
 *
 * Content rules:
 * - Every statement is backed by the linked NASA pages (`source-checked`).
 *   Claims that could not be verified were left out on purpose: e.g. that
 *   Martian rocks are "basalt" or that wind forms "ripples" are NOT stated.
 * - Identity discipline: notes never name the Spirit rover (a mission
 *   explorer whose identity is only revealed on discovery). Facts that come
 *   from it are attributed to "a NASA rover".
 */

import type { EnvironmentalCategoryId } from './environmentalSites'
import { ENVIRONMENTAL_SITES } from './environmentalSites'
import type { MarsObjectId } from './marsObjects'

export interface FieldNoteSource {
  label: string
  url: string
}

export interface FieldNote {
  id: string
  kind: 'environment' | 'memorial'
  title: string
  body: string
  sources: readonly FieldNoteSource[]
  validation: 'source-checked'
  lastReviewed: string
}

const REVIEWED = '2026-11-11'

const NASA_MARS_FACTS: FieldNoteSource = {
  label: 'NASA Science — Mars facts',
  url: 'https://science.nasa.gov/mars/facts/',
}
const NASA_MER_SPIRIT: FieldNoteSource = {
  label: 'NASA Science — Mars Exploration Rover mission',
  url: 'https://science.nasa.gov/mission/mer-spirit/',
}
const NASA_MER_OPPORTUNITY: FieldNoteSource = {
  label: 'NASA Science — Mars Exploration Rover Opportunity',
  url: 'https://science.nasa.gov/mission/mer-opportunity/',
}
const NASA_MER_HIGHLIGHTS: FieldNoteSource = {
  label: 'NASA Science — Rover science highlights',
  url: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/',
}

export const ENVIRONMENT_FIELD_NOTES: Readonly<
  Record<EnvironmentalCategoryId, FieldNote>
> = {
  'volcanic-rock': {
    id: 'note-volcanic-rock',
    kind: 'environment',
    title: 'Volcanic rock',
    body: 'Mars has a volcanic past. A NASA rover found that an ancient volcano erupted at a place called Home Plate. The scanner only compares what it sees; it cannot tell what a rock is made of.',
    sources: [NASA_MER_HIGHLIGHTS],
    validation: 'source-checked',
    lastReviewed: REVIEWED,
  },
  'martian-soil': {
    id: 'note-martian-soil',
    kind: 'environment',
    title: 'Martian soil',
    body: 'The surface of Mars is made of rock, regolith (what we call Martian "soil") and dust. A NASA rover once scraped away the top layer of soil and uncovered bright, silica-rich dust that pointed to contact between soil and water.',
    sources: [NASA_MARS_FACTS, NASA_MER_SPIRIT],
    validation: 'source-checked',
    lastReviewed: REVIEWED,
  },
  'wind-formation': {
    id: 'note-wind-formation',
    kind: 'environment',
    title: 'Wind on Mars',
    body: 'Winds on Mars are strong enough to raise dust storms. A NASA rover filmed dust devils crossing the plain, a close look at what wind does to the surface.',
    sources: [NASA_MARS_FACTS, NASA_MER_SPIRIT],
    validation: 'source-checked',
    lastReviewed: REVIEWED,
  },
  'geological-outcrop': {
    id: 'note-geological-outcrop',
    kind: 'environment',
    title: 'Layered rock',
    body: 'Rock layers can record what a place was like long ago. Opportunity found one layer formed in acidic, wet conditions and an older one from a more neutral environment. Another NASA rover found rocks altered by water.',
    sources: [NASA_MER_OPPORTUNITY, NASA_MER_SPIRIT],
    validation: 'source-checked',
    lastReviewed: REVIEWED,
  },
}

export const MEMORIAL_FIELD_NOTES: Readonly<Record<MarsObjectId, FieldNote>> =
  {
    opportunity: {
      id: 'note-opportunity',
      kind: 'memorial',
      title: 'Opportunity',
      body: 'Opportunity landed on Mars on 24 January 2004 and its last communication came on 10 June 2018. NASA says it exceeded its life expectancy by 60 times.',
      sources: [NASA_MER_OPPORTUNITY],
      validation: 'source-checked',
      lastReviewed: REVIEWED,
    },
    viking1: {
      id: 'note-viking1',
      kind: 'memorial',
      title: 'Viking 1',
      body: "Viking 1 was the first successful lander on Mars. It landed on 20 July 1976 and made its final transmission to Earth on 11 November 1982.",
      sources: [
        {
          label: 'NASA Science — Viking',
          url: 'https://science.nasa.gov/mission/viking/',
        },
      ],
      validation: 'source-checked',
      lastReviewed: REVIEWED,
    },
    ingenuity: {
      id: 'note-ingenuity',
      kind: 'memorial',
      title: 'Ingenuity',
      body: 'Ingenuity was the first aircraft to achieve powered, controlled flight on another planet. It completed 72 flights between 19 April 2021 and 18 January 2024.',
      sources: [
        {
          label: 'NASA Science — Ingenuity Mars Helicopter',
          url: 'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/',
        },
      ],
      validation: 'source-checked',
      lastReviewed: REVIEWED,
    },
    insight: {
      id: 'note-insight',
      kind: 'memorial',
      title: 'InSight',
      body: 'InSight launched on 5 May 2018 to study the deep interior of Mars. Its mission ended on 15 December 2022.',
      sources: [
        {
          label: 'NASA Science — InSight',
          url: 'https://science.nasa.gov/mission/insight/',
        },
      ],
      validation: 'source-checked',
      lastReviewed: REVIEWED,
    },
  }

export interface FieldNoteEntry {
  note: FieldNote
  unlocked: boolean
  /** e.g. "2 of 3 sites observed" for an environmental category. */
  detail: string | null
}

export interface FieldNotesView {
  entries: FieldNoteEntry[]
  unlockedCount: number
  totalCount: number
}

interface FieldNotesInput {
  environmentalDiscoveries: readonly string[]
  memorialVisits: readonly string[]
}

/** Pure projection for the passport. Reads only the optional tracks. */
export function getFieldNotesView(save: FieldNotesInput): FieldNotesView {
  const observed = new Set(save.environmentalDiscoveries)
  const visited = new Set(save.memorialVisits)
  const entries: FieldNoteEntry[] = []

  for (const [category, note] of Object.entries(ENVIRONMENT_FIELD_NOTES) as [
    EnvironmentalCategoryId,
    FieldNote,
  ][]) {
    const sites = ENVIRONMENTAL_SITES.filter((s) => s.category === category)
    const seen = sites.filter((s) => observed.has(s.id)).length
    entries.push({
      note,
      unlocked: seen > 0,
      detail: `${seen} of ${sites.length} sites observed`,
    })
  }
  for (const [id, note] of Object.entries(MEMORIAL_FIELD_NOTES) as [
    MarsObjectId,
    FieldNote,
  ][]) {
    entries.push({ note, unlocked: visited.has(id), detail: null })
  }
  return {
    entries,
    unlockedCount: entries.filter((e) => e.unlocked).length,
    totalCount: entries.length,
  }
}
