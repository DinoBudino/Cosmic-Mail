export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface BeamSegment {
  center: Vec3Like
  length: number
  /** Unit vector from the emitter towards the impact point. */
  direction: Vec3Like
}

/** The beam stops this far short of the surface so it never covers the reticle. */
export const BEAM_END_INSET = 0.04
/** Shorter segments are not drawn at all. */
export const BEAM_MIN_LENGTH = 0.08

/**
 * Pure beam geometry: emitter -> impact point, stopping slightly before the
 * surface. Returns null when there is nothing worth drawing.
 */
export function computeBeamSegment(
  start: Vec3Like,
  end: Vec3Like,
  endInset: number = BEAM_END_INSET,
  minLength: number = BEAM_MIN_LENGTH,
): BeamSegment | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dz = end.z - start.z
  const full = Math.hypot(dx, dy, dz)
  if (!Number.isFinite(full) || full < minLength + endInset) return null

  const direction = { x: dx / full, y: dy / full, z: dz / full }
  const length = full - endInset
  return {
    center: {
      x: start.x + direction.x * (length / 2),
      y: start.y + direction.y * (length / 2),
      z: start.z + direction.z * (length / 2),
    },
    length,
    direction,
  }
}

/** Frame-rate independent fade: moves `value` towards `target`. */
export function approachAlpha(
  value: number,
  target: number,
  deltaSeconds: number,
  ratePerSecond = 9,
): number {
  const step = Math.min(1, Math.max(0, deltaSeconds) * ratePerSecond)
  const next = value + (target - value) * step
  return Math.abs(target - next) < 0.01 ? target : next
}
