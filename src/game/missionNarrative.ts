import { getMission, type MissionId } from '../data/missions'
import {
  getDistractorCue,
  getFlightRestrictedCue,
  getHintCue,
  getLensHintCue,
  getPendingComponents,
  getWrongLensCue,
  stageForProgress,
} from '../data/missionNarrative'
import {
  canSpeakLensHint,
  lensFeedbackChannel,
} from '../data/lensFeedback'
import {
  CALIBRATE_FIRST_LINE,
  canInspectSignal,
  getProtocolHint,
  type ProtocolLine,
} from '../data/arrivalProtocol'
import { getCurrentProtocolStep } from './protocolStep'
import { useGameStore } from '../store/gameStore'
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

  // From the second request on, orient toward the right lens: first by the
  // instrument's function, then by naming the way of observing.
  const pending = getPendingComponents(mission, progress)
  const aimed = useGameStore.getState().scannerSelectedComponentId
  const focus =
    pending.find((component) => component.id === aimed) ?? pending[0]
  if (focus) {
    const lensCue = getLensHintCue(mission, focus, progress, nextLevel)
    if (lensCue) narrative.enqueue({ ...lensCue, tier: 0, solicited: true })
  }
  return true
}

const DISTRACTOR_COOLDOWN_MS = 6000
let lastLensHintAt: number | null = null
let lastDistractorNoteAt = 0

/**
 * The player pressed scan on a part with the wrong lens. `attempt` is the
 * per-component press count (1-based). Attempt 1 is panel-only, attempt 2
 * gets one PIP line (rate-limited), attempt 3+ is a pulse on the correct
 * lens button: PIP stays quiet. Returns whether PIP spoke.
 */
export function requestWrongLensFeedback(
  componentId: string,
  missionId: MissionId = MISSION_NARRATIVE_ID,
  attempt = 2,
  now: number = Date.now(),
): boolean {
  if (lensFeedbackChannel(attempt) !== 'pip') return false
  if (!canSpeakLensHint(lastLensHintAt, now)) return false
  const mission = getMission(missionId)
  const component = mission.components.find((c) => c.id === componentId)
  if (!component) return false
  const narrative = useNarrativeStore.getState()
  // Never talk over PIP: this hint is optional, so it is dropped, not queued.
  if (narrative.current || narrative.queue.length > 0) return false
  const enqueued = narrative.enqueue({
    ...getWrongLensCue(mission, component, 1),
    tier: 1,
  })
  if (enqueued) {
    lastLensHintAt = now
    narrative.react('hint', componentId)
  }
  return enqueued
}

/** The player scanned a distractor part: brief note, never progress. */
export function requestDistractorNote(
  distractorId: string,
  missionId: MissionId = MISSION_NARRATIVE_ID,
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

/** Development/test helper: forget lens feedback counters and cooldowns. */
export function resetLensFeedback(): void {
  lastLensHintAt = null
  lastDistractorNoteAt = 0
}

/** Development/test helper: forget the graduated hint ladder. */
export function resetMissionHintLadder(): void {
  askLevels.clear()
  lastLensHintAt = null
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
  // The opening protocol comes first: calibrate before inspecting the signal.
  if (!canInspectSignal(getCurrentProtocolStep(save))) {
    requestProtocolLine(CALIBRATE_FIRST_LINE)
    return false
  }
  return useJourneyStore.getState().discoverMission(missionId)
}
