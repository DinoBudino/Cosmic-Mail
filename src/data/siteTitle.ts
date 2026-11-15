import { landingSitesFor } from './marsLandingSites'
import type { ExplorerId, WorldId } from './spiritSite'

export interface SiteTitle {
  /** Small line above the name. */
  eyebrow: string
  /** The place, shown big. */
  place: string
  /** Real landing coordinates, e.g. "14.57° S · 175.47° E". */
  coordinates: string
}

/** Latitude/east longitude as a reader-friendly N/S · E/W pair. */
export function formatCoordinates(latitude: number, eastLongitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? 'S' : 'N'}`
  const east = ((eastLongitude % 360) + 360) % 360
  const lon = east > 180 ? `${(360 - east).toFixed(2)}° W` : `${east.toFixed(2)}° E`
  return `${lat} · ${lon}`
}

/**
 * The landing-site title card that opens every landing: where on Mars or
 * the Moon the child just touched down. Uses the same place names and NASA
 * coordinates as the orbit screen (it never names the explorer: that is
 * still a mystery when the child arrives).
 */
export function getSiteTitle(world: WorldId, explorer: ExplorerId): SiteTitle | null {
  const site = landingSitesFor(world).find((entry) => entry.explorer === explorer)
  if (!site) return null
  return {
    eyebrow: world === 'moon' ? 'Landing site · The Moon' : 'Landing site · Mars',
    place: site.place,
    coordinates: formatCoordinates(site.latitude, site.longitude),
  }
}
