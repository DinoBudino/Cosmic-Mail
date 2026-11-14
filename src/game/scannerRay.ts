/**
 * Pure raycast filter for the physical Cosmic Scanner. The controller
 * converts Three.js intersections into these lightweight records, sorted
 * from nearest to farthest, and this function decides whether the first
 * relevant object is a valid educational component.
 */
export interface ScannerRayHit {
  componentId: string | null
  missionId: string | null
  /** Real rover part that gives a PIP note but no progress. */
  distractorId?: string | null
  /** Optional environmental observation anchored to a world mesh. */
  environmentalId?: string | null
  /** Distance from the camera along the ray. */
  distance: number
  /** World-space hit point, used for range checks and physical aim. */
  x: number
  y: number
  z: number
  /** Player, held scanner, PIP and other non-world objects. */
  ignored: boolean
  /** Opaque meshes occlude targets; transparent beacons do not. */
  opaque: boolean
}

export interface ScannerTarget {
  componentId: string
  /** Player-to-component distance (not camera distance). */
  distance: number
  /** Exact world hit point under the pointer reticle. */
  x: number
  y: number
  z: number
}

export interface EnvironmentalScannerTarget {
  environmentalId: string
  distance: number
  x: number
  y: number
  z: number
}

export interface DistractorScannerTarget {
  distractorId: string
  distance: number
  x: number
  y: number
  z: number
}

export type ScannerPick =
  | ScannerTarget
  | EnvironmentalScannerTarget
  | DistractorScannerTarget
  | null

export function pickScannerTarget(
  hits: readonly ScannerRayHit[],
  missionId: string,
  player: { x: number; z: number },
  range: number,
): ScannerPick {
  for (const hit of hits) {
    if (hit.ignored) continue

    if (hit.environmentalId) {
      const distance = Math.hypot(hit.x - player.x, hit.z - player.z)
      if (distance > range) return null
      return {
        environmentalId: hit.environmentalId,
        distance,
        x: hit.x,
        y: hit.y,
        z: hit.z,
      }
    }

    if (hit.distractorId) {
      if (hit.missionId !== missionId) return null
      const distance = Math.hypot(hit.x - player.x, hit.z - player.z)
      if (distance > range) return null
      return {
        distractorId: hit.distractorId,
        distance,
        x: hit.x,
        y: hit.y,
        z: hit.z,
      }
    }

    if (hit.componentId) {
      if (hit.missionId !== missionId) return null
      const distance = Math.hypot(hit.x - player.x, hit.z - player.z)
      if (distance > range) return null
      return {
        componentId: hit.componentId,
        distance,
        x: hit.x,
        y: hit.y,
        z: hit.z,
      }
    }

    // The first opaque non-target object is an occluder.
    if (hit.opaque) return null
  }
  return null
}
