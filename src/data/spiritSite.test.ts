import { afterEach, describe, expect, it } from 'vitest'
import { getMission } from './missions'
import {
  MARS_EXPLORER_IDS,
  SPIRIT_SITE,
  findScanAnchor,
  getScanAnchors,
  setActiveExplorer,
} from './spiritSite'

describe('Mars explorer scan anchors', () => {
  afterEach(() => setActiveExplorer('opportunity'))

  for (const explorer of MARS_EXPLORER_IDS) {
    it(`define exactly one anchor per ${explorer} component`, () => {
      setActiveExplorer(explorer)
      expect(SPIRIT_SITE.missionId).toBe(explorer)
      const componentIds = getMission(explorer).components.map((c) => c.id)
      expect(getScanAnchors().map((a) => a.componentId).sort()).toEqual(
        [...componentIds].sort(),
      )
    })

    it(`keeps every ${explorer} anchor inside the interaction radius`, () => {
      setActiveExplorer(explorer)
      for (const anchor of getScanAnchors()) {
        expect(findScanAnchor(anchor.componentId)).toBe(anchor)
        expect(
          Math.hypot(anchor.position[0], anchor.position[2]),
        ).toBeLessThan(SPIRIT_SITE.interactionRadius)
        expect(anchor.hitSize.every((size) => size > 0)).toBe(true)
      }
      expect(findScanAnchor('nope')).toBeUndefined()
    })
  }
})
