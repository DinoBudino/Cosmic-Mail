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

/** The two machines left on the Moon that the game visits. */
export type MoonExplorerId = Extract<MissionId, 'surveyor-3' | 'apollo-11'>
export const MOON_EXPLORER_IDS: readonly MoonExplorerId[] = ['surveyor-3', 'apollo-11']

/** Every explorer the child can land beside, on either world. */
export type ExplorerId = MarsExplorerId | MoonExplorerId
export type WorldId = 'mars' | 'moon'

export function explorerWorld(id: ExplorerId): WorldId {
  return id === 'surveyor-3' || id === 'apollo-11' ? 'moon' : 'mars'
}

let activeExplorer: ExplorerId = 'opportunity'

/** Chosen from orbit before landing; the whole visit follows it. */
export function setActiveExplorer(id: ExplorerId): void {
  activeExplorer = id
}

export function getActiveExplorer(): ExplorerId {
  return activeExplorer
}

/** The world the child is standing on (follows the landing chosen in orbit). */
export function getActiveWorld(): WorldId {
  return explorerWorld(activeExplorer)
}

/** Per-machine footprint: the Eagle descent stage is far wider than a rover. */
interface ExplorerFootprint {
  label: string
  interactionRadius: number
  collisionRadius: number
  ringRadius: number
  cameraClearance: number
  pipMessage: string
  placeholderNote: string
}

const FOOTPRINTS: Readonly<Record<ExplorerId, ExplorerFootprint>> = {
  opportunity: {
    label: 'Opportunity',
    interactionRadius: 6.5,
    collisionRadius: 2.2,
    ringRadius: 5.2,
    cameraClearance: 3.6,
    pipMessage: 'There! Something is resting in the dust.',
    placeholderNote:
      'Stylized model of the Mars Exploration Rover design shared by Spirit and Opportunity. Its scan content and NASA sources are real.',
  },
  spirit: {
    label: 'Spirit',
    interactionRadius: 6.5,
    collisionRadius: 2.2,
    ringRadius: 5.2,
    cameraClearance: 3.6,
    pipMessage: 'There! Something is resting in the dust.',
    placeholderNote:
      'Stylized model of the Mars Exploration Rover design shared by Spirit and Opportunity. Its scan content and NASA sources are real.',
  },
  'surveyor-3': {
    label: 'Surveyor 3',
    interactionRadius: 6.5,
    collisionRadius: 2.7,
    ringRadius: 5.4,
    cameraClearance: 3.8,
    pipMessage: 'There! Something is resting on the crater slope.',
    placeholderNote:
      'Model of Surveyor 3 built from NASA records and Apollo 12 photographs. Its scan content and NASA sources are real.',
  },
  'apollo-11': {
    label: 'Eagle',
    interactionRadius: 9,
    collisionRadius: 4.7,
    ringRadius: 7.6,
    cameraClearance: 5.6,
    pipMessage: 'There! Something big is standing in the gray dust.',
    placeholderNote:
      'Model of the Apollo 11 Lunar Module descent stage, the part that stayed on the Moon, built from NASA references. Its scan content and NASA sources are real.',
  },
}

/**
 * The explorer's site. The `SPIRIT_*` names are historical (the pilot
 * mission was Spirit). One site serves every landing: the mission id,
 * label and footprint follow the explorer chosen from orbit.
 */
export const SPIRIT_SITE: MissionSite = {
  get missionId() {
    return activeExplorer
  },
  get destination() {
    return explorerWorld(activeExplorer)
  },
  get label() {
    return FOOTPRINTS[activeExplorer].label
  },
  position: { x: 0, z: -45 },
  get interactionRadius() {
    return FOOTPRINTS[activeExplorer].interactionRadius
  },
  get collisionRadius() {
    return FOOTPRINTS[activeExplorer].collisionRadius
  },
  get ringRadius() {
    return FOOTPRINTS[activeExplorer].ringRadius
  },
  get cameraClearance() {
    return FOOTPRINTS[activeExplorer].cameraClearance
  },
  get pipMessage() {
    return FOOTPRINTS[activeExplorer].pipMessage
  },
  get placeholderNote() {
    return FOOTPRINTS[activeExplorer].placeholderNote
  },
}

/**
 * Scan station view: where the camera waits while the child hunts the
 * parts. The rover gets a 3/4 front view (its front faces +Z in the world)
 * so the mast, its cameras and the arm are all in sight at once. The Moon
 * landers get a view that shows their three parts at once.
 */
export interface ScanStationView {
  /** World direction from the explorer to the camera (normalized on use). */
  direction: { x: number; z: number }
  distance: number
  eyeHeight: number
  lookHeight: number
}

const STATION_VIEWS: Readonly<Record<WorldId | ExplorerId, ScanStationView>> = {
  mars: { direction: { x: 0.95, z: 0.7 }, distance: 4.4, eyeHeight: 1.55, lookHeight: 1.05 },
  moon: { direction: { x: 0.2, z: 1 }, distance: 5, eyeHeight: 1.5, lookHeight: 0.95 },
  opportunity: { direction: { x: 0.95, z: 0.7 }, distance: 4.4, eyeHeight: 1.55, lookHeight: 1.05 },
  spirit: { direction: { x: 0.95, z: 0.7 }, distance: 4.4, eyeHeight: 1.55, lookHeight: 1.05 },
  // Camera, scoop and the radar under the frame, seen from the south.
  'surveyor-3': { direction: { x: 0.15, z: 1 }, distance: 4.9, eyeHeight: 1.35, lookHeight: 0.85 },
  // South-west: the probe on the south pad, the engine between the legs
  // and the plaque on the west (ladder) leg.
  'apollo-11': { direction: { x: -0.8, z: 1 }, distance: 8.2, eyeHeight: 1.8, lookHeight: 1.3 },
}

/** Station view of the active explorer. */
export function getScanStationView(): ScanStationView {
  return STATION_VIEWS[activeExplorer]
}

/** Kept for older imports: the Mars rover's view. */
export const SCAN_STATION_VIEW: ScanStationView = STATION_VIEWS.opportunity

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

type PartAnchor = Omit<ScanAnchor, 'componentId'> & { part: string }

// Rover-local, model public/models/mer-rover.glb (front is -X). Hit boxes
// are a little larger than the parts so small hands can aim easily.
// Order = the parts hunt (same as the mission's components): eyes, rock
// tool, heat reader.
const ROVER_PARTS: readonly PartAnchor[] = [
  { part: 'pancam', position: [-0.21, 1.93, 0], hitSize: [0.42, 0.42, 0.64], hitOffset: [0, 0, 0] },
  { part: 'rock-abrasion-tool', position: [-1.04, 0.5, -0.16], hitSize: [0.4, 0.34, 0.36], hitOffset: [-0.04, 0, 0] },
  { part: 'mini-tes', position: [-0.19, 1.38, 0], hitSize: [0.36, 0.64, 0.36], hitOffset: [0, 0, 0] },
]

// Lander-local, model public/models/surveyor-3.glb (measured from the GLB):
// TV camera, surface sampler (scoop at the end of the arm), descent radar
// antennas under the frame.
const SURVEYOR_PARTS: readonly PartAnchor[] = [
  { part: 'tv-camera', position: [0.5, 1.22, -0.4], hitSize: [0.56, 1.1, 0.56], hitOffset: [0, 0, 0] },
  { part: 'surface-sampler', position: [0.85, 0.45, 0.75], hitSize: [0.8, 0.72, 1.9], hitOffset: [0, 0, 0] },
  { part: 'descent-radar', position: [-0.05, 0.59, 0.36], hitSize: [1.1, 0.46, 1.0], hitOffset: [0, 0, 0] },
]

// Stage-local, model public/models/apollo11-eagle.glb (front/ladder = +Z):
// the probe lying flat beside the +X footpad, the descent engine under the
// stage and the plaque on the ladder strut.
const EAGLE_PARTS: readonly PartAnchor[] = [
  { part: 'surface-probe', position: [5.05, 0.12, -0.44], hitSize: [1.6, 0.5, 1.2], hitOffset: [0, 0, 0] },
  { part: 'descent-engine', position: [0, 0.8, 0], hitSize: [1.6, 0.9, 1.6], hitOffset: [0, 0, 0] },
  { part: 'plaque', position: [0, 2.25, 2.73], hitSize: [0.5, 0.5, 0.45], hitOffset: [0, 0, 0] },
]

const PART_ANCHORS: Readonly<Record<ExplorerId, readonly PartAnchor[]>> = {
  opportunity: ROVER_PARTS,
  spirit: ROVER_PARTS,
  'surveyor-3': SURVEYOR_PARTS,
  'apollo-11': EAGLE_PARTS,
}

/**
 * Distractor anchors: real rover parts that respond to the scanner with a
 * short PIP note but never count toward progress. With the real model the
 * meshes themselves carry the ids; these boxes document where they are.
 */
const DISTRACTOR_PARTS: readonly PartAnchor[] = [
  { part: 'solar-panels', position: [0, 0.97, 0], hitSize: [2.16, 0.12, 2.64], hitOffset: [0, 0, 0] },
  { part: 'wheels', position: [0, 0.27, 0], hitSize: [2.11, 0.55, 1.84], hitOffset: [0, 0, 0] },
  { part: 'antenna', position: [0.34, 1.42, -0.06], hitSize: [0.3, 0.8, 0.62], hitOffset: [0, 0, 0] },
]

const anchorCache = new Map<string, readonly ScanAnchor[]>()

/** Scan anchors of the active explorer, in hunt order. */
export function getScanAnchors(): readonly ScanAnchor[] {
  const cached = anchorCache.get(activeExplorer)
  if (cached) return cached
  const list = PART_ANCHORS[activeExplorer].map(({ part, ...anchor }) => ({
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
