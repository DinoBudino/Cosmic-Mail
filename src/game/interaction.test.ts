import { describe, expect, it } from 'vitest'
import { MARS_OBJECTS } from '../data/marsObjects'
import { findNearbySite, getAutoMove, SITE_RADII } from './interaction'

describe('findNearbySite', () => {
  it('finds every site, including coming-soon Viking 1', () => {
    for (const site of MARS_OBJECTS) expect(findNearbySite(site.position)).toBe(site.id)
  })

  it('returns no site at spawn or far outside the world', () => {
    expect(findNearbySite({ x: 0, z: 20 })).toBeNull()
    expect(findNearbySite({ x: 500, z: 500 })).toBeNull()
  })

  it('includes the boundary but not points beyond it', () => {
    for (const site of MARS_OBJECTS) {
      const radius = SITE_RADII[site.id]
      expect(findNearbySite({ x: site.position.x, z: site.position.z + radius - 0.001 })).toBe(site.id)
      expect(findNearbySite({ x: site.position.x, z: site.position.z + radius + 0.001 })).toBeNull()
    }
  })

  it('does not activate from the old proximity-only range', () => {
    expect(findNearbySite({ x: -22, z: 5 })).toBeNull()
  })

  it('stops automatic travel inside every ring', () => {
    for (const site of MARS_OBJECTS) {
      const position = { x: site.position.x + SITE_RADII[site.id] - 0.3, z: site.position.z }
      expect(getAutoMove(position, site.id)).toEqual({ x: 0, z: 0, arrived: true })
      expect(findNearbySite(position)).toBe(site.id)
    }
  })

  it('provides finite bounded travel towards the target', () => {
    const direction = getAutoMove({ x: 0, z: 20 }, 'opportunity')
    expect(direction.arrived).toBe(false)
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1)
    expect(direction.x).toBeLessThan(0)
    expect(direction.z).toBeLessThan(0)
  })

  it('reaches every ring from spawn at different frame rates', () => {
    for (const site of MARS_OBJECTS) {
      for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
        const position = { x: 0, z: 20 }
        let arrived = false
        for (let frame = 0; frame < 60 / dt; frame += 1) {
          const direction = getAutoMove(position, site.id)
          if (direction.arrived) { arrived = true; break }
          position.x += direction.x * 5.4 * dt
          position.z += direction.z * 5.4 * dt
        }
        expect(arrived).toBe(true)
        expect(findNearbySite(position)).toBe(site.id)
      }
    }
  })
})
