/**
 * Mars arrival protocol: one clear objective at a time, derived from the
 * journey progress plus three ephemeral flags. Pure rules, no React and no
 * persistence: nothing here is a second source of truth. Reloading simply
 * re-derives the step; before `discovered` the short opening steps replay,
 * after it the protocol resumes exactly where the save says it is.
 *
 * Identity discipline: no text in this module may name the explorer or any
 * of its parts. That is only allowed after `discovered`.
 */

import { getMissionStage, type MissionStage } from '../store/journeyLogic'
import type { JourneySave, MissionProgress } from '../store/journeySchema'
import type { MissionId } from './missions'
import { SURVEY_ROUTE, WORLD } from '../game/worldConfig'
import {
  CALIBRATION_SAMPLE,
  CALIBRATION_STATION,
  type CalibrationSample,
} from './calibrationSample'
import type { WorldPosition } from './marsObjects'
import { getBriefingTexts } from './marsBriefing'

export const PROTOCOL_STEPS = [
  'M0',
  'M1',
  'M2',
  'M3',
  'M4',
  'M6',
  'M7',
] as const
export type ProtocolStep = (typeof PROTOCOL_STEPS)[number]

/** Ephemeral facts the player produced this visit (never persisted). */
export interface ProtocolFlags {
  walked: boolean
  stationReached: boolean
  calibrated: boolean
  /** PIP presented the radar during the arrival briefing. */
  radarShown: boolean
  /** The arrival briefing (welcome + Radar/Scanner tutorial) is done. */
  briefed: boolean
}

export const INITIAL_PROTOCOL_FLAGS: ProtocolFlags = {
  walked: false,
  stationReached: false,
  calibrated: false,
  radarShown: false,
  briefed: false,
}

/** Distance the player must walk to finish the landing step. */
export const WALK_DISTANCE = 8
/** Distance to the station that counts as arriving. */
export const STATION_REACH_RADIUS = 3.6
/** How far from the survey trail before PIP asks to stay on it. */
export const CORRIDOR_HALF_WIDTH = 30

export { CALIBRATION_SAMPLE, CALIBRATION_STATION }
export type { CalibrationSample }

export function isCalibrationSampleId(id: string | null | undefined): boolean {
  return id === CALIBRATION_SAMPLE.id
}

export interface ProtocolContext {
  progress: MissionProgress | null
  flags: ProtocolFlags
  /**
   * True when the save already shows field work (older saves): the opening
   * steps are skipped because the player already knows the scanner.
   */
  priorFieldWork: boolean
}

/**
 * The child already knows the scanner: landscape readings, or another Mars
 * explorer already found (second landing from orbit skips the briefing and
 * the practice rock).
 */
export function hasPriorFieldWork(
  save: Pick<JourneySave, 'environmentalDiscoveries' | 'missions'> | null | undefined,
  missionId: MissionId,
): boolean {
  if (!save) return false
  if ((save.environmentalDiscoveries?.length ?? 0) > 0) return true
  return (['opportunity', 'spirit'] as const).some(
    (id) => id !== missionId && Boolean(save.missions[id]?.discovered),
  )
}

export function getProtocolStep(context: ProtocolContext): ProtocolStep {
  const stage: MissionStage = getMissionStage(context.progress)
  switch (stage) {
    case 'transmitted':
      return 'M7'
    case 'memory_recovered':
    case 'smart_letter_ready':
      return 'M6'
    // Legacy saves that stopped before the old full scan: the visit
    // recovers the memory right away (MissionNarrativeController).
    case 'ready_for_full_scan':
    case 'investigating':
    case 'discovered':
      return 'M4'
    default:
      break
  }
  if (context.progress?.discovered) return 'M4'
  if (context.priorFieldWork || context.flags.calibrated) return 'M3'
  if (context.flags.stationReached) return 'M2'
  if (context.flags.walked) return 'M1'
  return 'M0'
}

/**
 * The guided arrival briefing runs on a fresh landing (step M0) until the
 * child finishes it. Saves with field work or a found explorer skip it.
 */
export function needsArrivalBriefing(context: ProtocolContext): boolean {
  return !context.flags.briefed && getProtocolStep(context) === 'M0'
}

export function stepIndex(step: ProtocolStep): number {
  return PROTOCOL_STEPS.indexOf(step)
}

export function isStepAtLeast(step: ProtocolStep, minimum: ProtocolStep) {
  return stepIndex(step) >= stepIndex(minimum)
}

// ---------------------------------------------------------------- gating

/**
 * M0 shows no radar until PIP presents it in the arrival briefing; without
 * a briefing (older saves) it appears, animated, in M1.
 */
export function isRadarVisible(
  step: ProtocolStep,
  flags: Pick<ProtocolFlags, 'radarShown'> = { radarShown: false },
): boolean {
  return flags.radarShown || isStepAtLeast(step, 'M1')
}

/** The scanner unlocks at the practice rock. */
export function isScannerUnlocked(step: ProtocolStep): boolean {
  return isStepAtLeast(step, 'M2')
}

/** Landscape and memorial scans open up only in free exploration. */
export function areFreeScansAllowed(step: ProtocolStep): boolean {
  return step === 'M7'
}

/** The practice rock is only a target during the practice step. */
export function isCalibrationActive(step: ProtocolStep): boolean {
  return step === 'M2'
}

export type RadarTargetKind = 'station' | 'signal'

/** The radar points at the station first, then at the unnamed signal. */
export function getRadarTargetKind(step: ProtocolStep): RadarTargetKind {
  return stepIndex(step) <= stepIndex('M2') ? 'station' : 'signal'
}

export function getRadarTarget(
  step: ProtocolStep,
  signalPosition: WorldPosition,
): WorldPosition {
  return getRadarTargetKind(step) === 'station'
    ? CALIBRATION_STATION
    : signalPosition
}

// ------------------------------------------------------------- corridor

function distanceToSegment(
  p: WorldPosition,
  a: WorldPosition,
  b: WorldPosition,
): number {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lengthSq = abx * abx + abz * abz
  const t =
    lengthSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / lengthSq),
        )
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t))
}

export function distanceToTrail(
  position: WorldPosition,
  route: readonly WorldPosition[] = SURVEY_ROUTE,
): number {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < route.length - 1; i += 1) {
    best = Math.min(best, distanceToSegment(position, route[i]!, route[i + 1]!))
  }
  return best
}

/** Steps in which the soft corridor applies (never a hard wall). */
export function isCorridorActive(step: ProtocolStep): boolean {
  return step === 'M1' || step === 'M2' || step === 'M3'
}

export function isOutsideCorridor(
  step: ProtocolStep,
  position: WorldPosition,
): boolean {
  return (
    isCorridorActive(step) &&
    distanceToTrail(position) > CORRIDOR_HALF_WIDTH
  )
}

// --------------------------------------------------------------- derived

/** Distance walked from the landing point; M0 ends at WALK_DISTANCE. */
export function hasWalkedEnough(position: WorldPosition): boolean {
  return (
    Math.hypot(position.x - WORLD.spawn.x, position.z - WORLD.spawn.z) >=
    WALK_DISTANCE
  )
}

export function hasReachedStation(position: WorldPosition): boolean {
  return (
    Math.hypot(
      position.x - CALIBRATION_STATION.x,
      position.z - CALIBRATION_STATION.z,
    ) <= STATION_REACH_RADIUS
  )
}

// ------------------------------------------------------------ objectives

export type ProtocolHighlight =
  | 'controls'
  | 'radar'
  | 'scanner-key'
  | 'sample'
  | 'hold'
  | 'marker'
  | 'inspect'
  | 'trace'
  | null

export interface ObjectiveContext {
  step: ProtocolStep
  coarsePointer: boolean
  scannerEquipped: boolean
  aimingAtSample: boolean
  scannedCount: number
  nearSignal: boolean
  memoryRecovered: boolean
  /** The reticle rests on a recognizable part of the explorer. */
  aimingAtPart: boolean
  /** Next suggested marker (1 → 2 → 3), null when none is left. */
  nextMarker: number | null
  /** Short clue for the part to find now (parts hunt, M4). */
  huntClue?: string | null
}

export interface Objective {
  text: string
  highlight: ProtocolHighlight
}

export function getObjective(ctx: ObjectiveContext): Objective {
  switch (ctx.step) {
    case 'M0':
      return {
        text: ctx.coarsePointer
          ? 'Use the joystick to move · drag to look'
          : 'Move with WASD · look with the mouse',
        highlight: 'controls',
      }
    case 'M1':
      return { text: 'Follow the radar', highlight: 'radar' }
    case 'M2': {
      if (!ctx.scannerEquipped) {
        return {
          text: ctx.coarsePointer
            ? 'Tap the scanner button to equip it'
            : 'Press Q to equip the scanner',
          highlight: 'scanner-key',
        }
      }
      if (!ctx.aimingAtSample) {
        return {
          text: 'Aim at the glowing practice rock',
          highlight: 'sample',
        }
      }
      return {
        text: ctx.coarsePointer
          ? 'Hold the Scan button until the ring is full'
          : 'Hold the left mouse button until the ring is full',
        highlight: 'hold',
      }
    }
    case 'M3':
      return ctx.nearSignal
        ? {
            text: ctx.coarsePointer
              ? 'Tap Inspect to take a closer look'
              : 'Press E to take a closer look',
            highlight: 'inspect',
          }
        : { text: 'Follow the signal · get closer', highlight: 'radar' }
    case 'M4': {
      // Parts hunt: one clue at a time, one action at a time.
      if (!ctx.scannerEquipped) {
        return {
          text: ctx.coarsePointer
            ? 'Tap the scanner button to take it out'
            : 'Press Q to take out your scanner',
          highlight: 'scanner-key',
        }
      }
      // The clue stays put while aiming: the reticle itself says "hold".
      if (ctx.aimingAtPart) {
        return {
          text:
            ctx.huntClue ??
            `Recognize the explorer's parts (${ctx.scannedCount}/3)`,
          highlight: 'hold',
        }
      }
      return {
        text:
          ctx.huntClue ??
          `Recognize the explorer's parts (${ctx.scannedCount}/3)`,
        highlight: 'marker',
      }
    }
    case 'M6':
      return {
        text: ctx.memoryRecovered
          ? 'Seal the letter in your album'
          : 'Watch its story and send it to Earth',
        highlight: null,
      }
    case 'M7':
      return { text: 'Story sent! Explore, or walk back to the ship', highlight: null }
  }
}

// ------------------------------------------------------------ PIP lines

export interface ProtocolLine {
  id: string
  text: string
}

/** One line when a step begins. M0 reuses the existing landing line. */
export const STEP_ENTRY_LINES: Readonly<
  Partial<Record<ProtocolStep, ProtocolLine>>
> = {
  M1: {
    id: 'protocol:m1',
    text: 'Follow the orange star on your radar. It leads to our practice rock!',
  },
  M2: {
    id: 'protocol:m2',
    text: "Look, a glowing practice rock! Let's try your scanner on it.",
  },
  M3: {
    id: 'protocol:m3',
    text: "Scan complete, you did it! Now let's follow the star to the signal.",
  },
}

export const SCANNER_LOCKED_LINE: ProtocolLine = {
  id: 'protocol:scanner-locked',
  text: "Let's walk to the practice rock first. Follow the star!",
}

export const STATION_STAY_LINE: ProtocolLine = {
  id: 'protocol:station-stay',
  text: "Not yet, explorer! Let's find all three parts first, I'll help you!",
}

export const OFF_TRAIL_LINE: ProtocolLine = {
  id: 'protocol:off-trail',
  text: 'Let us stay on the signal trail.',
}

export const PRACTICE_STAY_LINE: ProtocolLine = {
  id: 'protocol:practice-stay',
  text: 'Almost there! Hold the scan on the practice rock, you can do it!',
}

export const PRESS_Q_LINE: ProtocolLine = {
  id: 'protocol:press-q',
  text: "We're here! Press Q to take out your scanner.",
}

export const TAP_SCANNER_LINE: ProtocolLine = {
  id: 'protocol:tap-scanner',
  text: "We're here! Tap the scanner button to take it out.",
}

export const LATER_LINE: ProtocolLine = {
  id: 'protocol:later',
  text: 'Later, pilot. The signal first.',
}

export const CALIBRATE_FIRST_LINE: ProtocolLine = {
  id: 'protocol:calibrate-first',
  text: "Let's practice with the scanner first, then we'll take a closer look.",
}

/** Inspecting the unknown signal opens once the scanner is calibrated. */
export function canInspectSignal(step: ProtocolStep): boolean {
  return isStepAtLeast(step, 'M3')
}

export const INSPECT_FIRST_LINE: ProtocolLine = {
  id: 'protocol:inspect-first',
  text: 'Inspect it first (E).',
}

/** "Ask PIP" hint per opening step. Never names the explorer. */
export function getProtocolHint(
  step: ProtocolStep,
  coarsePointer: boolean,
): string | null {
  switch (step) {
    case 'M0':
      return coarsePointer
        ? 'Drag the joystick to walk and drag the screen to look around.'
        : 'Walk with WASD and move the mouse to look around.'
    case 'M1':
      return 'Turn until the orange star is at the top of the radar, then walk.'
    case 'M2':
      return coarsePointer
        ? 'Tap the scanner button, aim at the glowing rock and hold Scan.'
        : 'Press Q, aim at the glowing rock and hold the left mouse button.'
    case 'M3':
      return 'The signal is near. Walk up to the shape and press E.'
    default:
      return null
  }
}

/** Every string a player can see before the explorer is identified. */
export function getPreDiscoveryTexts(): string[] {
  const texts: string[] = []
  for (const line of Object.values(STEP_ENTRY_LINES)) {
    if (line) texts.push(line.text)
  }
  texts.push(...getBriefingTexts())
  texts.push(
    SCANNER_LOCKED_LINE.text,
    OFF_TRAIL_LINE.text,
    LATER_LINE.text,
    INSPECT_FIRST_LINE.text,
    CALIBRATE_FIRST_LINE.text,
  )
  for (const step of ['M0', 'M1', 'M2', 'M3'] as const) {
    for (const coarse of [false, true]) {
      const hint = getProtocolHint(step, coarse)
      if (hint) texts.push(hint)
      for (const equipped of [false, true]) {
        for (const aiming of [false, true]) {
          for (const nearSignal of [false, true]) {
            texts.push(
              getObjective({
                step,
                coarsePointer: coarse,
                scannerEquipped: equipped,
                aimingAtSample: aiming,
                scannedCount: 0,
                nearSignal,
                memoryRecovered: false,
                aimingAtPart: false,
                nextMarker: 1,
              }).text,
            )
          }
        }
      }
    }
  }
  return texts
}
