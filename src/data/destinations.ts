/**
 * Cosmic Mail destinations. Navigation content only: names and clues,
 * never the identity of the historical machine before discovery.
 * Two destinations: the Moon and Mars. Deep Space is out of scope (its
 * id stays in the save schema only for older saves).
 */

import type { DestinationId, MissionId } from './missions'

export type PlanetKind = 'earth' | DestinationId

export interface Destination {
  id: DestinationId
  name: string
  accent: string
  missionId: MissionId
  /** One-line description of the place for the navigation screen. */
  kind: string
  /** Child-friendly clue, with no machine name. */
  clue: string
  /**
   * What the ground looks like, in the game's own words. The navigation
   * screen deliberately shows no scientific figures (distances, gravity,
   * day length): only in-game, descriptive information.
   */
  terrain: string
  /** Whether the destination has a playable world yet. */
  available: boolean
}

export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'moon',
    name: 'Moon',
    accent: '#d9c7c2',
    missionId: 'surveyor-3',
    kind: "Earth's natural satellite",
    terrain: 'Gray dust and craters',
    clue: 'Two old explorers wait on the gray plains.',
    available: true,
  },
  {
    id: 'mars',
    name: 'Mars',
    accent: '#f2b28c',
    missionId: 'opportunity',
    kind: 'The red planet',
    terrain: 'Red dust and rocks',
    clue: 'A mystery among the red rocks.',
    available: true,
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
