/**
 * Optional environmental scan targets for the Mars expedition. They are
 * observation-only: they never unlock historical fragments, memories, letters
 * or stamps. The scanner compares visible features with reference geology;
 * it does not claim a chemical analysis from appearance alone.
 */

import { CALIBRATION_SAMPLE } from './calibrationSample'
import type { WorldPosition } from './marsObjects'

export const ENVIRONMENTAL_CATEGORY_IDS = [
  'volcanic-rock',
  'martian-soil',
  'wind-formation',
  'geological-outcrop',
] as const

export type EnvironmentalCategoryId =
  (typeof ENVIRONMENTAL_CATEGORY_IDS)[number]

export type EnvironmentalVisualKind = 'rock' | 'soil' | 'wind' | 'outcrop'

export interface EnvironmentalSite {
  id: string
  category: EnvironmentalCategoryId
  categoryLabel: string
  name: string
  shortName: string
  position: WorldPosition
  visual: EnvironmentalVisualKind
  /** Player-to-target range for a valid environmental reading. */
  scanRange: number
  /** Solid footprint for the larger outcrops/rocks; 0 for flat features. */
  collisionRadius: number
  /**
   * The only line PIP says about this site (P3, free exploration, max 15
   * words). Not a recorded line: it uses the controlled TTS fallback.
   */
  shortLine: string
  /** Short result shown on the scan reward card (not a PIP voice line). */
  quickLine: string
  /** Deeper context for records (not a PIP voice line). */
  detailedLine: string
  /** Optional archive/records text; cautious, non-chemical wording. */
  scienceNote: string
  sources: readonly string[]
}

export const ENVIRONMENTAL_SITES: readonly EnvironmentalSite[] = [
  {
    id: 'env-volcanic-landing',
    category: 'volcanic-rock',
    categoryLabel: 'Volcanic rock',
    name: 'Dark volcanic rock',
    shortName: 'Volcanic rock',
    position: { x: 5.5, z: 67 },
    visual: 'rock',
    scanRange: 10,
    collisionRadius: 1.1,
    shortLine: 'A dark, rough rock. Worth a closer look!',
    quickLine: "This dark rock looks volcanic. I am comparing its shape and tone with Martian basalt references.",
    detailedLine: "Volcanic rocks like this can preserve the story of ancient lava. The scanner sees a match in texture, but only a laboratory can confirm the minerals.",
    scienceNote:
      'Dark, fine-grained rocks are common on Mars. Their colour and texture are consistent with basaltic volcanic material, but a scanner reading is a comparison with reference samples, not a laboratory measurement.',
    sources: ['https://science.nasa.gov/mars/'],
  },
  {
    id: 'env-soil-landing',
    category: 'martian-soil',
    categoryLabel: 'Martian soil',
    name: 'Fine dusty regolith',
    shortName: 'Martian soil',
    position: { x: -6.5, z: 62 },
    visual: 'soil',
    scanRange: 9,
    collisionRadius: 0,
    shortLine: 'Fine, loose Martian dust. Easy for wind to move.',
    quickLine: "This looks like fine Martian dust over broken rock. The surface is loose and easy for the wind to move.",
    detailedLine: "The scanner sees a mix of dust and grains. Regolith covers much of Mars, and its patterns can hide the rock underneath.",
    scienceNote:
      'Regolith is the loose layer of dust, sand and broken rock at the surface. Fine dust can cover rocks and leave subtle wind-made patterns.',
    sources: ['https://science.nasa.gov/mars/'],
  },
  {
    id: 'env-wind-passage',
    category: 'wind-formation',
    categoryLabel: 'Wind formation',
    name: 'Wind-shaped ripple field',
    shortName: 'Wind ripples',
    position: { x: 14, z: 40 },
    visual: 'wind',
    scanRange: 10,
    collisionRadius: 0,
    shortLine: 'Streaks in the dust. They could be shaped by wind.',
    quickLine: "These streaks look shaped by the wind. The scanner is reading the ripple pattern, not the weather.",
    detailedLine: "Wind moves sand and dust into ripples and long streaks. The scanner compares the pattern with reference dunes. It is an observation, not a measurement of today's wind.",
    scienceNote:
      'Wind moves sand and dust into ripples and long streaks. The scanner reads the visible pattern and compares it with reference dune shapes; it does not measure the current wind.',
    sources: ['https://science.nasa.gov/mars/'],
  },
  {
    id: 'env-outcrop-viewpoint',
    category: 'geological-outcrop',
    categoryLabel: 'Geological outcrop',
    name: 'Layered viewpoint outcrop',
    shortName: 'Layered outcrop',
    position: { x: 19, z: 27 },
    visual: 'outcrop',
    scanRange: 11,
    collisionRadius: 1.9,
    shortLine: 'Layers of rock, stacked up. Interesting!',
    quickLine: "This layered outcrop may record ancient changes. The scanner sees stacked layers worth a closer look.",
    detailedLine: "Layered rocks can preserve evidence of past water or changing environments. The scanner compares the visible layers with reference geology; the full story needs more data.",
    scienceNote:
      'Layered outcrops can preserve a record of past environments. The scanner compares the visible layers with reference geology; the full story needs more data than one field reading.',
    sources: ['https://science.nasa.gov/mars/'],
  },
  {
    id: 'env-volcanic-passage',
    category: 'volcanic-rock',
    categoryLabel: 'Volcanic rock',
    name: 'Weathered basalt block',
    shortName: 'Basalt block',
    position: { x: -13, z: 24 },
    visual: 'rock',
    scanRange: 10,
    collisionRadius: 1.1,
    shortLine: 'Another dark, rough rock. Worth a closer look!',
    quickLine: "This dark rock looks volcanic. I am comparing its shape and tone with Martian basalt references.",
    detailedLine: "Volcanic rocks like this can preserve the story of ancient lava. The scanner sees a match in texture, but only a laboratory can confirm the minerals.",
    scienceNote:
      'This block has the dark tone and broken shape of weathered volcanic rock. The reading is an observation and a comparison, not a claim about its exact chemistry.',
    sources: ['https://science.nasa.gov/mars/'],
  },
  {
    id: 'env-soil-passage',
    category: 'martian-soil',
    categoryLabel: 'Martian soil',
    name: 'Dust-covered shelf',
    shortName: 'Dust shelf',
    position: { x: 4, z: 9 },
    visual: 'soil',
    scanRange: 9,
    collisionRadius: 0,
    shortLine: 'More fine, loose dust. Easy for wind to move.',
    quickLine: "This looks like fine Martian dust over broken rock. The surface is loose and easy for the wind to move.",
    detailedLine: "The scanner sees a mix of dust and grains. Regolith covers much of Mars, and its patterns can hide the rock underneath.",
    scienceNote:
      'A thin dust layer can hide the ground beneath it. The scanner sees a mix of fine grains and small fragments, a common surface cover on Mars.',
    sources: ['https://science.nasa.gov/mars/'],
  },
  {
    id: 'env-outcrop-explorer',
    category: 'geological-outcrop',
    categoryLabel: 'Geological outcrop',
    name: 'Explorer-site layered slab',
    shortName: 'Layered slab',
    position: { x: 12, z: -36 },
    visual: 'outcrop',
    scanRange: 11,
    collisionRadius: 1.9,
    shortLine: "Layers of rock again. Let's take a look!",
    quickLine: "This layered outcrop may record ancient changes. The scanner sees stacked layers worth a closer look.",
    detailedLine: "Layered rocks can preserve evidence of past water or changing environments. The scanner compares the visible layers with reference geology; the full story needs more data.",
    scienceNote:
      'Layered slabs near the explorer site invite a comparison with the rocks of this region. The scanner points out structure and texture, not a confirmed history of water.',
    sources: ['https://science.nasa.gov/mars/'],
  },
  {
    id: 'env-wind-explorer',
    category: 'wind-formation',
    categoryLabel: 'Wind formation',
    name: 'Sheltered wind streak',
    shortName: 'Wind streak',
    position: { x: -11, z: -52 },
    visual: 'wind',
    scanRange: 10,
    collisionRadius: 0,
    shortLine: 'More streaks in the dust. Perhaps wind-shaped.',
    quickLine: "These streaks look shaped by the wind. The scanner is reading the ripple pattern, not the weather.",
    detailedLine: "Wind moves sand and dust into ripples and long streaks. The scanner compares the pattern with reference dunes. It is an observation, not a measurement of today's wind.",
    scienceNote:
      'A wind streak records the direction of moving dust over time. It is a visible pattern, not a live weather measurement.',
    sources: ['https://science.nasa.gov/mars/'],
  },
]

export const ENVIRONMENTAL_SITE_IDS = ENVIRONMENTAL_SITES.map(
  (site) => site.id,
)

const BY_ID = new Map(ENVIRONMENTAL_SITES.map((site) => [site.id, site] as const))

/**
 * Scanner-facing view of the practice rock (ids keep the old name). It is resolved here so the
 * scanner and HUD can treat it as a target, but it is deliberately absent
 * from ENVIRONMENTAL_SITES and BY_ID: no save entry, no field note.
 */
const CALIBRATION_AS_SITE: EnvironmentalSite = {
  id: CALIBRATION_SAMPLE.id,
  category: 'volcanic-rock',
  categoryLabel: 'Practice',
  name: CALIBRATION_SAMPLE.name,
  shortName: 'Practice rock',
  position: CALIBRATION_SAMPLE.position,
  visual: 'rock',
  scanRange: CALIBRATION_SAMPLE.scanRange,
  collisionRadius: 0,
  shortLine: '',
  quickLine: '',
  detailedLine: '',
  scienceNote: '',
  sources: [],
}

export function getEnvironmentalSite(id: string): EnvironmentalSite | null {
  if (id === CALIBRATION_SAMPLE.id) return CALIBRATION_AS_SITE
  return BY_ID.get(id) ?? null
}

export function isEnvironmentalSiteId(value: unknown): value is string {
  return typeof value === 'string' && BY_ID.has(value)
}

/**
 * Sites actually placed on Mars. Flat soil patches and wind-ripple marks
 * were removed from the ground (they read as painted decals, not as real
 * terrain); their data stays so saved field notes keep loading.
 */
export const WORLD_ENVIRONMENTAL_SITES: readonly EnvironmentalSite[] =
  ENVIRONMENTAL_SITES.filter((site) => site.visual === 'rock' || site.visual === 'outcrop')
