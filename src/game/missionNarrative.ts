import { getMission, type MissionId } from '../data/missions'
import {
  getDistractorCue,
  getHintCue,
  stageForProgress,
} from '../data/missionNarrative'
import {
  CALIBRATE_FIRST_LINE,
  canInspectSignal,
  getProtocolHint,
  type ProtocolLine,
} from '../data/arrivalProtocol'
import { getCurrentProtocolStep } from './protocolStep'
import { SPIRIT_SITE } from '../data/spiritSite'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'

/** The only implemented surface mission today. */

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
  missionId: MissionId = SPIRIT_SITE.missionId,
): boolean {
  const mission = getMission(missionId)
  const progress =
    useJourneyStore.getState().save?.missions[missionId] ?? null

  // The opening protocol (M0–M3) has its own step-by-step hints.
  const protocolStep = getCurrentProtocolStep()
  const protocolHint = getProtocolHint(protocolStep, isCoarsePointer())
  if (protocolHint) {
    const narrative = useNarrativeStore.getState()
    narrative.enqueue({
      id: `protocol:hint:${protocolStep}`,
      text: protocolHint,
      priority: 'hint',
      once: false,
      expression: 'thinking',
      tier: 0,
      solicited: true,
    })
    narrative.react('hint', undefined, 2200)
    return true
  }

  const stage = stageForProgress(progress)
  const key = `${missionId}:${stage}`
  const nextLevel = Math.min(2, (askLevels.get(key) ?? -1) + 1)
  askLevels.set(key, nextLevel)

  const cue = getHintCue(mission, progress, nextLevel)
  if (!cue) return false

  const narrative = useNarrativeStore.getState()
  // The answer to Ask PIP is always P0: it may cut in and may be repeated.
  narrative.enqueue({ ...cue, tier: 0, solicited: true })
  if (cue.componentId) {
    narrative.showAttention(cue.componentId, 'hint', 4200)
    narrative.react('hint', cue.componentId)
  } else {
    narrative.react('hint', undefined, 2200)
  }

  return true
}

const DISTRACTOR_COOLDOWN_MS = 6000
let lastDistractorNoteAt = 0

/** The player scanned a distractor part: brief note, never progress. */
export function requestDistractorNote(
  distractorId: string,
  missionId: MissionId = SPIRIT_SITE.missionId,
  now: number = Date.now(),
): boolean {
  if (now - lastDistractorNoteAt < DISTRACTOR_COOLDOWN_MS) return false
  const mission = getMission(missionId)
  const progress =
    useJourneyStore.getState().save?.missions[missionId] ?? null
  const cue = getDistractorCue(mission, distractorId, progress)
  if (!cue) return false
  const narrative = useNarrativeStore.getState()
  // The player scanned it on purpose, so it is a reply, not a nudge.
  const enqueued = narrative.enqueue({ ...cue, solicited: true })
  if (enqueued) {
    lastDistractorNoteAt = now
    narrative.react('hint', undefined, 1800)
  }
  return enqueued
}

/** Development/test helper: forget the distractor note cooldown. */
export function resetDistractorFeedback(): void {
  lastDistractorNoteAt = 0
}

/** Development/test helper: forget the graduated hint ladder. */
export function resetMissionHintLadder(): void {
  askLevels.clear()
  lastDistractorNoteAt = 0
}

const protocolLineAt = new Map<string, number>()

/**
 * One protocol notice. Notices never queue behind another line (they are
 * dropped when PIP is already talking) and repeat only after `cooldownMs`.
 */
export function requestProtocolLine(
  line: ProtocolLine,
  cooldownMs = 20_000,
  now: number = Date.now(),
): boolean {
  const last = protocolLineAt.get(line.id)
  if (last !== undefined && now - last < cooldownMs) return false
  const narrative = useNarrativeStore.getState()
  if (narrative.current || narrative.queue.length > 0) return false
  const enqueued = narrative.enqueue({
    id: line.id,
    text: line.text,
    priority: 'mission',
    once: false,
    expression: 'focused',
    tier: 0,
  }, now)
  if (enqueued) protocolLineAt.set(line.id, now)
  return enqueued
}

/** Development/test helper: forget protocol notice cooldowns. */
export function resetProtocolNotices(): void {
  protocolLineAt.clear()
}

/**
 * Explicit inspection of the unidentified explorer. This is the valid
 * discovery event; proximity alone never sets `discovered`.
 */
export function inspectSpirit(
  missionId: MissionId = SPIRIT_SITE.missionId,
): boolean {
  const save = useJourneyStore.getState().save
  if (!save) return false
  const progress = save.missions[missionId]
  if (progress?.discovered) return false
  // The opening protocol comes first: calibrate before inspecting the signal.
  if (!canInspectSignal(getCurrentProtocolStep(save))) {
    requestProtocolLine(CALIBRATE_FIRST_LINE)
    return false
  }
  return useJourneyStore.getState().discoverMission(missionId)
}
