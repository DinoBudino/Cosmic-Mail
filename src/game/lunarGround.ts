/**
 * Lunar ground for the two Moon landings. Pure height/colour rules (no
 * React), read by getTerrainHeight() whenever the active explorer is on
 * the Moon, so the player, rocks, the ship and the camera all stand on the
 * same ground.
 *
 * World axes on the Moon: +X is east, -Z is north. The explorer always sits
 * at SPIRIT_SITE.position and Mailwing lands by the spawn, about 120 m away.
 *
 * Real features, kept to scale where the playable area allows:
 * - Apollo 11, Tranquility Base: a smooth mare plain. Little West crater
 *   (about 30 m across) lies some 60 m east of Eagle; the much larger West
 *   crater (about 190 m) lies about 400 m west, on the horizon.
 * - Surveyor 3: it rests on the inner slope of a crater about 200 m across
 *   and about 12 m deep (later named Surveyor crater). Apollo 12 landed
 *   on its rim about 155-180 m away, which is where Mailwing sets down.
 * Small craters follow a steep size distribution (many small, few large),
 * as on any mare surface.
 */

import { MAILWING_LANDING, SPIRIT_SITE, type MoonExplorerId } from '../data/spiritSite'
import { mulberry32 } from './random'
import { SURVEY_ROUTE, WORLD } from './worldConfig'

export interface Crater {
  x: number
  z: number
  /** Rim radius (m). */
  radius: number
  /** Floor depth below the surrounding plain (m). */
  depth: number
  /** Rim height above the plain (m). */
  rim: number
  /** 0 = old and soft, 1 = fresh (sharper rim, brighter ejecta). */
  fresh: number
}

export interface LunarSite {
  /** Hand-placed craters with real counterparts. */
  landmarks: readonly Crater[]
  /** Seed for the small crater field. */
  seed: number
  /** Broad relief amplitude (m): mare plains are smooth. */
  relief: number
  /**
   * Explorer ground: 'flat' levels it, 'slope' keeps the crater wall and
   * fits a tangent plane, so the lander sits tilted as it really does.
   */
  explorerGround: 'flat' | 'slope'
  /** Direction toward the Sun (world, normalized on use). */
  sun: { x: number; y: number; z: number }
  /**
   * Direction toward Earth (world, normalized on use). Earth really stands
   * high in the sky at both sites (about 66 deg), toward the west at
   * Tranquility Base and toward the east at Surveyor 3. The game camera only
   * sees a few degrees above the horizon, so Earth is drawn low (about 4 deg)
   * and turned to about 25 deg from the walking direction (north), on its real
   * side: the one liberty that lets children see it while they walk.
   */
  earth: { x: number; y: number; z: number }
}

const EXPLORER = SPIRIT_SITE.position

export const LUNAR_SITES: Readonly<Record<MoonExplorerId, LunarSite>> = {
  'apollo-11': {
    landmarks: [
      // Little West crater, ~30 m across, ~60 m east of the Lunar Module.
      { x: EXPLORER.x + 60, z: EXPLORER.z - 4, radius: 15, depth: 4.2, rim: 0.9, fresh: 0.9 },
      // West crater, ~190 m across, ~400 m west: a long rim on the horizon.
      { x: EXPLORER.x - 400, z: EXPLORER.z + 10, radius: 95, depth: 20, rim: 5, fresh: 0.7 },
    ],
    seed: 0x0a11,
    relief: 0.9,
    explorerGround: 'flat',
    // Lunar morning at landing: the Sun low in the east (about 10-15 deg),
    // long shadows pointing west.
    sun: { x: 0.95, y: 0.24, z: 0.18 },
    // Seen from 0.7 N, 23.5 E, Earth hangs about 23 deg from the zenith,
    // toward the west (drawn lower, see LunarSite.earth).
    earth: { x: -0.421, y: 0.075, z: -0.904 },
  },
  'surveyor-3': {
    landmarks: [
      // Surveyor crater: ~200 m across, ~12 m deep. Its centre is placed so
      // the spacecraft (at the explorer site) rests on the inner wall and
      // the landing zone stands on the plain beyond the north-west rim.
      { x: EXPLORER.x - 36, z: EXPLORER.z - 30, radius: 100, depth: 12, rim: 1.6, fresh: 0.35 },
    ],
    seed: 0x5e3,
    relief: 1.2,
    explorerGround: 'slope',
    sun: { x: 0.93, y: 0.27, z: -0.22 },
    // From 3.0 S, 23.4 W, Earth is about 23 deg from the zenith, toward the
    // east and a little north (drawn lower, see LunarSite.earth).
    earth: { x: 0.421, y: 0.075, z: -0.904 },
  },
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function hash2(ix: number, iz: number, seed: number): number {
  const value = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453123
  return value - Math.floor(value)
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const u = fx * fx * (3 - 2 * fx)
  const v = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz, seed)
  const b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed)
  const d = hash2(ix + 1, iz + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function fbm(x: number, z: number, seed: number, octaves: number): number {
  let amplitude = 0.5
  let frequency = 1
  let sum = 0
  let norm = 0
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += (valueNoise(x * frequency, z * frequency, seed + octave * 13) * 2 - 1) * amplitude
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2.07
  }
  return sum / norm
}

/** Height contribution of one crater (bowl, raised rim, soft ejecta apron). */
export function craterHeight(crater: Crater, x: number, z: number): number {
  const d = Math.hypot(x - crater.x, z - crater.z)
  const q = d / crater.radius
  if (q > 2.2) return 0
  // Bowl: parabolic floor softened at the bottom, meeting the rim at q = 1.
  const bowl = q < 1 ? -crater.depth * (1 - q * q) * (0.75 + 0.25 * smoothstep(0, 0.6, q)) : 0
  // Rim: sharper for fresh craters, then an apron falling off outside.
  const width = 0.16 + (1 - crater.fresh) * 0.18
  const k = (q - 1) / width
  const rim = crater.rim * Math.exp(-(k * k))
  const apron = q > 1 ? crater.rim * 0.35 * (1 - smoothstep(1, 2.2, q)) : 0
  return bowl + rim + apron
}

const SMALL_CRATER_COUNT = 70

function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2))
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz))
}

function distanceToTrail(x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < SURVEY_ROUTE.length - 1; i += 1) {
    const a = SURVEY_ROUTE[i]!
    const b = SURVEY_ROUTE[i + 1]!
    best = Math.min(best, distanceToSegment(x, z, a.x, a.z, b.x, b.z))
  }
  return best
}

const craterCache = new Map<MoonExplorerId, readonly Crater[]>()

/**
 * Every crater on the map: the real landmarks plus a deterministic field of
 * small ones (power-law sizes, 1.2-11 m radius) kept off the landing zone,
 * the ship, the explorer and the walking trail so the route stays easy.
 */
export function getCraters(site: MoonExplorerId): readonly Crater[] {
  const cached = craterCache.get(site)
  if (cached) return cached
  const config = LUNAR_SITES[site]
  const random = mulberry32(config.seed)
  const list: Crater[] = [...config.landmarks]
  let attempts = 0
  while (list.length < config.landmarks.length + SMALL_CRATER_COUNT && attempts < 4000) {
    attempts += 1
    // Many small, few large: radius ~ 1.2 / u^0.55, capped.
    const radius = Math.min(11, 1.2 / Math.pow(0.08 + random() * 0.92, 0.75))
    const angle = random() * Math.PI * 2
    const dist = Math.sqrt(random()) * (WORLD.playRadius + 60)
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist
    if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < radius + 9) continue
    if (Math.hypot(x - MAILWING_LANDING.position.x, z - MAILWING_LANDING.position.z) < radius + 9) continue
    if (Math.hypot(x - EXPLORER.x, z - EXPLORER.z) < radius + 11) continue
    if (radius > 2.2 && distanceToTrail(x, z) < radius + 2) continue
    // Not on top of a landmark rim.
    let overlaps = false
    for (const mark of config.landmarks) {
      const d = Math.hypot(x - mark.x, z - mark.z)
      if (Math.abs(d - mark.radius) < radius + 4) overlaps = true
    }
    if (overlaps) continue
    const fresh = random() < 0.25 ? 0.75 + random() * 0.25 : random() * 0.55
    list.push({ x, z, radius, depth: radius * (0.16 + fresh * 0.08), rim: radius * (0.05 + fresh * 0.05), fresh })
  }
  craterCache.set(site, list)
  return list
}

function rawLunarHeight(site: MoonExplorerId, x: number, z: number): number {
  const config = LUNAR_SITES[site]
  // Mare plains: very gentle broad swells and a fine undulation.
  let height =
    fbm(x * 0.011, z * 0.011, config.seed + 3, 3) * config.relief * 1.6 +
    fbm(x * 0.06, z * 0.06, config.seed + 7, 3) * config.relief * 0.35 +
    fbm(x * 0.4, z * 0.4, config.seed + 11, 2) * 0.05
  for (const crater of getCraters(site)) {
    if (Math.abs(x - crater.x) > crater.radius * 2.2 || Math.abs(z - crater.z) > crater.radius * 2.2) continue
    height += craterHeight(crater, x, z)
  }
  return height
}

interface Flat {
  x: number
  z: number
  radius: number
  height: number
  /** Tangent-plane gradient (dh/dx, dh/dz); zero for a level pad. */
  gx: number
  gz: number
}

const flatCache = new Map<MoonExplorerId, readonly Flat[]>()

function flatsFor(site: MoonExplorerId): readonly Flat[] {
  const cached = flatCache.get(site)
  if (cached) return cached
  const level = (x: number, z: number, radius: number): Flat => ({
    x, z, radius, height: rawLunarHeight(site, x, z), gx: 0, gz: 0,
  })
  const explorer = (() => {
    const radius = SPIRIT_SITE.ringRadius + 3.5
    if (LUNAR_SITES[site].explorerGround === 'flat') return level(EXPLORER.x, EXPLORER.z, radius)
    // Fit the crater wall around the lander with a plane (average slope over
    // a few metres), so the pads all touch the ground of the tilted plane.
    const s = 3
    const h = rawLunarHeight(site, EXPLORER.x, EXPLORER.z)
    const gx = (rawLunarHeight(site, EXPLORER.x + s, EXPLORER.z) - rawLunarHeight(site, EXPLORER.x - s, EXPLORER.z)) / (2 * s)
    const gz = (rawLunarHeight(site, EXPLORER.x, EXPLORER.z + s) - rawLunarHeight(site, EXPLORER.x, EXPLORER.z - s)) / (2 * s)
    return { x: EXPLORER.x, z: EXPLORER.z, radius, height: h, gx, gz }
  })()
  const list = [
    level(WORLD.spawn.x, WORLD.spawn.z, 9),
    level(MAILWING_LANDING.position.x, MAILWING_LANDING.position.z, 8),
    explorer,
  ]
  flatCache.set(site, list)
  return list
}

/** Ground slope of the explorer pad: the lander is tilted to match it. */
export function getExplorerGroundTilt(site: MoonExplorerId): { gx: number; gz: number } {
  const pad = flatsFor(site)[2]!
  return { gx: pad.gx, gz: pad.gz }
}

/** Ground elevation on the Moon (metres). */
export function getLunarHeight(site: MoonExplorerId, x: number, z: number): number {
  let height = rawLunarHeight(site, x, z)
  for (const flat of flatsFor(site)) {
    const d = Math.hypot(x - flat.x, z - flat.z)
    if (d >= flat.radius) continue
    const target = flat.height + flat.gx * (x - flat.x) + flat.gz * (z - flat.z)
    const blend = 1 - smoothstep(flat.radius * 0.72, flat.radius, d)
    height += (target - height) * blend
  }
  // Beyond the walkable area, a long gentle rise and some highland swells
  // close the view without a visible edge.
  const r = Math.hypot(x, z)
  height += smoothstep(118, 200, r) * 4 + smoothstep(190, 420, r) * (6 + fbm(x * 0.006, z * 0.006, 91, 3) * 10)
  return height
}

/** 0..1 brightness of fresh ejecta around young craters (for colouring). */
export function getEjectaBrightness(site: MoonExplorerId, x: number, z: number): number {
  let bright = 0
  for (const crater of getCraters(site)) {
    if (crater.fresh < 0.6) continue
    const d = Math.hypot(x - crater.x, z - crater.z)
    const q = d / crater.radius
    if (q < 0.85 || q > 2.6) continue
    // Short bright rays: an angular pattern fading with distance.
    const angle = Math.atan2(z - crater.z, x - crater.x)
    const rays = 0.55 + 0.45 * Math.max(0, Math.sin(angle * 7 + crater.x) * Math.sin(angle * 3 + crater.z))
    bright = Math.max(bright, crater.fresh * rays * (1 - smoothstep(1, 2.6, q)))
  }
  return bright
}

/**
 * Lunar regolith tones (mare basalt plains). Neutral, slightly warm grays:
 * the Moon reads dark gray in NASA images, brighter on sunlit slopes and
 * around fresh craters, with almost black shadows.
 */
export const MOON_GROUND = {
  dark: '#3f3d3b',
  mid: '#6b6864',
  light: '#8e8a85',
  bright: '#b3aea6',
  trail: '#7d7974',
  footprint: '#2e2c2a',
} as const
