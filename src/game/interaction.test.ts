import { describe, expect, it } from 'vitest'
import { MARS_OBJECTS, MARS_WORLD_SITES } from '../data/marsObjects'
import {
  findNearbyRegion,
  findNearbySite,
  getAutoMove,
  resolveSiteCollision,
  SITE_COLLISION_RADII,
  SITE_RADII,
} from './interaction'
import { PLAYER, WORLD } from './worldConfig'

/**
 * Fidelity pass (Nov 2026): the Mars level is Opportunity's Meridiani
 * Planum. Viking 1, InSight and Ingenuity landed elsewhere on Mars, so their
 * hardware is no longer placed in the world, and nothing at their old
 * positions can be inspected, collided with or travelled to.
 */
describe('Mars world sites', () => {
  it('places no other-mission hardware in the playable world', () => {
    expect(MARS_WORLD_SITES).toHaveLength(0)
    // The catalogue stays as data so saved memorial notes keep validating.
    expect(MARS_OBJECTS.length).toBeGreaterThan(0)
  })

  it('finds no site or region where the old landmarks stood', () => {
    for (const site of MARS_OBJECTS) {
      expect(findNearbySite(site.position)).toBeNull()
      expect(findNearbyRegion(site.position)).toBeNull()
    }
    expect(findNearbySite({ ...WORLD.spawn })).toBeNull()
  })

  it('never pushes the player away from an empty landmark spot', () => {
    for (const site of MARS_OBJECTS) {
      const position = { ...site.position }
      resolveSiteCollision(position)
      expect(position).toEqual(site.position)
    }
  })

  it('ends assisted travel at once instead of walking to a missing site', () => {
    for (const site of MARS_OBJECTS) {
      expect(getAutoMove({ ...WORLD.spawn }, site.id)).toEqual({
        x: 0,
        z: 0,
        arrived: true,
      })
    }
  })

  it('keeps the legacy ring sizes consistent if a site ever returns', () => {
    for (const site of MARS_OBJECTS) {
      expect(SITE_COLLISION_RADII[site.id] + PLAYER.radius).toBeLessThan(
        SITE_RADII[site.id],
      )
    }
  })
})
