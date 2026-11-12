/**
 * Pure Proposal A rules for a Cosmic Mail mission. No React, no storage
 * and no 3D: the UI calls these functions and persists the returned
 * JourneySave snapshot.
 *
 * Progression chain (each step requires the previous one):
 * unknown → discovered → investigating → ready_for_full_scan →
 * memory_recovered → smart_letter_ready → transmitted
 */

import {
  MISSION_IDS,
  findComponent,
  findMission,
  type DestinationId,
  type MissionId,
} from '../data/missions'
import { isEnvironmentalSiteId } from '../data/environmentalSites'
import {
  createMissionProgress,
  type JourneySave,
  type MissionProgress,
} from './journeySchema'

export type MissionStage =
  | 'unknown'
  | 'discovered'
  | 'investigating'
  | 'ready_for_full_scan'
  | 'memory_recovered'
  | 'smart_letter_ready'
  | 'transmitted'

export const MISSION_STAGE_LABEL: Record<MissionStage, string> = {
  unknown: 'Unidentified signal',
  discovered: 'Explorer identified',
  investigating: 'Recognizing fragments',
  ready_for_full_scan: 'Full scan ready',
  memory_recovered: 'Memory recovered',
  smart_letter_ready: 'Letter prepared',
  transmitted: 'History restored',
}

export function getMissionProgress(
  save: JourneySave,
  missionId: MissionId,
): MissionProgress {
  return save.missions[missionId] ?? createMissionProgress()
}

export function setMissionProgress(
  save: JourneySave,
  missionId: MissionId,
  progress: MissionProgress,
  now: number = Date.now(),
): JourneySave {
  return {
    ...save,
    missions: { ...save.missions, [missionId]: progress },
    updatedAt: now,
  }
}

export function countScannedComponents(
  save: JourneySave,
  missionId: MissionId,
): number {
  return new Set(getMissionProgress(save, missionId).scannedComponentIds).size
}

/** The single projection UI, radar, passport and narrative must share. */
export function getMissionStage(progress: MissionProgress | null): MissionStage {
  if (!progress) return 'unknown'
  if (progress.transmittedAt !== null) return 'transmitted'
  if (progress.smartLetterCreatedAt !== null) return 'smart_letter_ready'
  if (progress.memoryRecoveredAt !== null) return 'memory_recovered'
  const scanned = new Set(progress.scannedComponentIds).size
  if (scanned >= 3) return 'ready_for_full_scan'
  if (scanned > 0) return 'investigating'
  if (progress.discovered) return 'discovered'
  return 'unknown'
}

export function isFullScanUnlocked(
  save: JourneySave,
  missionId: MissionId,
): boolean {
  return (
    countScannedComponents(save, missionId) === 3 &&
    getMissionStage(getMissionProgress(save, missionId)) ===
      'ready_for_full_scan'
  )
}

export type ScanStatus =
  | 'scanned'
  | 'duplicate'
  | 'invalid-component'
  | 'unknown-mission'
  | 'mission-transmitted'

export interface ScanResult {
  save: JourneySave
  status: ScanStatus
  scannedCount: number
  fullScanUnlocked: boolean
}

/**
 * Records one recognized component. Repeating the same component is
 * idempotent: it never creates duplicates or rewrites the save.
 */
export function scanComponent(
  save: JourneySave,
  missionId: MissionId,
  componentId: string,
  now: number = Date.now(),
): ScanResult {
  const mission = findMission(missionId)
  if (!mission) {
    return {
      save,
      status: 'unknown-mission',
      scannedCount: 0,
      fullScanUnlocked: false,
    }
  }

  const progress = getMissionProgress(save, missionId)
  const scannedCount = new Set(progress.scannedComponentIds).size

  if (progress.transmittedAt !== null) {
    return {
      save,
      status: 'mission-transmitted',
      scannedCount,
      fullScanUnlocked: false,
    }
  }

  if (!findComponent(missionId, componentId)) {
    return {
      save,
      status: 'invalid-component',
      scannedCount,
      fullScanUnlocked: false,
    }
  }

  if (progress.scannedComponentIds.includes(componentId)) {
    return {
      save,
      status: 'duplicate',
      scannedCount,
      fullScanUnlocked: scannedCount === 3 && progress.memoryRecoveredAt === null,
    }
  }

  const nextProgress: MissionProgress = {
    ...progress,
    discovered: true,
    scannedComponentIds: [...progress.scannedComponentIds, componentId],
  }
  const nextSave = setMissionProgress(save, missionId, nextProgress, now)
  const nextCount = new Set(nextProgress.scannedComponentIds).size

  return {
    save: nextSave,
    status: 'scanned',
    scannedCount: nextCount,
    fullScanUnlocked:
      nextCount === 3 && nextProgress.memoryRecoveredAt === null,
  }
}

export type EnvironmentalScanStatus =
  | 'quick'
  | 'detailed'
  | 'duplicate'
  | 'unknown-site'

export interface EnvironmentalScanResult {
  save: JourneySave
  status: EnvironmentalScanStatus
}

/**
 * Records an optional environmental field observation. This is a separate
 * persistence track: it never touches mission stages, fragments, memory,
 * letters or stamps. Detailed readings also count as the quick discovery.
 */
export function recordEnvironmentalScan(
  save: JourneySave,
  siteId: string,
  detailed: boolean,
  now: number = Date.now(),
): EnvironmentalScanResult {
  if (!isEnvironmentalSiteId(siteId)) {
    return { save, status: 'unknown-site' }
  }
  const discovered = save.environmentalDiscoveries.includes(siteId)
  const detailedBefore =
    save.environmentalDetailedDiscoveries.includes(siteId)

  if (detailedBefore || (!detailed && discovered)) {
    return { save, status: 'duplicate' }
  }

  return {
    save: {
      ...save,
      environmentalDiscoveries: discovered
        ? save.environmentalDiscoveries
        : [...save.environmentalDiscoveries, siteId],
      environmentalDetailedDiscoveries: detailed
        ? [...save.environmentalDetailedDiscoveries, siteId]
        : save.environmentalDetailedDiscoveries,
      updatedAt: now,
    },
    status: detailed ? 'detailed' : 'quick',
  }
}

export type FullScanStatus =
  | 'memory-recovered'
  | 'locked'
  | 'already-recovered'
  | 'unknown-mission'

export interface FullScanResult {
  save: JourneySave
  status: FullScanStatus
  progress: MissionProgress | null
}

/**
 * The interactive climax: recognizing the complete explorer. It requires
 * all three component fragments and never repairs the machine. A valid
 * scan completes the recognition and recovers the fictional memory core
 * in one persisted event, so reload cannot strand a half-finished state.
 */
export function completeFullScan(
  save: JourneySave,
  missionId: MissionId,
  now: number = Date.now(),
): FullScanResult {
  const mission = findMission(missionId)
  if (!mission) {
    return { save, status: 'unknown-mission', progress: null }
  }
  const progress = getMissionProgress(save, missionId)

  if (progress.memoryRecoveredAt !== null) {
    return { save, status: 'already-recovered', progress }
  }

  if (countScannedComponents(save, missionId) < mission.components.length) {
    return { save, status: 'locked', progress }
  }

  const nextProgress: MissionProgress = {
    ...progress,
    discovered: true,
    fullScanCompletedAt: now,
    memoryRecoveredAt: now,
  }
  return {
    save: setMissionProgress(save, missionId, nextProgress, now),
    status: 'memory-recovered',
    progress: nextProgress,
  }
}

export type SmartLetterStatus =
  | 'created'
  | 'already-created'
  | 'locked'
  | 'unknown-mission'

export interface SmartLetterResult {
  save: JourneySave
  status: SmartLetterStatus
  progress: MissionProgress | null
}

/**
 * Generates the smart letter from the recovered memory. Its content is a
 * read-only projection of the mission catalog; only the timestamp is
 * persisted, so the letter cannot be duplicated or partly generated.
 */
export function prepareSmartLetter(
  save: JourneySave,
  missionId: MissionId,
  now: number = Date.now(),
): SmartLetterResult {
  const mission = findMission(missionId)
  if (!mission) {
    return { save, status: 'unknown-mission', progress: null }
  }
  const progress = getMissionProgress(save, missionId)

  if (progress.smartLetterCreatedAt !== null) {
    return { save, status: 'already-created', progress }
  }
  if (progress.memoryRecoveredAt === null) {
    return { save, status: 'locked', progress }
  }

  const nextProgress: MissionProgress = {
    ...progress,
    smartLetterCreatedAt: now,
  }
  return {
    save: setMissionProgress(save, missionId, nextProgress, now),
    status: 'created',
    progress: nextProgress,
  }
}

export type ReconstructionStatus =
  | 'watched'
  | 'already-watched'
  | 'locked'
  | 'unknown-mission'

/**
 * Marks the first viewing of the historical recreation. Replays are
 * idempotent: they never create a delivery or a stamp.
 */
export function markReconstructionWatched(
  save: JourneySave,
  missionId: MissionId,
  now: number = Date.now(),
): { save: JourneySave; status: ReconstructionStatus } {
  if (!findMission(missionId)) return { save, status: 'unknown-mission' }
  const progress = getMissionProgress(save, missionId)

  if (progress.smartLetterCreatedAt === null) {
    return { save, status: 'locked' }
  }
  if (progress.reconstructionWatchedAt !== null) {
    return { save, status: 'already-watched' }
  }
  const nextProgress: MissionProgress = {
    ...progress,
    reconstructionWatchedAt: now,
  }
  return {
    save: setMissionProgress(save, missionId, nextProgress, now),
    status: 'watched',
  }
}

export type TransmissionStatus =
  | 'transmitted'
  | 'already-transmitted'
  | 'letter-missing'
  | 'unknown-mission'

export interface TransmissionResult {
  save: JourneySave
  status: TransmissionStatus
  progress: MissionProgress | null
  stampId: string | null
}

/**
 * Sends the smart letter to the fictional Cosmic Archive on Earth. This is
 * the only function that grants `stampEarned`. Repeating it never creates
 * a second delivery.
 */
export function transmitLetter(
  save: JourneySave,
  missionId: MissionId,
  now: number = Date.now(),
): TransmissionResult {
  const mission = findMission(missionId)
  if (!mission) {
    return { save, status: 'unknown-mission', progress: null, stampId: null }
  }
  const progress = getMissionProgress(save, missionId)

  if (progress.transmittedAt !== null) {
    return {
      save,
      status: 'already-transmitted',
      progress,
      stampId: mission.stampId,
    }
  }
  if (progress.smartLetterCreatedAt === null) {
    return { save, status: 'letter-missing', progress, stampId: null }
  }

  const nextProgress: MissionProgress = {
    ...progress,
    transmittedAt: now,
    stampEarned: true,
  }
  return {
    save: setMissionProgress(save, missionId, nextProgress, now),
    status: 'transmitted',
    progress: nextProgress,
    stampId: mission.stampId,
  }
}

export function isMissionComplete(
  save: JourneySave,
  missionId: MissionId,
): boolean {
  return getMissionProgress(save, missionId).transmittedAt !== null
}

/**
 * Clears only one mission's A progress. Used by the development
 * "Reset Spirit pilot" action. Identity, other missions, onboarding and
 * the v4 shape are preserved.
 */
export function resetMissionProgress(
  save: JourneySave,
  missionId: MissionId,
  now: number = Date.now(),
): JourneySave {
  if (!findMission(missionId)) return save
  return setMissionProgress(save, missionId, createMissionProgress(), now)
}

/**
 * Marks a mission as discovered without changing scans or rewards.
 * Used when the player first reaches the historical machine.
 */
export function markMissionDiscovered(
  save: JourneySave,
  missionId: MissionId,
  now: number = Date.now(),
): JourneySave {
  if (!findMission(missionId)) return save
  const progress = getMissionProgress(save, missionId)
  if (progress.discovered) return save
  return setMissionProgress(
    save,
    missionId,
    { ...progress, discovered: true },
    now,
  )
}

/** Unique stamp ids, derived from transmitted progress (no duplicate list). */
export function getEarnedStampIds(save: JourneySave): MissionId[] {
  return MISSION_IDS.filter(
    (missionId) => getMissionProgress(save, missionId).transmittedAt !== null,
  )
}

export function areAllMissionsComplete(save: JourneySave): boolean {
  return getEarnedStampIds(save).length === MISSION_IDS.length
}

export function setCurrentDestination(
  save: JourneySave,
  destination: DestinationId,
  now: number = Date.now(),
): JourneySave {
  return { ...save, currentDestination: destination, updatedAt: now }
}

export function markIntroSeen(
  save: JourneySave,
  now: number = Date.now(),
): JourneySave {
  return { ...save, introSeen: true, updatedAt: now }
}

export function markOnboardingComplete(
  save: JourneySave,
  now: number = Date.now(),
): JourneySave {
  return { ...save, introSeen: true, onboardingComplete: true, updatedAt: now }
}

export function markFinalQuoteShown(
  save: JourneySave,
  now: number = Date.now(),
): JourneySave {
  return { ...save, finalQuoteShown: true, updatedAt: now }
}
