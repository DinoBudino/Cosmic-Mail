import type { JourneySave } from '../store/journeySchema'
import type { ExplorerId, WorldId } from './spiritSite'
import { pipLine } from './pipVoiceCatalog'

/**
 * The explorers seen from orbit, two per world. Coordinates are the NASA
 * landing sites (latitude, east longitude); on the orbit globe they place
 * the markers around the sphere.
 */
export interface MarsLandingSite {
  explorer: ExplorerId
  /** Place name: the only thing shown before the explorer is identified. */
  place: string
  latitude: number
  longitude: number
  /** PIP's line when the child picks this spot. */
  line: string
}

export const MARS_LANDING_SITES: readonly MarsLandingSite[] = [
  {
    explorer: 'opportunity',
    place: 'Meridiani Planum',
    latitude: -1.95,
    longitude: 354.47,
    line: pipLine('orbit-meridiani'),
  },
  {
    explorer: 'spirit',
    place: 'Gusev Crater',
    latitude: -14.57,
    longitude: 175.47,
    line: pipLine('orbit-gusev'),
  },
  {
    // NASA: 22.483 N, 47.94 W
    explorer: 'viking-1',
    place: 'Chryse Planitia',
    latitude: 22.483,
    longitude: 312.06,
    line: pipLine('orbit-chryse'),
  },
]

/**
 * The two Moon explorers. Apollo 11 (Tranquility Base) and Surveyor 3, in
 * the south-east of Oceanus Procellarum (NASA: 3.0 S, 23.41 W).
 */
export const MOON_LANDING_SITES: readonly MarsLandingSite[] = [
  {
    explorer: 'apollo-11',
    place: 'Sea of Tranquility',
    latitude: 0.674,
    longitude: 23.473,
    line: pipLine('orbit-tranquility'),
  },
  {
    explorer: 'surveyor-3',
    place: 'Ocean of Storms',
    latitude: -3.0,
    longitude: 336.59,
    line: pipLine('orbit-procellarum'),
  },
]

export type LandingSite = MarsLandingSite

/** Landing spots seen from orbit around a world. */
export function landingSitesFor(world: WorldId): readonly LandingSite[] {
  return world === 'moon' ? MOON_LANDING_SITES : MARS_LANDING_SITES
}

/** unknown → found (identified) → letter (sealed, not sent) → done (sent). */
export type LandingSiteState = 'unknown' | 'found' | 'letter' | 'done'

export function getLandingSiteState(
  save: JourneySave | null,
  explorer: ExplorerId,
): LandingSiteState {
  const progress = save?.missions[explorer]
  if (!progress) return 'unknown'
  if (progress.transmittedAt != null) return 'done'
  if (progress.smartLetterCreatedAt != null) return 'letter'
  if (progress.discovered) return 'found'
  return 'unknown'
}

/**
 * How much of a landing area is finished, 0-100: finding the explorer, its
 * three parts, sealing the letter and sending the story (6 steps).
 */
export function getLandingSiteProgress(
  save: JourneySave | null,
  explorer: ExplorerId,
): number {
  const progress = save?.missions[explorer]
  if (!progress) return 0
  if (progress.transmittedAt != null) return 100
  const steps =
    (progress.discovered ? 1 : 0) +
    Math.min(3, progress.scannedComponentIds.length) +
    (progress.smartLetterCreatedAt != null ? 1 : 0)
  return Math.round((steps / 6) * 100)
}

export interface OrbitGuidance {
  /** PIP's line on arrival in orbit. */
  line: string
  /** A sealed letter is aboard: send it before landing again. */
  pendingDelivery: ExplorerId | null
  /** Both stories are safe: time to fly home. */
  allDone: boolean
  /** The spot PIP suggests next (glows brighter), if any. */
  suggested: ExplorerId | null
}

export function getOrbitGuidance(
  save: JourneySave | null,
  world: WorldId = 'mars',
): OrbitGuidance {
  const states = landingSitesFor(world).map((site) => ({
    explorer: site.explorer,
    state: getLandingSiteState(save, site.explorer),
  }))
  const pending = states.find((entry) => entry.state === 'letter')
  if (pending) {
    return {
      line: pipLine('orbit-deliver'),
      pendingDelivery: pending.explorer,
      allDone: false,
      suggested: null,
    }
  }
  const remaining = states.filter((entry) => entry.state !== 'done')
  if (remaining.length === 0) {
    return {
      line: pipLine('orbit-all-done'),
      pendingDelivery: null,
      allDone: true,
      suggested: null,
    }
  }
  const someDone = remaining.length < states.length
  return {
    line: someDone
      ? pipLine('orbit-next')
      : pipLine(world === 'moon' ? 'orbit-moon-intro' : 'orbit-intro'),
    pendingDelivery: null,
    allDone: false,
    // A story already started comes first; otherwise the first spot.
    suggested:
      remaining.find((entry) => entry.state === 'found')?.explorer ??
      remaining[0]!.explorer,
  }
}

/** Unit vector on the globe for a site (y up, +z faces the camera at 0). */
export function siteDirection(site: MarsLandingSite): [number, number, number] {
  const lat = (site.latitude * Math.PI) / 180
  const lon = (site.longitude * Math.PI) / 180
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  ]
}

/** Globe rotation (around y) that turns a site to face the camera. */
export function rotationToFace(site: MarsLandingSite): number {
  const lon = (site.longitude * Math.PI) / 180
  return -Math.PI / 2 - lon
}
