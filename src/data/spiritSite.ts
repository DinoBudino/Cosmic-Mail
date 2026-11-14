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

/**
 * Scannable component anchors, defined by data. Each anchor binds a mission
 * component id to a position (local to the rover origin) and an invisible
 * hit box. Any rover model, the provisional placeholder or the final one,
 * only has to expose groups built from these anchors; scanner logic keys
 * on `componentId`, never on placeholder geometry.
 */
export interface ScanAnchor {
  componentId: string
  /** Position relative to the rover origin (ground contact point). */
  position: readonly [number, number, number]
  /** Invisible hit box size and offset used by the scanner raycast. */
  hitSize: readonly [number, number, number]
  hitOffset: readonly [number, number, number]
}

export const SPIRIT_SCAN_ANCHORS: readonly ScanAnchor[] = [
  {
    componentId: 'spirit-pancam',
    position: [0.5, 2.16, -0.35],
    hitSize: [0.78, 0.5, 0.5],
    hitOffset: [0, 0, 0.04],
  },
  {
    componentId: 'spirit-mini-tes',
    position: [0.18, 1.9, -0.58],
    hitSize: [0.5, 0.5, 0.5],
    hitOffset: [0, 0, 0.04],
  },
  {
    componentId: 'spirit-rock-abrasion-tool',
    position: [0.72, 0.92, 0.58],
    hitSize: [0.5, 0.5, 0.9],
    hitOffset: [0, 0, 0.32],
  },
]

/**
 * Distractor anchors: real rover parts that respond to the scanner with a
 * short PIP note but never count toward progress. Hit boxes avoid the
 * component anchors above so the ray cannot be ambiguous.
 */
export const SPIRIT_DISTRACTOR_ANCHORS: readonly (Omit<
  ScanAnchor,
  'componentId'
> & { distractorId: string })[] = [
  {
    distractorId: 'spirit-solar-panels',
    position: [0, 1.12, 0],
    hitSize: [1.9, 0.18, 0.8],
    hitOffset: [0, 0, 0],
  },
  {
    distractorId: 'spirit-wheels',
    position: [-0.92, 0.34, 0],
    hitSize: [0.34, 0.7, 1.5],
    hitOffset: [0, 0, 0],
  },
  {
    distractorId: 'spirit-antenna',
    position: [-0.72, 1.4, -0.36],
    hitSize: [0.5, 0.7, 0.5],
    hitOffset: [0, 0, 0],
  },
]

export function findScanAnchor(componentId: string): ScanAnchor | undefined {
  return SPIRIT_SCAN_ANCHORS.find(
    (anchor) => anchor.componentId === componentId,
  )
}

/**
 * Memory-trace anchors for the full recognition scan (climax). One trace per
 * memory fragment, spread on the four sides of the body (rover-local
 * coordinates) so the player circles the explorer to sweep it. They are a
 * fictional overlay, not hardware: the rover stays still and untouched.
 */
export const SPIRIT_TRACE_ANCHORS: readonly {
  kind: 'identity' | 'trajectory' | 'discoveries' | 'missionEnd'
  position: readonly [number, number, number]
  /** Radius of the (invisible) aiming sphere. */
  hitRadius: number
}[] = [
  { kind: 'identity', position: [0, 0.8, 0.74], hitRadius: 0.32 },
  { kind: 'trajectory', position: [-1.18, 0.82, 0], hitRadius: 0.32 },
  { kind: 'discoveries', position: [0, 0.8, -0.74], hitRadius: 0.32 },
  { kind: 'missionEnd', position: [1.18, 0.82, 0], hitRadius: 0.32 },
]
