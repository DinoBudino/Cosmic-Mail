import * as THREE from 'three'
import { MAILWING_LANDING, SPIRIT_SITE, type MoonExplorerId } from '../data/spiritSite'
import type { RockInstance } from './landscape'
import { getCraters, getLunarHeight } from './lunarGround'
import { mulberry32 } from './random'
import { SURVEY_ROUTE, WORLD } from './worldConfig'

/** Lunar rock tones: dark basalt to pale, sun-bleached breccia. */
export const MOON_ROCK = {
  dark: '#4c4a47',
  light: '#9a968f',
  dust: '#b4b0a8',
} as const

function distanceToTrail(x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < SURVEY_ROUTE.length - 1; i += 1) {
    const a = SURVEY_ROUTE[i]!
    const b = SURVEY_ROUTE[i + 1]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / len2))
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)))
  }
  return best
}

/**
 * Rocks on the Moon. Most are small, angular and scattered; boulders cluster
 * on the rims of fresh craters, where impacts threw them out (ejecta). The
 * landing zone, the ship, the explorer and the trail stay clear.
 */
export function createLunarRocks(site: MoonExplorerId, count: number): RockInstance[] {
  const random = mulberry32(site === 'apollo-11' ? 0xa11e : 0x5a3e)
  const craters = getCraters(site).filter((crater) => crater.fresh > 0.55 && crater.radius > 2.5)
  const rocks: RockInstance[] = []
  let attempts = 0
  while (rocks.length < count && attempts < count * 40) {
    attempts += 1
    let x: number
    let z: number
    let ejecta = false
    if (craters.length > 0 && random() < 0.45) {
      // Ejecta: around a fresh crater rim.
      const crater = craters[Math.floor(random() * craters.length)]!
      const angle = random() * Math.PI * 2
      const dist = crater.radius * (0.95 + random() * 0.9)
      x = crater.x + Math.cos(angle) * dist
      z = crater.z + Math.sin(angle) * dist
      ejecta = true
    } else {
      const angle = random() * Math.PI * 2
      const dist = Math.sqrt(random()) * (WORLD.playRadius + 6)
      x = Math.cos(angle) * dist
      z = Math.sin(angle) * dist
    }
    if (Math.hypot(x, z) > WORLD.playRadius + 6) continue
    if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < 5) continue
    if (Math.hypot(x - MAILWING_LANDING.position.x, z - MAILWING_LANDING.position.z) < 8.5) continue
    if (Math.hypot(x - SPIRIT_SITE.position.x, z - SPIRIT_SITE.position.z) < SPIRIT_SITE.ringRadius + 2.5) continue
    if (distanceToTrail(x, z) < 2.2) continue
    const boulder = random() < (ejecta ? 0.1 : 0.03)
    const scale = boulder ? 0.9 + random() * 0.8 : 0.12 + random() * 0.55
    const stretchY = 0.45 + random() * 0.5
    const color = new THREE.Color(MOON_ROCK.dark).lerp(new THREE.Color(MOON_ROCK.light), random() * (ejecta ? 1 : 0.7))
    rocks.push({
      x,
      y: getLunarHeight(site, x, z) + scale * stretchY * 0.38,
      z,
      scale,
      stretchX: 0.75 + random() * 0.8,
      stretchY,
      stretchZ: 0.6 + random() * 0.8,
      variant: Math.floor(random() * 3),
      rotation: random() * Math.PI * 2,
      tilt: (random() - 0.5) * 0.5,
      color,
    })
  }
  return rocks
}
