import { describe, expect, it } from 'vitest'
import { getMission } from './missions'
import { SPIRIT_SCAN_ANCHORS, SPIRIT_SITE, findScanAnchor } from './spiritSite'

describe('Spirit scan anchors', () => {
  it('define exactly one anchor per mission component', () => {
    const componentIds = getMission('spirit').components.map((c) => c.id)
    expect(SPIRIT_SCAN_ANCHORS.map((a) => a.componentId).sort()).toEqual(
      [...componentIds].sort(),
    )
  })

  it('keep every anchor inside the interaction radius, with valid hit boxes', () => {
    for (const anchor of SPIRIT_SCAN_ANCHORS) {
      expect(findScanAnchor(anchor.componentId)).toBe(anchor)
      expect(Math.hypot(anchor.position[0], anchor.position[2])).toBeLessThan(
        SPIRIT_SITE.interactionRadius,
      )
      expect(anchor.hitSize.every((size) => size > 0)).toBe(true)
    }
    expect(findScanAnchor('nope')).toBeUndefined()
  })
})
