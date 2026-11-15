import type { ExplorerId } from '../data/spiritSite'

/**
 * The identification moment (the child presses E at the explorer) as a
 * short film: three camera shots that take time to show the machine up
 * close, while PIP tells who it is. Pure geometry: Player.tsx applies the
 * result to the camera.
 *
 * 1. Reveal: a wide 3/4 view that slowly pushes in.
 * 2. Close-up: near and a little above, drifting around the top parts.
 * 3. Hero: low to the ground, looking up at the explorer.
 *
 * Shots are relative to the explorer's best side (its scan station view)
 * and scaled to its size (the Apollo descent stage is far larger than the
 * rover).
 */

interface ShotSpec {
  /** Shot ends at this share of the whole sequence. */
  until: number
  /** Angle (radians) around the explorer from its best side, start → end. */
  angle: readonly [number, number]
  /** Distance in explorer sizes, start → end. */
  distance: readonly [number, number]
  /** Camera and look heights in explorer heights. */
  cameraHeight: readonly [number, number]
  lookHeight: number
}

export const EXPLORER_SHOTS: readonly ShotSpec[] = [
  { until: 0.34, angle: [-0.75, -0.55], distance: [3.3, 2.7], cameraHeight: [0.6, 0.55], lookHeight: 0.5 },
  { until: 0.68, angle: [0.3, 0.55], distance: [1.75, 1.55], cameraHeight: [1.08, 1.0], lookHeight: 0.78 },
  { until: 1, angle: [1.5, 1.25], distance: [2.5, 2.3], cameraHeight: [0.2, 0.24], lookHeight: 0.62 },
]

/** Footprint radius and height (m) used to size the shots. */
const EXPLORER_SIZE: Readonly<Record<ExplorerId, { size: number; height: number }>> = {
  opportunity: { size: 1.6, height: 1.7 },
  spirit: { size: 1.6, height: 1.7 },
  'viking-1': { size: 2.0, height: 1.8 },
  'surveyor-3': { size: 2.2, height: 2.4 },
  'apollo-11': { size: 4.0, height: 3.2 },
}

/** Lowest the camera goes above the ground (m). */
const MIN_CLEARANCE = 0.35

export interface ShotFrame {
  shot: number
  position: { x: number; y: number; z: number }
  look: { x: number; y: number; z: number }
}

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

function mix(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t
}

/**
 * Camera at `progress` (0..1) of the identification sequence.
 * `bestSide` is the world direction from the explorer to its best view;
 * `groundAt` gives the terrain height so low shots never dip under it.
 */
export function getExplorerShot(
  progress: number,
  explorer: ExplorerId,
  center: { x: number; z: number },
  bestSide: { x: number; z: number },
  groundAt: (x: number, z: number) => number,
): ShotFrame {
  const p = Math.min(1, Math.max(0, progress))
  const shot = Math.max(0, EXPLORER_SHOTS.findIndex((entry) => p <= entry.until))
  const spec = EXPLORER_SHOTS[shot]!
  const from = shot === 0 ? 0 : EXPLORER_SHOTS[shot - 1]!.until
  const t = smooth((p - from) / Math.max(1e-6, spec.until - from))
  const { size, height } = EXPLORER_SIZE[explorer]
  const base = Math.atan2(bestSide.z, bestSide.x)
  const angle = base + mix(spec.angle, t)
  const distance = mix(spec.distance, t) * size
  const x = center.x + Math.cos(angle) * distance
  const z = center.z + Math.sin(angle) * distance
  const ground = groundAt(x, z)
  const centerGround = groundAt(center.x, center.z)
  return {
    shot,
    position: {
      x,
      y: Math.max(ground + MIN_CLEARANCE, centerGround + mix(spec.cameraHeight, t) * height),
      z,
    },
    look: { x: center.x, y: centerGround + spec.lookHeight * height, z: center.z },
  }
}
