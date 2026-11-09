import { describe, expect, it } from 'vitest'
import { MARS_OBJECTS } from '../data/marsObjects'
import {
  findNearbySite,
  getAutoMove,
  resolveSiteCollision,
  SITE_COLLISION_RADII,
  SITE_RADII,
} from './interaction'
import { distanceToPath } from './terrainHeight'
import { PLAYER, WORLD } from './worldConfig'

describe('findNearbySite', () => {
  it('finds every site, including coming-soon Viking 1', () => {
    for (const site of MARS_OBJECTS) expect(findNearbySite(site.position)).toBe(site.id)
  })

  it('returns no site at spawn or far outside the world', () => {
    expect(findNearbySite({ ...WORLD.spawn })).toBeNull()
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

  it('arrives without getting stuck on a model footprint', () => {
    for (const site of MARS_OBJECTS) {
      for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
        const position = { ...WORLD.spawn }
        let arrived = false
        for (let frame = 0; frame < 60 / dt; frame += 1) {
          const direction = getAutoMove(position, site.id)
          if (direction.arrived) { arrived = true; break }
          position.x += direction.x * 5.4 * dt
          position.z += direction.z * 5.4 * dt
          resolveSiteCollision(position)
        }
        expect(arrived).toBe(true)
        expect(findNearbySite(position)).toBe(site.id)
      }
    }
  })

  it('provides finite bounded travel towards the target', () => {
    const direction = getAutoMove({ ...WORLD.spawn }, 'opportunity')
    expect(direction.arrived).toBe(false)
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1)
    expect(direction.x).toBeLessThan(0)
    expect(direction.z).toBeLessThan(0)
  })

  it('walks the painted route instead of a separate straight line', () => {
    // Fase 4 · Paso 2 (decisión nº 3): visible path and assisted travel share
    // PATH_WAYPOINTS. These destinations pass through other site footprints
    // along the loop, so the walk must stay in the route corridor while
    // rounding them, and still arrive inside the target ring.
    for (const siteId of ['viking1', 'ingenuity'] as const) {
      const dt = 1 / 60
      const position = { ...WORLD.spawn }
      let arrived = false
      let maxDeviation = 0
      for (let frame = 0; frame < 60 / dt; frame += 1) {
        const direction = getAutoMove(position, siteId)
        if (direction.arrived) { arrived = true; break }
        position.x += direction.x * 5.4 * dt
        position.z += direction.z * 5.4 * dt
        resolveSiteCollision(position)
        maxDeviation = Math.max(maxDeviation, distanceToPath(position.x, position.z))
      }
      expect(arrived).toBe(true)
      expect(findNearbySite(position)).toBe(siteId)
      expect(maxDeviation).toBeLessThan(4.5)
    }
  })

  it('reaches every ring from spawn at different frame rates', () => {
    for (const site of MARS_OBJECTS) {
      for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
        const position = { ...WORLD.spawn }
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

describe('resolveSiteCollision', () => {
  it('pushes the player outside every model footprint', () => {
    for (const site of MARS_OBJECTS) {
      const position = { x: site.position.x, z: site.position.z }
      resolveSiteCollision(position)
      const distance = Math.hypot(
        position.x - site.position.x,
        position.z - site.position.z,
      )
      expect(distance).toBeGreaterThanOrEqual(
        SITE_COLLISION_RADII[site.id] + PLAYER.radius - 1e-9,
      )
      expect(findNearbySite(position)).toBe(site.id)
    }
  })

  it('leaves positions outside the model footprints untouched', () => {
    const position = { ...WORLD.spawn }
    resolveSiteCollision(position)
    expect(position).toEqual({ ...WORLD.spawn })
  })

  it('always leaves a reachable band inside each interaction ring', () => {
    for (const site of MARS_OBJECTS) {
      expect(SITE_COLLISION_RADII[site.id] + PLAYER.radius).toBeLessThan(
        SITE_RADII[site.id],
      )
    }
  })
})
