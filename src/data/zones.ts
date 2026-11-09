/**
 * Route destinations for the Cosmic Mail Carrier. Content only.
 *
 * Mars is playable now and its objects come from marsObjects.ts (the
 * single source of truth). Moon and Deep Space are "coming soon" with
 * their planned objects from the design document.
 */

import { MARS_OBJECTS } from './marsObjects'

export type ZoneId = 'moon' | 'mars' | 'deep-space'

export interface Zone {
  id: ZoneId
  name: string
  glyph: string
  accent: string
  enabled: boolean
  objects: readonly string[]
}

export const ZONES: readonly Zone[] = [
  {
    id: 'moon',
    name: 'Moon',
    glyph: '🌕',
    accent: '#d9c7c2',
    enabled: false,
    objects: [
      'Apollo 11 Descent Stage',
      'Laser Retroreflector',
      'Apollo 17 Lunar Rover',
      'Surveyor 3',
    ],
  },
  {
    id: 'mars',
    name: 'Mars',
    glyph: '🔴',
    accent: '#f2b28c',
    enabled: true,
    objects: MARS_OBJECTS.map((site) => site.name),
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    glyph: '✨',
    accent: '#b8a6d9',
    enabled: false,
    objects: ['Voyager 1', 'Voyager 2', 'Pioneer 10', 'New Horizons'],
  },
]

export function getZone(id: ZoneId): Zone {
  const zone = ZONES.find((entry) => entry.id === id)
  if (!zone) throw new Error(`Unknown zone: ${id}`)
  return zone
}

/**
 * Which planet to draw for a given destination id. Earth is home —
 * it is the main-menu planet and the cabin default before any
 * mission is recorded. Unknown/null destinations fall back to Earth.
 */
export type PlanetKind = 'earth' | ZoneId

export function destinationPlanetKind(destination: string | null | undefined): PlanetKind {
  if (destination === 'moon' || destination === 'mars' || destination === 'deep-space') {
    return destination
  }
  return 'earth'
}
