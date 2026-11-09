export type ZoneId = 'moon' | 'mars' | 'deep-space'

export type ObjectState =
  | 'coming-soon'
  | 'available'
  | 'in-progress'
  | 'rescued'

export type MarsObjectId = 'opportunity' | 'viking1' | 'ingenuity' | 'insight'

export interface WorldPosition {
  x: number
  z: number
}

export interface MarsObject {
  id: MarsObjectId
  name: string
  zone: Extract<ZoneId, 'mars'>
  position: WorldPosition
  state: ObjectState
  description: string
  sources: readonly string[]
  lastReviewed: string
}

/**
 * The four Mars sites in the vertical slice. Positions are the single source of
 * truth for terrain clearings, path tinting and placeholder placement.
 *
 * Semi-open level design (Fase 5): the four regions sit in separate
 * quadrants around the spawn so no two explorers are visible at once from
 * landing. These are stylized educational recreations, not real locations.
 *
 * Descriptions are intentionally short and factual. Verify the linked NASA
 * sources again before publishing final educational content.
 */
export const MARS_OBJECTS: readonly MarsObject[] = [
  {
    id: 'opportunity',
    name: 'Opportunity',
    zone: 'mars',
    position: { x: -58, z: 12 },
    state: 'available',
    description:
      'A NASA rover that explored Meridiani Planum from 2004 to 2018, far beyond its planned 90-day mission.',
    sources: ['https://science.nasa.gov/mission/mer-opportunity/'],
    lastReviewed: '2026-11-08',
  },
  {
    id: 'viking1',
    name: 'Viking 1',
    zone: 'mars',
    position: { x: -50, z: -36 },
    state: 'coming-soon',
    description:
      "NASA's first successful Mars lander. Viking 1 operated on the surface from 1976 to 1982.",
    sources: ['https://science.nasa.gov/mission/viking/'],
    lastReviewed: '2026-11-08',
  },
  {
    id: 'ingenuity',
    name: 'Ingenuity',
    zone: 'mars',
    position: { x: 52, z: -24 },
    state: 'available',
    description:
      'The first aircraft to fly on another planet. It completed 72 flights between 2021 and 2024.',
    sources: [
      'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/',
    ],
    lastReviewed: '2026-11-08',
  },
  {
    id: 'insight',
    name: 'InSight',
    zone: 'mars',
    position: { x: 50, z: 18 },
    state: 'available',
    description:
      'A lander that listened for marsquakes and studied the interior of Mars between 2018 and 2022.',
    sources: ['https://science.nasa.gov/mission/insight/'],
    lastReviewed: '2026-11-08',
  },
]

/** Shared identity per region: geography + PIP's short English orientation. */
export interface RegionInfo {
  /** Stylized microenvironment name shown to players. */
  regionName: string
  /** Brief field-guide line for the HUD / site card. */
  regionTagline: string
  /** PIP's one-line reaction when the region is first approached. */
  pipMessage: string
}

export const REGION_INFO: Readonly<Record<MarsObjectId, RegionInfo>> = {
  opportunity: {
    regionName: 'Valley of Echoes',
    regionTagline: 'A valley of old tracks and layered rocks.',
    pipMessage: 'Wow! Valley of Echoes! Look, old rover tracks!',
  },
  insight: {
    regionName: 'Silent Plains',
    regionTagline: 'A quiet plain of fine dust and listening tools.',
    pipMessage: 'Hush now! Silent Plains. Listen with me!',
  },
  ingenuity: {
    regionName: 'First Flight Dunes',
    regionTagline: 'Smooth dunes and a wide sky for a first flight.',
    pipMessage: 'First Flight Dunes! Whoa. The sky is so wide here.',
  },
  viking1: {
    regionName: 'Ancient Lands',
    regionTagline: 'Old, dark and rocky land. Coming soon.',
    pipMessage: 'Ancient Lands. Whoa! This place feels old.',
  },
}

/** Radius around a site that counts as "approaching the region". */
export const REGION_APPROACH_RADIUS = 22
