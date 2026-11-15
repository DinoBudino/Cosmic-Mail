/**
 * The solar storm's "hit" on Mailwing during the intro: a short tremor
 * of the ship and a brown-out flicker of the cabin lights.
 *
 * Shared, frame-polled state (no React re-render): the intro UI starts a
 * quake when the beat reaches its moment, and the camera, the lights,
 * PIP and the window hologram read it every frame.
 *
 * Safety for children: the tremor is brief and small, the lights only
 * dim partially (never black, never a white flash) and dip at most twice
 * in any second — well under the three-flashes-per-second guideline.
 * Callers skip the visuals entirely when reduced motion is on.
 */

export interface QuakeSample {
  /** 0..1 strength of the tremor right now (0 when idle). */
  shake: number
  /** Multiplier for cabin lights: 1 normal, down to ~0.4 in a dip. */
  light: number
  /** Seconds since the quake started (or -1 when idle). */
  t: number
}

interface ActiveQuake {
  start: number
  duration: number
  strength: number
}

let active: ActiveQuake | null = null

const IDLE: QuakeSample = { shake: 0, light: 1, t: -1 }

/** Light dips: [start s, end s, depth]. Max two in any one second. */
const LIGHT_DIPS: ReadonlyArray<readonly [number, number, number]> = [
  [0.06, 0.3, 0.58],
  [0.72, 0.86, 0.42],
  [1.36, 1.46, 0.25],
]

/** Tremor envelope: fast attack, smooth decay to zero at the end. */
export function quakeEnvelope(t: number, duration: number): number {
  if (t < 0 || t >= duration) return 0
  const attack = Math.min(1, t / 0.08)
  const decay = 1 - t / duration
  return attack * decay * decay
}

/** Light multiplier at time t (seconds) for a quake of given strength. */
export function quakeLight(t: number, strength: number): number {
  let dim = 0
  for (const [from, to, depth] of LIGHT_DIPS) {
    if (t >= from && t < to) {
      // Soft edges inside each dip: no hard strobe.
      const k = Math.sin(((t - from) / (to - from)) * Math.PI)
      dim = Math.max(dim, depth * k)
    }
  }
  return 1 - dim * Math.min(1, strength)
}

export function startIntroQuake(durationMs: number, strength: number, now = performance.now()): void {
  active = { start: now, duration: durationMs / 1000, strength }
}

export function stopIntroQuake(): void {
  active = null
}

export function sampleIntroQuake(now = performance.now()): QuakeSample {
  if (!active) return IDLE
  const t = (now - active.start) / 1000
  if (t >= active.duration) {
    active = null
    return IDLE
  }
  return {
    shake: quakeEnvelope(t, active.duration) * active.strength,
    light: quakeLight(t, active.strength),
    t,
  }
}

/**
 * Deterministic tremor offset (scene units / radians) for a strength:
 * a few unrelated sines, so it reads as rumble rather than a wobble.
 */
export function quakeOffset(t: number, shake: number): { x: number; y: number; roll: number } {
  const x = (Math.sin(t * 47) * 0.6 + Math.sin(t * 83 + 1.3) * 0.4) * 0.05 * shake
  const y = (Math.sin(t * 59 + 0.7) * 0.6 + Math.sin(t * 97 + 2.1) * 0.4) * 0.035 * shake
  const roll = Math.sin(t * 31 + 0.4) * 0.012 * shake
  return { x, y, roll }
}
