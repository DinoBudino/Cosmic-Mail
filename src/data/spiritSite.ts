/**
 * Pilot mission site for the Mars explorer. Kept outside MARS_OBJECTS:
 * the four existing Mars sites, their flatten zones and the painted
 * route must stay untouched while the educational pilot is validated.
 */

import type { DestinationId, MissionId } from './missions'
import type { WorldPosition } from './marsObjects'

export interface MissionSite {
  missionId: MissionId
  destination: DestinationId
  label: string
  position: WorldPosition
  /** Distance at which the contextual Scan action appears. */
  interactionRadius: number
  /** Solid rover footprint; must stay smaller than interactionRadius. */
  collisionRadius: number
  /** Visible marker ring around the site. */
  ringRadius: number
  /** Camera clearance around the model. */
  cameraClearance: number
  /** PIP's first reaction when the player arrives. */
  pipMessage: string
  /** Honest label for the provisional 3D asset. */
  placeholderNote: string
}

export const SPIRIT_SITE: MissionSite = {
  missionId: 'spirit',
  destination: 'mars',
  label: 'Spirit',
  position: { x: 0, z: -45 },
  interactionRadius: 6.5,
  collisionRadius: 2.2,
  ringRadius: 5.2,
  cameraClearance: 3.6,
  pipMessage:
    "There! Something is resting in the dust. Let's inspect it with the scanner.",
  placeholderNote:
    'Development placeholder: the Spirit model is provisional. Its scan content and NASA sources are real.',
}
