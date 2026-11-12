import { describe, expect, it } from 'vitest'
import { getMission } from '../data/missions'
import { SPIRIT_SITE } from '../data/spiritSite'
import { createRocks } from './landscape'
import { PLAYER, WORLD } from './worldConfig'
import {
  distanceToSpirit,
  findNearbySpirit,
  resolveSpiritCollision,
} from './spiritSite'

describe('Spirit pilot site', () => {
  it('points to the Spirit mission and stays inside the playable radius', () => {
    const mission = getMission(SPIRIT_SITE.missionId)
    expect(mission.machineName).toBe('Spirit')
    expect(SPIRIT_SITE.destination).toBe('mars')
    expect(Math.hypot(SPIRIT_SITE.position.x, SPIRIT_SITE.position.z)).toBeLessThan(
      WORLD.playRadius,
    )
    expect(SPIRIT_SITE.placeholderNote.length).toBeGreaterThan(0)
  })

  it('leaves a reachable band between the footprint and the scan range', () => {
    expect(SPIRIT_SITE.collisionRadius + PLAYER.radius).toBeLessThan(
      SPIRIT_SITE.interactionRadius,
    )
    expect(SPIRIT_SITE.ringRadius).toBeLessThan(SPIRIT_SITE.interactionRadius)
  })

  it('detects the scan range inclusively', () => {
    expect(findNearbySpirit(SPIRIT_SITE.position)).toBe(true)
    expect(
      findNearbySpirit({
        x: SPIRIT_SITE.position.x,
        z: SPIRIT_SITE.position.z + SPIRIT_SITE.interactionRadius,
      }),
    ).toBe(true)
    expect(
      findNearbySpirit({
        x: SPIRIT_SITE.position.x,
        z: SPIRIT_SITE.position.z + SPIRIT_SITE.interactionRadius + 0.001,
      }),
    ).toBe(false)
    expect(distanceToSpirit(SPIRIT_SITE.position)).toBe(0)
  })

  it('keeps the visible ring clear of generated rocks', () => {
    for (const count of [48, 120]) {
      for (const rock of createRocks(count)) {
        const clearance =
          Math.hypot(
            rock.x - SPIRIT_SITE.position.x,
            rock.z - SPIRIT_SITE.position.z,
          ) - rock.scale
        expect(clearance).toBeGreaterThan(SPIRIT_SITE.ringRadius)
      }
    }
  })

  it('pushes the player out of the provisional rover footprint', () => {
    const position = { ...SPIRIT_SITE.position }
    resolveSpiritCollision(position)
    expect(
      Math.hypot(
        position.x - SPIRIT_SITE.position.x,
        position.z - SPIRIT_SITE.position.z,
      ),
    ).toBeGreaterThanOrEqual(
      SPIRIT_SITE.collisionRadius + PLAYER.radius - 1e-9,
    )
    expect(findNearbySpirit(position)).toBe(true)
  })

  it('leaves a player outside the footprint untouched', () => {
    const position = {
      x: SPIRIT_SITE.position.x + SPIRIT_SITE.collisionRadius + PLAYER.radius + 1,
      z: SPIRIT_SITE.position.z,
    }
    const before = { ...position }
    resolveSpiritCollision(position)
    expect(position).toEqual(before)
  })
})
