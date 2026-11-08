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
 * Descriptions are intentionally short and factual. Verify the linked NASA
 * sources again before publishing final educational content.
 */
export const MARS_OBJECTS: readonly MarsObject[] = [
  {
    id: 'opportunity',
    name: 'Opportunity',
    zone: 'mars',
    position: { x: -18, z: 5 },
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
    position: { x: -19, z: -16 },
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
    position: { x: 20, z: -17 },
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
    position: { x: 14, z: 7 },
    state: 'available',
    description:
      'A lander that listened for marsquakes and studied the interior of Mars between 2018 and 2022.',
    sources: ['https://science.nasa.gov/mission/insight/'],
    lastReviewed: '2026-11-08',
  },
]
