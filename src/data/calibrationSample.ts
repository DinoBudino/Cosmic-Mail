import type { WorldPosition } from './marsObjects'
import type { ScannerLensId } from './scannerLenses'

/**
 * The calibration sample at the station on the survey trail. It lives in its
 * own leaf module (no store imports) so both the protocol rules and the
 * environmental lookup can use it without an import cycle. It is NOT part of
 * ENVIRONMENTAL_SITES: it never creates a field note or a save entry.
 */
export interface CalibrationSample {
  id: string
  name: string
  position: WorldPosition
  /** Player-to-sample range for a valid calibration scan. */
  scanRange: number
  /** The one lens that reads this sample (taught once, in the open). */
  lens: ScannerLensId
}

export const CALIBRATION_STATION: WorldPosition = { x: 6, z: 47 }

export const CALIBRATION_SAMPLE: CalibrationSample = {
  id: 'calibration-sample',
  name: 'Calibration sample',
  position: { x: 8.5, z: 46 },
  scanRange: 9,
  lens: 'contact',
}
