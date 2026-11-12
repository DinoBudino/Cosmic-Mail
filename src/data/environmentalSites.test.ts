import { describe, expect, it } from 'vitest'
import { getMission } from './missions'
import {
  ENVIRONMENTAL_CATEGORY_IDS,
  ENVIRONMENTAL_SITE_IDS,
  ENVIRONMENTAL_SITES,
  getEnvironmentalSite,
  isEnvironmentalSiteId,
} from './environmentalSites'
import { SPIRIT_SITE } from './spiritSite'
import { WORLD } from '../game/worldConfig'

describe('environmental observation sites', () => {
  it('has unique stable ids and all four categories', () => {
    expect(new Set(ENVIRONMENTAL_SITE_IDS).size).toBe(
      ENVIRONMENTAL_SITES.length,
    )
    const categories = new Set(
      ENVIRONMENTAL_SITES.map((site) => site.category),
    )
    for (const category of ENVIRONMENTAL_CATEGORY_IDS) {
      expect(categories.has(category)).toBe(true)
    }
  })

  it('places every target inside the playable radius and clear of Spirit', () => {
    for (const site of ENVIRONMENTAL_SITES) {
      expect(Math.hypot(site.position.x, site.position.z)).toBeLessThan(
        WORLD.playRadius,
      )
      expect(
        Math.hypot(
          site.position.x - SPIRIT_SITE.position.x,
          site.position.z - SPIRIT_SITE.position.z,
        ),
      ).toBeGreaterThan(SPIRIT_SITE.ringRadius + 2)
      expect(site.scanRange).toBeGreaterThan(4)
      expect(site.quickLine.length).toBeGreaterThan(20)
      expect(site.detailedLine.length).toBeGreaterThan(40)
    }
  })

  it('looks up only known ids and keeps optional content out of missions', () => {
    expect(isEnvironmentalSiteId(ENVIRONMENTAL_SITES[0]!.id)).toBe(true)
    expect(isEnvironmentalSiteId('spirit-pancam')).toBe(false)
    expect(getEnvironmentalSite(ENVIRONMENTAL_SITES[0]!.id)).not.toBeNull()
    expect(getEnvironmentalSite('unknown')).toBeNull()

    const spirit = getMission('spirit')
    for (const component of spirit.components) {
      expect(isEnvironmentalSiteId(component.id)).toBe(false)
    }
    expect(ENVIRONMENTAL_SITE_IDS).not.toContain('spirit')
  })
})
