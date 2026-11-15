import {
  MISSION_STAGE_LABEL,
  getMissionStage,
  type MissionStage,
} from '../store/journeyLogic'
import type { MissionProgress } from '../store/journeySchema'

export { MISSION_STAGE_LABEL, getMissionStage }
export type { MissionStage }

export function scannedComponentCount(
  progress: MissionProgress | null,
): number {
  return new Set(progress?.scannedComponentIds ?? []).size
}

/**
 * Label for the archive CTA shared by the scanner HUD, radar and mission
 * panel. `null` means no archive action is available yet.
 */
export function getArchiveCtaLabel(stage: MissionStage): string | null {
  switch (stage) {
    // memory_recovered: the objective bar carries "Open album" itself.
    case 'smart_letter_ready':
    case 'transmitted':
      return 'Open album'
    default:
      return null
  }
}
