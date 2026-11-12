/**
 * Cosmic Mail destinations. Navigation content only: names and clues,
 * never the identity of the historical machine before discovery.
 * Moon and Deep Space are visible but not playable in this block.
 */

import type { DestinationId, MissionId } from './missions'

export type PlanetKind = 'earth' | DestinationId

export interface Destination {
  id: DestinationId
  name: string
  glyph: string
  accent: string
  missionId: MissionId
  /** Child-friendly clue, with no machine name. */
  clue: string
  /** Only Mars has a playable world today. */
  available: boolean
}

export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'moon',
    name: 'Moon',
    glyph: '🌕',
    accent: '#d9c7c2',
    missionId: 'surveyor-3',
    clue: 'A clue on the lunar surface.',
    available: false,
  },
  {
    id: 'mars',
    name: 'Mars',
    glyph: '🔴',
    accent: '#f2b28c',
    missionId: 'spirit',
    clue: 'A mystery among the red rocks.',
    available: true,
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    glyph: '✨',
    accent: '#b8a6d9',
    missionId: 'pioneer-10',
    clue: 'A story traveling beyond the planets.',
    available: false,
  },
]

export function getDestination(id: DestinationId): Destination {
  const destination = DESTINATIONS.find((entry) => entry.id === id)
  if (!destination) throw new Error(`Unknown destination: ${id}`)
  return destination
}

export function destinationPlanetKind(
  destination: string | null | undefined,
): PlanetKind {
  if (
    destination === 'moon' ||
    destination === 'mars' ||
    destination === 'deep-space'
  ) {
    return destination
  }
  return 'earth'
}
