import * as THREE from 'three'
import { CALIBRATION_SAMPLE } from '../data/calibrationSample'
import { useGameStore } from '../store/gameStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { getCurrentProtocolStep } from './protocolStep'
import { getScanStationPoint } from './scanStation'
import { WORLD } from './worldConfig'

/**
 * Guided first walk on Mars: from the landing to the practice rock the
 * child follows one straight lane (PIP flies ahead, light dots on the
 * ground). Once close, the astronaut walks the last steps alone to a spot
 * facing the rock and waits there until the scanner comes out (Q).
 *
 *  - 'walk':   after PIP's arrival briefing, until the rock is near (M0/M1).
 *  - 'arrive': the rock is near and the scanner is still put away (M2).
 *  - null:     everything else (free movement rules apply).
 */
export type GuideMode = 'walk' | 'arrive' | null

/** Half width of the walking lane (meters). */
export const GUIDE_LANE_HALF_WIDTH = 1.4

export function getGuideMode(): GuideMode {
  const game = useGameStore.getState()
  if (game.scanStation) return null
  const protocol = useNarrativeStore.getState().protocol
  if (!protocol.briefed) return null
  const step = getCurrentProtocolStep()
  if (step === 'M0' || step === 'M1') return 'walk'
  if (step === 'M2' && !game.scannerEquipped) return 'arrive'
  return null
}

const startPoint = new THREE.Vector3()
const endPoint = new THREE.Vector3()

/** Start (landing) and end (spot facing the rock) of the lane, y = 0. */
export function getGuideLane(): { start: THREE.Vector3; end: THREE.Vector3 } {
  startPoint.set(WORLD.spawn.x, 0, WORLD.spawn.z)
  getScanStationPoint('practice', endPoint)
  return { start: startPoint, end: endPoint }
}

/** 0 at the landing, 1 at the rock spot; plus the closest lane point. */
export function projectOnLane(
  x: number,
  z: number,
  out: THREE.Vector3,
): number {
  const { start, end } = getGuideLane()
  const abx = end.x - start.x
  const abz = end.z - start.z
  const lengthSq = abx * abx + abz * abz || 1
  const t = Math.max(0, Math.min(1, ((x - start.x) * abx + (z - start.z) * abz) / lengthSq))
  out.set(start.x + abx * t, 0, start.z + abz * t)
  return t
}

const lanePoint = new THREE.Vector3()

/** Keep a position inside the lane (no wandering off, no walking back). */
export function clampToLane(position: THREE.Vector3): void {
  projectOnLane(position.x, position.z, lanePoint)
  const dx = position.x - lanePoint.x
  const dz = position.z - lanePoint.z
  const off = Math.hypot(dx, dz)
  const scale = off > GUIDE_LANE_HALF_WIDTH ? GUIDE_LANE_HALF_WIDTH / off : 1
  position.x = lanePoint.x + dx * scale
  position.z = lanePoint.z + dz * scale
}

/** The practice rock (world x/z). */
export function getPracticeRock(): { x: number; z: number } {
  return CALIBRATION_SAMPLE.position
}
