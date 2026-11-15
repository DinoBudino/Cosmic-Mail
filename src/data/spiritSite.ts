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

/** The two Mars Exploration Rovers the game visits (one landing each). */
export type MarsExplorerId = Extract<MissionId, 'opportunity' | 'spirit'>
export const MARS_EXPLORER_IDS: readonly MarsExplorerId[] = ['opportunity', 'spirit']

let activeExplorer: MarsExplorerId = 'opportunity'

/** Chosen from orbit before landing; the whole Mars visit follows it. */
export function setActiveExplorer(id: MarsExplorerId): void {
  activeExplorer = id
}

export function getActiveExplorer(): MarsExplorerId {
  return activeExplorer
}

/**
 * The Mars explorer's site. The `SPIRIT_*` names are historical (the pilot
 * mission was Spirit). Spirit and Opportunity are twins with the same
 * design, so one site, one model and one set of anchors serve both: the
 * mission id follows the landing chosen from orbit.
 */
export const SPIRIT_SITE: MissionSite = {
  get missionId() {
    return activeExplorer
  },
  destination: 'mars',
  get label() {
    return activeExplorer === 'spirit' ? 'Spirit' : 'Opportunity'
  },
  position: { x: 0, z: -45 },
  interactionRadius: 6.5,
  collisionRadius: 2.2,
  ringRadius: 5.2,
  cameraClearance: 3.6,
  pipMessage: 'There! Something is resting in the dust.',
  placeholderNote:
    'Stylized model of the Mars Exploration Rover design shared by Spirit and Opportunity. Its scan content and NASA sources are real.',
}

/**
 * Scan station view: where the camera waits while the child hunts the
 * parts. A 3/4 front view (the rover's front faces +Z in the world) so the
 * mast, its cameras and the arm at the front are all in sight at once.
 */
export const SCAN_STATION_VIEW = {
  /** World direction from the rover to the camera (normalized on use). */
  direction: { x: 0.95, z: 0.7 },
  distance: 4.4,
  eyeHeight: 1.55,
  lookHeight: 1.05,
} as const

/**
 * Scannable component anchors, defined by data. Each anchor binds a mission
 * component id to a position (local to the rover origin) and an invisible
 * hit box. Any rover model, the provisional placeholder or the final one,
 * only has to expose groups built from these anchors; scanner logic keys
 * on `componentId`, never on placeholder geometry.
 */
export interface ScanAnchor {
  /** `${missionId}-${part}`: the same part on either twin. */
  componentId: string
  /** Position relative to the rover origin (ground contact point). */
  position: readonly [number, number, number]
  /** Invisible hit box size and offset used by the scanner raycast. */
  hitSize: readonly [number, number, number]
  hitOffset: readonly [number, number, number]
}

const PART_ANCHORS: readonly (Omit<ScanAnchor, 'componentId'> & { part: string })[] = [
  // Rover-local, model public/models/mer-rover.glb (front is -X). Hit boxes
  // are a little larger than the parts so small hands can aim easily.
  // Order = the parts hunt (same as the mission's components): eyes, rock
  // tool, heat reader.
  {
    part: 'pancam',
    position: [-0.21, 1.93, 0],
    hitSize: [0.42, 0.42, 0.64],
    hitOffset: [0, 0, 0],
  },
  {
    part: 'rock-abrasion-tool',
    position: [-1.04, 0.5, -0.16],
    hitSize: [0.4, 0.34, 0.36],
    hitOffset: [-0.04, 0, 0],
  },
  {
    part: 'mini-tes',
    position: [-0.19, 1.38, 0],
    hitSize: [0.36, 0.64, 0.36],
    hitOffset: [0, 0, 0],
  },
]

/**
 * Distractor anchors: real rover parts that respond to the scanner with a
 * short PIP note but never count toward progress. With the real model the
 * meshes themselves carry the ids; these boxes document where they are.
 */
const DISTRACTOR_PARTS: readonly (Omit<ScanAnchor, 'componentId'> & {
  part: string
})[] = [
  {
    part: 'solar-panels',
    position: [0, 0.97, 0],
    hitSize: [2.16, 0.12, 2.64],
    hitOffset: [0, 0, 0],
  },
  {
    part: 'wheels',
    position: [0, 0.27, 0],
    hitSize: [2.11, 0.55, 1.84],
    hitOffset: [0, 0, 0],
  },
  {
    part: 'antenna',
    position: [0.34, 1.42, -0.06],
    hitSize: [0.3, 0.8, 0.62],
    hitOffset: [0, 0, 0],
  },
]

const anchorCache = new Map<string, readonly ScanAnchor[]>()

/** Scan anchors of the active explorer, in hunt order. */
export function getScanAnchors(): readonly ScanAnchor[] {
  const cached = anchorCache.get(activeExplorer)
  if (cached) return cached
  const list = PART_ANCHORS.map(({ part, ...anchor }) => ({
    ...anchor,
    componentId: `${activeExplorer}-${part}`,
  }))
  anchorCache.set(activeExplorer, list)
  return list
}

/** Distractor part id for the active explorer. */
export function distractorId(part: string): string {
  return `${activeExplorer}-${part}`
}

export const DISTRACTOR_PART_ANCHORS = DISTRACTOR_PARTS

export function findScanAnchor(componentId: string): ScanAnchor | undefined {
  return getScanAnchors().find(
    (anchor) => anchor.componentId === componentId,
  )
}

/**
 * Mailwing, landed beside the landing zone. After the letter is sealed the
 * child walks back here and boards to return to Mars orbit.
 */
export const MAILWING_LANDING = {
  position: { x: -8.5, z: 80.5 },
  /** Ship model scale (the model is ~12 m tall at 1). */
  scale: 1,
  collisionRadius: 3.7,
  boardRadius: 7.2,
} as const
