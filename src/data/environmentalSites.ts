/**
 * Optional environmental scan targets for the Mars expedition. They are
 * observation-only: they never unlock historical fragments, memories, letters
 * or stamps. The scanner compares visible features with reference geology;
 * it does not claim a chemical analysis from appearance alone.
 */

import { CALIBRATION_SAMPLE } from './calibrationSample'
import { pipLine } from './pipVoiceCatalog'
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
  /** Short result after the quick hold (reading card / passport). */
  quickLine: string
  /** Deeper context after the detailed hold. */
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
    quickLine: pipLine('mars-env-volcanic-quick'),
    detailedLine: pipLine('mars-env-volcanic-detail'),
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
    quickLine: pipLine('mars-env-soil-quick'),
    detailedLine: pipLine('mars-env-soil-detail'),
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
    quickLine: pipLine('mars-env-wind-quick'),
    detailedLine: pipLine('mars-env-wind-detail'),
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
    quickLine: pipLine('mars-env-outcrop-quick'),
    detailedLine: pipLine('mars-env-outcrop-detail'),
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
    quickLine: pipLine('mars-env-volcanic-quick'),
    detailedLine: pipLine('mars-env-volcanic-detail'),
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
    quickLine: pipLine('mars-env-soil-quick'),
    detailedLine: pipLine('mars-env-soil-detail'),
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
    quickLine: pipLine('mars-env-outcrop-quick'),
    detailedLine: pipLine('mars-env-outcrop-detail'),
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
    quickLine: pipLine('mars-env-wind-quick'),
    detailedLine: pipLine('mars-env-wind-detail'),
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
 * Scanner-facing view of the calibration sample. It is resolved here so the
 * scanner and HUD can treat it as a target, but it is deliberately absent
 * from ENVIRONMENTAL_SITES and BY_ID: no save entry, no field note.
 */
const CALIBRATION_AS_SITE: EnvironmentalSite = {
  id: CALIBRATION_SAMPLE.id,
  category: 'volcanic-rock',
  categoryLabel: 'Calibration',
  name: CALIBRATION_SAMPLE.name,
  shortName: 'Calibration sample',
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
