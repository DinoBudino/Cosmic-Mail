import { afterEach, describe, expect, it } from 'vitest'
import { getMission } from '../data/missions'
import { getOrbitGuidance, landingSitesFor } from '../data/marsLandingSites'
import { pipLine } from '../data/pipVoiceCatalog'
import {
  getActiveWorld,
  getScanAnchors,
  MAILWING_LANDING,
  MOON_EXPLORER_IDS,
  setActiveExplorer,
  SPIRIT_SITE,
} from '../data/spiritSite'
import { getCraters, getExplorerGroundTilt, getLunarHeight } from './lunarGround'
import { getTerrainHeight } from './terrainHeight'
import { WORLD } from './worldConfig'

afterEach(() => setActiveExplorer('opportunity'))

describe('Moon landings', () => {
  it('offers the two Moon explorers from orbit at their NASA coordinates', () => {
    const sites = landingSitesFor('moon')
    expect(sites.map((site) => site.explorer)).toEqual(['apollo-11', 'surveyor-3'])
    const eagle = sites.find((site) => site.explorer === 'apollo-11')!
    const surveyor = sites.find((site) => site.explorer === 'surveyor-3')!
    expect(eagle.latitude).toBeCloseTo(0.674, 2)
    expect(eagle.longitude).toBeCloseTo(23.473, 2)
    // NASA: 3.0 S, 23.41 W
    expect(surveyor.latitude).toBeCloseTo(-3.0, 1)
    expect(360 - surveyor.longitude).toBeCloseTo(23.41, 1)
    expect(getOrbitGuidance(null, 'moon').line).toBe(pipLine('orbit-moon-intro'))
  })

  it('switches the world, the site footprint and the scan anchors with the landing', () => {
    for (const id of MOON_EXPLORER_IDS) {
      setActiveExplorer(id)
      expect(getActiveWorld()).toBe('moon')
      expect(SPIRIT_SITE.destination).toBe('moon')
      const parts = getMission(id).components.map((component) => component.id)
      expect(getScanAnchors().map((anchor) => anchor.componentId)).toEqual(parts)
      expect(SPIRIT_SITE.collisionRadius).toBeLessThan(SPIRIT_SITE.interactionRadius)
    }
    setActiveExplorer('spirit')
    expect(getActiveWorld()).toBe('mars')
  })

  it('stands Eagle on level ground and Surveyor 3 on the tilted crater wall', () => {
    const eagle = getExplorerGroundTilt('apollo-11')
    expect(Math.hypot(eagle.gx, eagle.gz)).toBe(0)
    const surveyor = getExplorerGroundTilt('surveyor-3')
    const slopeDeg = (Math.atan(Math.hypot(surveyor.gx, surveyor.gz)) * 180) / Math.PI
    expect(slopeDeg).toBeGreaterThan(3)
    expect(slopeDeg).toBeLessThan(15)
  })

  it('keeps the landing zone and the ship on gentle ground, away from craters', () => {
    for (const id of MOON_EXPLORER_IDS) {
      for (const crater of getCraters(id).slice(2)) {
        expect(Math.hypot(crater.x - WORLD.spawn.x, crater.z - WORLD.spawn.z)).toBeGreaterThan(crater.radius)
        expect(
          Math.hypot(crater.x - MAILWING_LANDING.position.x, crater.z - MAILWING_LANDING.position.z),
        ).toBeGreaterThan(crater.radius)
      }
      const a = getLunarHeight(id, WORLD.spawn.x, WORLD.spawn.z)
      const b = getLunarHeight(id, WORLD.spawn.x + 2, WORLD.spawn.z)
      expect(Math.abs(a - b)).toBeLessThan(0.3)
    }
  })

  it('routes getTerrainHeight to the lunar ground while on the Moon', () => {
    setActiveExplorer('surveyor-3')
    const { x, z } = SPIRIT_SITE.position
    expect(getTerrainHeight(x, z)).toBeCloseTo(getLunarHeight('surveyor-3', x, z), 6)
    // Surveyor 3 sits well below the plain, inside its crater.
    expect(getTerrainHeight(x, z)).toBeLessThan(getTerrainHeight(WORLD.spawn.x, WORLD.spawn.z) - 4)
  })
})
