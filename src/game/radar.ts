import type { WorldPosition } from '../data/marsObjects'

export interface RadarSnapshot {
  distance: number
  /** 0 = north (-Z), positive = clockwise toward east (+X). */
  bearing: number
  /** Relative target position inside the unit radar disc. +x east, +y south. */
  x: number
  y: number
  inRange: boolean
}

export const SPIRIT_RADAR_RANGE = 100

const RADAR_DIRECTIONS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const

/** Turns a bearing into a short, readable compass label. */
export function radarDirectionLabel(bearing: number): string {
  const fullTurn = Math.PI * 2
  const normalized = ((bearing % fullTurn) + fullTurn) % fullTurn
  const index = Math.round(normalized / (Math.PI / 4)) % RADAR_DIRECTIONS.length
  return RADAR_DIRECTIONS[index]!
}

/**
 * Maps a world-space target to a compact radar disc. The returned x/y
 * stay inside the unit circle, so the UI can clamp off-range blips to
 * the rim without distorting their direction.
 */
export function getRadarSnapshot(
  player: WorldPosition,
  target: WorldPosition,
  range: number = SPIRIT_RADAR_RANGE,
): RadarSnapshot {
  const dx = target.x - player.x
  const dz = target.z - player.z
  const distance = Math.hypot(dx, dz)
  if (distance < 1e-6 || range <= 0) {
    return {
      distance,
      bearing: 0,
      x: 0,
      y: 0,
      inRange: distance <= range,
    }
  }

  const scale = Math.min(1, distance / range)
  return {
    distance,
    bearing: Math.atan2(dx, -dz),
    x: (dx / distance) * scale,
    y: (dz / distance) * scale,
    inRange: distance <= range,
  }
}
