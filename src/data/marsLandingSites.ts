import type { JourneySave } from '../store/journeySchema'
import type { MarsExplorerId } from './spiritSite'
import { pipLine } from './pipVoiceCatalog'

/**
 * The two Mars explorers seen from orbit. Coordinates are the NASA landing
 * sites (planetocentric latitude, east longitude); the orbit globe is a
 * painted, stylized Mars, so they only place the markers around the sphere.
 */
export interface MarsLandingSite {
  explorer: MarsExplorerId
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
]

/** unknown → found (identified) → letter (sealed, not sent) → done (sent). */
export type LandingSiteState = 'unknown' | 'found' | 'letter' | 'done'

export function getLandingSiteState(
  save: JourneySave | null,
  explorer: MarsExplorerId,
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
  explorer: MarsExplorerId,
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
  pendingDelivery: MarsExplorerId | null
  /** Both stories are safe: time to fly home. */
  allDone: boolean
  /** The spot PIP suggests next (glows brighter), if any. */
  suggested: MarsExplorerId | null
}

export function getOrbitGuidance(save: JourneySave | null): OrbitGuidance {
  const states = MARS_LANDING_SITES.map((site) => ({
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
    line: someDone ? pipLine('orbit-next') : pipLine('orbit-intro'),
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
