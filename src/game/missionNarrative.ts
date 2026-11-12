import { getMission, type MissionId } from '../data/missions'
import {
  getFlightRestrictedCue,
  getHintCue,
  stageForProgress,
} from '../data/missionNarrative'
import { SPIRIT_SITE } from '../data/spiritSite'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'

/** The only implemented surface mission today. */
export const MISSION_NARRATIVE_ID: MissionId = SPIRIT_SITE.missionId

/** PIP notices the rover from far away. */
export const MISSION_DETECT_RADIUS = SPIRIT_SITE.interactionRadius + 18

/** The inspection ring, where PIP introduces the scanner. */
export const MISSION_APPROACH_RADIUS = SPIRIT_SITE.interactionRadius + 2

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches
}

/**
 * Explicit "Ask PIP" action. Each request escalates one level (orient →
 * context → direct) for the current mission stage; changing stage starts the
 * ladder again. Uses JourneySave as the only progress source.
 */
const askLevels = new Map<string, number>()

export function requestMissionHint(
  missionId: MissionId = MISSION_NARRATIVE_ID,
): boolean {
  const mission = getMission(missionId)
  const progress =
    useJourneyStore.getState().save?.missions[missionId] ?? null
  const stage = stageForProgress(progress)
  const key = `${missionId}:${stage}`
  const nextLevel = Math.min(2, (askLevels.get(key) ?? -1) + 1)
  askLevels.set(key, nextLevel)

  const cue = getHintCue(mission, progress, nextLevel)
  if (!cue) return false

  const narrative = useNarrativeStore.getState()
  narrative.enqueue(cue)
  if (cue.componentId) {
    narrative.showAttention(cue.componentId, 'hint', 4200)
    narrative.react('hint', cue.componentId)
  } else {
    narrative.react('hint', undefined, 2200)
  }
  return true
}

/** Development/test helper: forget the graduated hint ladder. */
export function resetMissionHintLadder(): void {
  askLevels.clear()
}

let lastFlightNoticeAt = 0

/**
 * PIP explains the temporarily grounded boots. The restriction is a level
 * design decision, not a broken jetpack, so the line is calm and actionable.
 */
export function requestFlightRestrictedNotice(): void {
  const now = Date.now()
  if (now - lastFlightNoticeAt < 15_000) return
  const narrative = useNarrativeStore.getState()
  if (narrative.current || narrative.queue.length > 0) return
  lastFlightNoticeAt = now
  narrative.enqueue(getFlightRestrictedCue())
}

/**
 * Explicit inspection of the unidentified explorer. This is the valid
 * discovery event; proximity alone never sets `discovered`.
 */
export function inspectSpirit(
  missionId: MissionId = MISSION_NARRATIVE_ID,
): boolean {
  const save = useJourneyStore.getState().save
  if (!save) return false
  const progress = save.missions[missionId]
  if (progress?.discovered) return false
  return useJourneyStore.getState().discoverMission(missionId)
}
