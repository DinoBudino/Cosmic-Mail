/**
 * Pure narrative rules for the Cosmic Mail missions. Turns persistent
 * JourneySave progress into PIP cues, so React components only react to
 * the returned cue objects. No rendering, timers or storage here.
 *
 * Identity discipline: before `discovered`, cues never name the machine
 * or its parts. After discovery, PIP may explain what the player scans.
 */

import type { PipTier } from './pipDialogPolicy'
import { getMissionStage, type MissionStage } from '../store/journeyLogic'
import { pipLine } from './pipVoiceCatalog'
import type {
  MissionComponent,
  MissionDefinition,
  MissionId,
} from './missions'

/**
 * Priority order used by the narrative queue:
 * archive (essential story) > mission (instruction) > discovery (fragment
 * explanation) > hint (requested/optional help) > ambient (flavour).
 */
export type NarrativePriority =
  | 'ambient'
  | 'hint'
  | 'discovery'
  | 'mission'
  | 'archive'

/**
 * PIP's visible emotion. Kokoro has no direct emotion parameter, so the
 * recorded performance carries the prosody and this value drives the 3D
 * expression, the subtitle tone and the playback treatment.
 */
export type NarrativeExpression =
  | 'idle'
  | 'curious'
  | 'happy'
  | 'thinking'
  | 'surprised'
  | 'alert'
  | 'excited'
  | 'concerned'
  | 'focused'
  | 'hopeful'
  | 'celebrating'

export interface NarrativeCue {
  /** Dedupe key. Re-enqueuing the same id is ignored while pending. */
  id: string
  text: string
  priority: NarrativePriority
  /** Defaults to true. Repeated hints can opt out. */
  once?: boolean
  expression?: NarrativeExpression
  componentId?: string
  /** Explicit dialogue tier (0 most important). Defaults from `priority`. */
  tier?: PipTier
  /** The player asked for it (Ask PIP) or caused it directly. */
  solicited?: boolean
  /** The player already moved on: the line is cancelled instead of played. */
  cancelWhen?: () => boolean
  /**
   * An action tip (what to do now): shown in PIP's tip card, which stays
   * on screen until the child has done it, instead of the story box.
   */
  tip?: NarrativeTip
}

export interface NarrativeTip {
  /** The child did what the tip says: the tip card closes. */
  doneWhen?: () => boolean
  /** Without `doneWhen`: how long the tip card stays (ms). */
  ttlMs?: number
}

export type ArchiveCueKind = 'locked' | 'memory' | 'letter' | 'transmitted'

export interface ArchiveNarrativeCue {
  id: string
  missionId: MissionId
  text: string
  kind: ArchiveCueKind
}

/** The subset of MissionProgress the narrative rules need. */
export interface NarrativeProgress {
  scannedComponentIds: readonly string[]
  discovered?: boolean
  fullScanCompletedAt?: number | null
  memoryRecoveredAt?: number | null
  smartLetterCreatedAt?: number | null
  transmittedAt?: number | null
}

function narrativeFor(mission: MissionDefinition) {
  return mission.narrative ?? null
}

export function stageForProgress(
  progress: NarrativeProgress | null,
): MissionStage {
  return getMissionStage({
    discovered: progress?.discovered === true,
    scannedComponentIds: [...(progress?.scannedComponentIds ?? [])],
    fullScanCompletedAt: progress?.fullScanCompletedAt ?? null,
    memoryRecoveredAt: progress?.memoryRecoveredAt ?? null,
    smartLetterCreatedAt: progress?.smartLetterCreatedAt ?? null,
    reconstructionWatchedAt: null,
    transmittedAt: progress?.transmittedAt ?? null,
    stampEarned: progress?.transmittedAt != null,
    legacySealAt: null,
  })
}

export function scannedComponentCount(progress: NarrativeProgress | null): number {
  return new Set(progress?.scannedComponentIds ?? []).size
}

export function getPendingComponents(
  mission: MissionDefinition,
  progress: NarrativeProgress | null,
): MissionComponent[] {
  const scanned = new Set(progress?.scannedComponentIds ?? [])
  return mission.components.filter((component) => !scanned.has(component.id))
}

/** Newly recorded ids only, so a duplicate scan never repeats PIP's line. */
export function getNewComponentIds(
  scanned: readonly string[],
  previous: readonly string[],
): string[] {
  const known = new Set(previous)
  return scanned.filter((id) => !known.has(id))
}

export function getComponentCue(
  mission: MissionDefinition,
  componentId: string,
): NarrativeCue | null {
  const component = mission.components.find((entry) => entry.id === componentId)
  if (!component) return null
  return {
    id: `${mission.id}:component:${component.id}`,
    text: component.pipLine,
    priority: 'discovery',
    expression: 'excited',
    componentId: component.id,
  }
}

export function getMissionEntryCue(
  mission: MissionDefinition,
  progress: NarrativeProgress | null,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative || !progress) return null

  const stage = stageForProgress(progress)

  if (stage === 'transmitted') {
    return {
      id: `${mission.id}:revisit-transmitted`,
      text: narrative.revisitTransmitted,
      priority: 'ambient',
      expression: 'hopeful',
    }
  }
  if (stage === 'memory_recovered') {
    return {
      id: `${mission.id}:revisit-memory`,
      text: pipLine('mars-hint-letter'),
      priority: 'mission',
      expression: 'hopeful',
    }
  }
  if (stage === 'smart_letter_ready') {
    return {
      id: `${mission.id}:revisit-letter-ready`,
      text: narrative.revisitLetterReady,
      priority: 'mission',
      expression: 'hopeful',
    }
  }
  if (
    stage === 'discovered' ||
    stage === 'investigating' ||
    stage === 'ready_for_full_scan'
  ) {
    return {
      id: `${mission.id}:revisit-in-progress`,
      text: narrative.revisitInProgress,
      priority: 'mission',
      expression: 'curious',
    }
  }
  return {
    id: `${mission.id}:entered`,
    text: narrative.entered,
    priority: 'mission',
    expression: 'excited',
  }
}

export function getDetectedCue(
  mission: MissionDefinition,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative) return null
  return {
    id: `${mission.id}:detected`,
    text: narrative.detected,
    priority: 'discovery',
    expression: 'surprised',
  }
}

export function getApproachedCue(
  mission: MissionDefinition,
  coarsePointer = false,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative) return null
  return {
    id: `${mission.id}:approached`,
    text: coarsePointer ? narrative.approachedTouch : narrative.approached,
    priority: 'discovery',
    expression: 'curious',
  }
}

/**
 * The valid identification event. Only called after the journey store has
 * persisted `discovered`, so the machine name can appear here for the first
 * time. Proximity alone never produces this cue.
 */
export function getIdentifiedCue(
  mission: MissionDefinition,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative) return null
  return {
    id: `${mission.id}:identified`,
    text: narrative.identified,
    // Same rank as the approach beat: enqueue order keeps "It looks like an
    // old rover" before the recovered name.
    priority: 'discovery',
    expression: 'excited',
  }
}

export function getScannerPromptCue(
  mission: MissionDefinition,
  coarsePointer: boolean,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative) return null
  return {
    id: `${mission.id}:scanner-prompt`,
    text: coarsePointer
      ? narrative.scannerPromptTouch
      : narrative.scannerPromptDesktop,
    priority: 'mission',
    expression: 'focused',  tip: {},
  }
}

/**
 * Parts hunt: the part to find now, in the mission's order (eyes, rock tool,
 * heat reader). Null before discovery or when every part is recorded.
 */
export function getHuntTarget(
  mission: MissionDefinition,
  progress: NarrativeProgress | null,
): MissionComponent | null {
  if (!progress?.discovered) return null
  return getPendingComponents(mission, progress)[0] ?? null
}

/**
 * Parts hunt: PIP's clue for the part to find now. Only after discovery
 * (the clue may name what the part does). Null without a clue.
 */
export function getHuntClueCue(
  mission: MissionDefinition,
  componentId: string,
): NarrativeCue | null {
  const component = mission.components.find((c) => c.id === componentId)
  if (!component?.huntClue) return null
  return {
    id: `${mission.id}:clue:${componentId}`,
    text: component.huntClue.line,
    priority: 'mission',
    expression: 'curious',
    componentId,  tip: {},
  }
}

/** PIP's celebration right after the third (last) part. */
export function getCompletionCue(
  mission: MissionDefinition,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative) return null
  return {
    id: `${mission.id}:completed`,
    text: narrative.completed,
    // Same rank as the component explanation so the third part is
    // explained before the celebration.
    priority: 'discovery',
    expression: 'celebrating',
  }
}

export function getLetterPreparedCue(
  mission: MissionDefinition,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative) return null
  return {
    id: `${mission.id}:letter-prepared`,
    text: narrative.letterPrepared,
    priority: 'archive',
    expression: 'hopeful',
  }
}

export function getReturnToShipCue(
  mission: MissionDefinition,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative) return null
  return {
    id: `${mission.id}:return-to-ship`,
    text: narrative.returnToShip,
    priority: 'mission',
    expression: 'celebrating',  tip: {},
  }
}

/** Optional field observation; never part of historical mission progress. */
export function getEnvironmentalCue(
  siteId: string,
  detailed: boolean,
  text: string,
): NarrativeCue {
  return {
    id: `environment:${siteId}:${detailed ? 'detailed' : 'quick'}`,
    text,
    priority: 'ambient',
    expression: detailed ? 'excited' : 'curious',
  }
}

export function getFirstEnvironmentalScanCue(): NarrativeCue {
  return {
    id: 'environment:first-scan',
    text: pipLine('mars-env-first-scan'),
    priority: 'mission',
    expression: 'curious',
  }
}

/** Quiet flavour lines. The controller limits them to a couple per visit. */
export function getAmbientCue(
  mission: MissionDefinition,
  index: number,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  const text = narrative?.ambient[index]
  if (!text) return null
  return {
    id: `${mission.id}:ambient:${index + 1}`,
    text,
    priority: 'ambient',
    expression: 'curious',
  }
}

/**
 * Graduated "Ask PIP" help. Level 0 orients, level 1 points at the kind of
 * tool, level 2 names the missing part and how to scan it. Before
 * `discovered`, no level can reveal the machine or a component name.
 */
export function getHintCue(
  mission: MissionDefinition,
  progress: NarrativeProgress | null,
  level: number = 0,
): NarrativeCue | null {
  const narrative = narrativeFor(mission)
  if (!narrative) return null
  const stage = stageForProgress(progress)
  const safeLevel = Math.min(2, Math.max(0, Math.floor(level)))

  if (stage === 'unknown') {
    return {
      id: `${mission.id}:hint:${safeLevel === 0 ? 'orientation' : 'context'}`,
      text:
        safeLevel === 0
          ? narrative.hintOrientation
          : narrative.hintContext,
      priority: 'hint',
      once: false,
      tip: {},
      expression: 'thinking',
    }
  }

  if (
    stage === 'ready_for_full_scan' ||
    stage === 'memory_recovered' ||
    stage === 'smart_letter_ready'
  ) {
    return {
      id: `${mission.id}:hint:letter`,
      text: pipLine('mars-hint-letter'),
      priority: 'hint',
      once: false,
      tip: {},
      expression: 'hopeful',
    }
  }

  if (stage === 'transmitted') {
    return {
      id: `${mission.id}:hint:restored`,
      text: pipLine('mars-hint-restored'),
      priority: 'ambient',
      once: false,
      expression: 'hopeful',
    }
  }

  // Parts hunt: the first answer repeats the clue (the part glows a little),
  // the next ones say exactly where to aim.
  const huntTarget = getHuntTarget(mission, progress)
  if (huntTarget?.huntClue && safeLevel === 0) {
    return {
      id: `${mission.id}:hint:clue:${huntTarget.id}`,
      text: huntTarget.huntClue.line,
      priority: 'hint',
      once: false,
      tip: {},
      expression: 'thinking',
      componentId: huntTarget.id,
    }
  }
  if (huntTarget?.huntClue) {
    // Level 1: a gentle nudge that still names nothing; level 2: exactly
    // which part and where.
    const gentle = safeLevel === 1 ? huntTarget.pipHint : undefined
    const text =
      gentle ??
      huntTarget.pipDirectHint ??
      huntTarget.pipHint ??
      `${narrative.genericHint} Look closely: ${huntTarget.scanHint}`
    return {
      id: `${mission.id}:hint:${huntTarget.id}:${gentle ? 'nudge' : 'direct'}`,
      text,
      priority: 'hint',
      once: false,
      tip: {},
      expression: 'focused',
      componentId: huntTarget.id,
    }
  }

  if (safeLevel < 2) {
    return {
      id: `${mission.id}:hint:${safeLevel === 0 ? 'orientation' : 'context'}`,
      text:
        safeLevel === 0
          ? narrative.hintOrientation
          : narrative.hintContext,
      priority: 'hint',
      once: false,
      tip: {},
      expression: 'thinking',
    }
  }

  const pending = getPendingComponents(mission, progress)
  if (pending.length === 0) return null

  const component =
    pending.find(
      (entry) => Boolean(entry.pipDirectHint) || Boolean(entry.pipHint),
    ) ?? pending[0]
  const text =
    component.pipDirectHint ??
    component.pipHint ??
    `${narrative.genericHint} Look closely: ${component.scanHint}`

  return {
    id: `${mission.id}:hint:${component.id}:direct`,
    text,
    priority: 'hint',
    once: false,
    tip: {},
    expression: 'focused',
    componentId: component.id,
  }
}

/**
 * Gentle nudge after a long stretch without progress and without movement.
 * It uses the level-1 context line but keeps a separate id so an explicit
 * Ask PIP request is never swallowed by this proactive cue.
 */
export function getSoftHintCue(
  mission: MissionDefinition,
  progress: NarrativeProgress | null,
): NarrativeCue | null {
  const stage = stageForProgress(progress)
  // Before identification even a proactive nudge stays at orientation level.
  const cue = getHintCue(mission, progress, stage === 'unknown' ? 0 : 1)
  if (!cue) return null
  return {
    ...cue,
    id: `${mission.id}:soft-hint:${stageForProgress(progress)}`,
    priority: 'hint',
    once: true,
    expression: 'curious',
  }
}

/**
 * PIP line for the archive overlay. The smart letter itself is content
 * from the mission, not a quiz.
 */
export function getArchiveCue(
  mission: MissionDefinition,
  progress: NarrativeProgress | null,
): ArchiveNarrativeCue {
  const narrative = narrativeFor(mission)
  const stage = stageForProgress(progress)

  if (stage === 'transmitted') {
    return {
      id: `${mission.id}:archive:transmitted`,
      missionId: mission.id,
      kind: 'transmitted',
      text: mission.completionStory,
    }
  }
  if (stage === 'smart_letter_ready') {
    return {
      id: `${mission.id}:archive:letter`,
      missionId: mission.id,
      kind: 'letter',
      text: narrative?.letterPrepared ?? mission.pipBriefing,
    }
  }
  if (stage === 'memory_recovered') {
    return {
      id: `${mission.id}:archive:memory`,
      missionId: mission.id,
      kind: 'memory',
      text: narrative?.memoryRecovered ?? pipLine('mars-memory-recovered'),
    }
  }
  return {
    id: `${mission.id}:archive:locked`,
    missionId: mission.id,
    kind: 'locked',
    text: narrative?.revisitInProgress ?? pipLine('mars-revisit-in-progress'),
  }
}

/** Short PIP note for a distractor part. Never adds progress. */
export function getDistractorCue(
  mission: MissionDefinition,
  distractorId: string,
  progress: NarrativeProgress | null,
): NarrativeCue | null {
  if (!progress?.discovered) return null
  const distractor = mission.distractors?.find((d) => d.id === distractorId)
  if (!distractor) return null
  return {
    id: `${mission.id}:distractor:${distractor.id}`,
    text: distractor.pipNote,
    priority: 'hint',
    once: false,
    expression: 'curious',
  }
}
