import * as THREE from 'three'
import { CALIBRATION_SAMPLE, PRACTICE_STATION_VIEW } from '../data/calibrationSample'
import { getScanStationView, SPIRIT_SITE } from '../data/spiritSite'
import type { ScanStationTarget } from '../store/gameStore'
import { getTerrainHeight } from './terrainHeight'

/**
 * Scan station geometry, shared by the player (where to stand, where to
 * look) and the narrative controller. Two stations use the same still,
 * framed view: the practice rock and the explorer's parts hunt.
 */
function stationOf(target: ScanStationTarget) {
  return target === 'practice'
    ? { center: CALIBRATION_SAMPLE.position, view: PRACTICE_STATION_VIEW }
    : { center: SPIRIT_SITE.position, view: getScanStationView() }
}

/** Where the astronaut stands (world x/z; y is 0). */
export function getScanStationPoint(
  target: ScanStationTarget,
  out: THREE.Vector3,
): THREE.Vector3 {
  const { center, view } = stationOf(target)
  const length = Math.hypot(view.direction.x, view.direction.z) || 1
  return out.set(
    center.x + (view.direction.x / length) * view.distance,
    0,
    center.z + (view.direction.z / length) * view.distance,
  )
}

/** Eye height above the ground at the station. */
export function getScanStationEyeHeight(target: ScanStationTarget): number {
  return stationOf(target).view.eyeHeight
}

/** The point the still camera looks at (world). */
export function getScanStationLook(
  target: ScanStationTarget,
  out: THREE.Vector3,
): THREE.Vector3 {
  const { center, view } = stationOf(target)
  return out.set(
    center.x,
    getTerrainHeight(center.x, center.z) + view.lookHeight,
    center.z,
  )
}
