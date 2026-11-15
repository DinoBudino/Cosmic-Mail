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

export interface MinimapPoint {
  /** Position inside the unit disc: +x right, -y ahead (screen up). */
  x: number
  y: number
  distance: number
  inRange: boolean
}

/**
 * Heading-up minimap: the map turns with the camera, so "up" is always
 * where the child is looking. If the target is at the top, walking
 * forward (W / joystick up) heads straight for it. `cameraYaw` follows
 * the orbit convention: forward = (-sin yaw, -cos yaw) on XZ.
 */
export function getMinimapPoint(
  player: WorldPosition,
  target: WorldPosition,
  cameraYaw: number,
  range: number = SPIRIT_RADAR_RANGE,
): MinimapPoint {
  const dx = target.x - player.x
  const dz = target.z - player.z
  const distance = Math.hypot(dx, dz)
  if (distance < 1e-6 || range <= 0) {
    return { x: 0, y: 0, distance, inRange: distance <= range }
  }
  const sin = Math.sin(cameraYaw)
  const cos = Math.cos(cameraYaw)
  // Project on the camera's right (cos, -sin) and forward (-sin, -cos).
  const right = dx * cos - dz * sin
  const ahead = -dx * sin - dz * cos
  // Square-root spacing: nearby targets stay clear of the arrow in the
  // middle, far ones still glide in smoothly from the rim.
  const scale = Math.sqrt(Math.min(1, distance / range)) / distance
  return {
    x: right * scale,
    y: -ahead * scale,
    distance,
    inRange: distance <= range,
  }
}
