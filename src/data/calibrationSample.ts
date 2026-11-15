import type { WorldPosition } from './marsObjects'

/**
 * The practice rock right next to the landing spot: the first thing the
 * child scans after the arrival briefing. It lives in its own leaf module
 * (no store imports) so both the protocol rules and the environmental lookup
 * can use it without an import cycle. It is NOT part of ENVIRONMENTAL_SITES:
 * it never creates a field note or a save entry.
 *
 * The ids keep their historical "calibration" names so code and tests stay
 * stable; everything the child sees calls it the practice rock.
 */
export interface CalibrationSample {
  id: string
  name: string
  position: WorldPosition
  /** Player-to-sample range for a valid practice scan. */
  scanRange: number
}

/** Where the practice step starts (a few steps from the landing). */
export const CALIBRATION_STATION: WorldPosition = { x: -2, z: 68.5 }

export const CALIBRATION_SAMPLE: CalibrationSample = {
  id: 'calibration-sample',
  name: 'Practice rock',
  position: { x: -3.2, z: 66.2 },
  scanRange: 9,
}

/** What the reward card says after the practice scan. No unverified claims. */
export const PRACTICE_SCAN_RESULT = {
  title: 'Practice rock',
  detail: 'Your scanner read its shape, color and texture. Great aiming!',
} as const
