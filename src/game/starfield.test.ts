import { describe, expect, it } from 'vitest'
import { buildStarGeometry, STAR_RADIUS } from './starfield'

describe('starfield geometry', () => {
  it('generates identical attributes for the same count', () => {
    const first = buildStarGeometry(100)
    const second = buildStarGeometry(100)
    for (const name of Object.keys(first.attributes)) {
      expect(first.getAttribute(name).array).toEqual(second.getAttribute(name).array)
    }
    first.dispose()
    second.dispose()
  })

  it('produces finite attributes at the sky radius for both quality levels', () => {
    for (const count of [650, 1800]) {
      const geometry = buildStarGeometry(count)
      for (const attribute of Object.values(geometry.attributes)) {
        expect(attribute.count).toBe(count)
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
      }
      const positions = geometry.getAttribute('position')
      const alpha = geometry.getAttribute('aAlpha')
      for (let index = 0; index < count; index += 1) {
        expect(Math.hypot(positions.getX(index), positions.getY(index), positions.getZ(index))).toBeCloseTo(STAR_RADIUS, 3)
        expect(alpha.getX(index)).toBeGreaterThanOrEqual(0)
        expect(alpha.getX(index)).toBeLessThanOrEqual(1)
      }
      geometry.dispose()
    }
  })
})
