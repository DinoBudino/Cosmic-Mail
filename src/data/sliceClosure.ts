/**
 * Closing the Mars slice. After Spirit's letter is transmitted the cabin
 * says how many stories are restored and PIP picks up another faint signal.
 *
 * Canon limits kept here on purpose:
 * - The new signal is never named and unlocks nothing by itself.
 * - The Act III finale needs every active history (Moon and Mars).
 * - Nothing here writes progress; it is a read-only projection of the save.
 */

import { getEarnedStampIds } from '../store/journeyLogic'
import { ACTIVE_MISSION_IDS } from './missions'
import { storiesRestoredLabel } from './onboardingNarrative'
import type { JourneySave } from '../store/journeySchema'
import type { NarrativeCue, NarrativeProgress } from './missionNarrative'

export interface SliceClosure {
  restored: number
  total: number
  /** e.g. "1 of 3 stories restored". Null before the first delivery. */
  label: string | null
  allRestored: boolean
  /** True while some stories remain: PIP has another faint signal. */
  newSignal: boolean
}

export function getSliceClosure(save: JourneySave | null): SliceClosure {
  const total = ACTIVE_MISSION_IDS.length
  const restored = save ? getEarnedStampIds(save).length : 0
  return {
    restored,
    total,
    label: restored > 0 ? storiesRestoredLabel(restored, total) : null,
    allRestored: restored >= total,
    newSignal: restored > 0 && restored < total,
  }
}

/**
 * What a restored mission offers on a return visit: free exploration and
 * field notes. Scanning and delivering are already idempotent, so nothing
 * can be repeated or duplicated.
 */
export function getRevisitExploreCue(
  missionId: string,
  progress: NarrativeProgress | null,
  fieldNotesLeft: number,
): NarrativeCue | null {
  if (progress?.transmittedAt == null) return null
  return {
    id: `${missionId}:revisit-explore`,
    text:
      fieldNotesLeft > 0
        ? 'Mars is yours to explore now. Big rocks and layered outcrops can add field notes to your mission album.'
        : 'Mars is yours to explore now. Every field note is already in your mission album.',
    priority: 'ambient',
    expression: 'curious',
  }
}
