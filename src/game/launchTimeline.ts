/**
 * Launch-sequence timeline (pure, testable).
 *
 * The cinematic is a fixed set of stages over ~24s (or ~8s with
 * reduced motion). Both the 3D scene (the menu scene in launching
 * mode: ship, Earth behind, destination ahead) and the DOM overlay
 * (countdown, fact card) read the same stage + progress, so the two
 * can never drift apart. Modular: a future destination only changes
 * the planet shown at the end, not the timeline.
 */

export type LaunchStageId =
  | 'ignition'
  | 'countdown'
  | 'liftoff'
  | 'ascent'
  | 'space'
  | 'accelerate'
  | 'arrive'

export interface LaunchSegment {
  id: LaunchStageId
  start: number
  end: number
}

export interface LaunchTimeline {
  duration: number
  segments: LaunchSegment[]
}

function buildTimeline(reducedMotion: boolean): LaunchTimeline {
  // [stage, duration] pairs. Full version totals ~24s; reduced
  // motion keeps every beat, just much shorter.
  const beats: readonly (readonly [LaunchStageId, number])[] = reducedMotion
    ? [
        ['ignition', 0.8],
        ['countdown', 1.2],
        ['liftoff', 0.6],
        ['ascent', 2.0],
        ['space', 1.5],
        ['accelerate', 1.2],
        ['arrive', 2.0],
      ]
    : [
        // The countdown happens INSIDE the cabin (seated, PIP
        // talking); the exterior cruise starts at liftoff. Arrive is
        // long on purpose: a slow, immersive vertical descent.
        ['ignition', 1.8],
        ['countdown', 3.0],
        ['liftoff', 1.2],
        ['ascent', 5.5],
        ['space', 4.0],
        ['accelerate', 3.5],
        ['arrive', 5.0],
      ]
  let cursor = 0
  const segments = beats.map(([id, length]) => {
    const segment = { id, start: cursor, end: cursor + length }
    cursor += length
    return segment
  })
  return { duration: cursor, segments }
}

export function launchTimeline(reducedMotion: boolean): LaunchTimeline {
  return buildTimeline(reducedMotion)
}

export interface LaunchStageState {
  stage: LaunchStageId
  /** 0..1 progress within the current stage. */
  progress: number
  /** 0..1 progress over the whole sequence. */
  overall: number
}

export function stageAt(elapsed: number, reducedMotion: boolean): LaunchStageState {
  const timeline = buildTimeline(reducedMotion)
  const clamped = Math.min(Math.max(elapsed, 0), timeline.duration)
  const segment =
    timeline.segments.find((entry) => clamped < entry.end) ??
    timeline.segments[timeline.segments.length - 1]!
  const length = segment.end - segment.start
  return {
    stage: segment.id,
    progress: length > 0 ? Math.min(1, Math.max(0, (clamped - segment.start) / length)) : 1,
    overall: timeline.duration > 0 ? clamped / timeline.duration : 1,
  }
}

/** Countdown label during the countdown stage, "Lift off!" at liftoff. */
export function countdownLabel(elapsed: number, reducedMotion: boolean): string | null {
  const { stage, progress } = stageAt(elapsed, reducedMotion)
  if (stage === 'countdown') {
    const remaining = 3 - Math.floor(progress * 3)
    return String(Math.max(1, Math.min(3, remaining)))
  }
  if (stage === 'liftoff') return 'Lift off!'
  return null
}

/**
 * Shared launch clock (seconds). The DOM overlay (`LaunchSequence`)
 * writes it every frame; the 3D scene (`MenuScene` in launching mode)
 * reads it — one clock, so overlay and scene can never drift apart.
 * Reset to 0 whenever the launch phase mounts.
 */
export const launchClock = { value: 0 }

/**
 * Cruise distance along the straight-line travel path (world units).
 * Space travel is LINEAR: constant direction, distance grows at a
 * steady rate per stage (faster in the final accelerate stage, but
 * still linear — never a quadratic dash). The arrive stage adds no
 * cruise distance; it descends instead (see descentProgress).
 */
const CRUISE_BY_STAGE: Record<LaunchStageId, readonly [number, number]> = {
  ignition: [0, 0],
  countdown: [0, 0],
  liftoff: [0, 0.4],
  ascent: [0.4, 3.0],
  space: [3.0, 5.2],
  accelerate: [5.2, 9.0],
  arrive: [9.0, 9.0],
}

export function cruiseDistance(elapsed: number, reducedMotion: boolean): number {
  const { stage, progress } = stageAt(elapsed, reducedMotion)
  const [from, to] = CRUISE_BY_STAGE[stage]
  return from + (to - from) * progress
}

/** 0 until the accelerate stage, then 0..1 across accelerate + arrive. */
export function marsApproach(elapsed: number, reducedMotion: boolean): number {
  const { stage, progress } = stageAt(elapsed, reducedMotion)
  if (stage === 'accelerate') return progress * 0.65
  if (stage === 'arrive') return 0.65 + progress * 0.35
  return 0
}

/** 0..1 during the arrive stage: the ship turns upright and descends. */
export function descentProgress(elapsed: number, reducedMotion: boolean): number {
  const { stage, progress } = stageAt(elapsed, reducedMotion)
  return stage === 'arrive' ? progress : 0
}

/** True while the launch is still inside the cabin (ignition + countdown). */
export function inCabinStage(elapsed: number, reducedMotion: boolean): boolean {
  const { stage } = stageAt(elapsed, reducedMotion)
  return stage === 'ignition' || stage === 'countdown'
}

export type ShipPose = 'fly' | 'land'

/**
 * Ship attitude per stage: `fly` = nose toward the destination (the
 * explorer's name floats above the ship as a tag, so the hull never
 * needs to turn mid-flight), `land` = upright (nose up, window to
 * camera) for the vertical descent.
 */
export function shipPoseAt(elapsed: number, reducedMotion: boolean): ShipPose {
  const { stage } = stageAt(elapsed, reducedMotion)
  return stage === 'arrive' ? 'land' : 'fly'
}

/**
 * Camera-shake intensity (0..1) for the exterior cruise: it ramps up
 * with speed (escape velocity!) and decays during the arrive
 * descent as the ship slows down toward the planet.
 */
export function speedShake(elapsed: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0
  const { stage, progress } = stageAt(elapsed, reducedMotion)
  switch (stage) {
    case 'ignition':
    case 'countdown':
      return 0
    case 'liftoff':
      return progress * 0.3
    case 'ascent':
      return 0.3 + progress * 0.4
    case 'space':
      return 0.7
    case 'accelerate':
      return 0.7 + progress * 0.3
    case 'arrive':
      return Math.max(0, (1 - progress) * 0.35)
    default:
      return 0
  }
}

export const ESCAPE_VELOCITY_FACT = 'Escape velocity: ~40,000 km/h'

export function showEscapeVelocityFact(elapsed: number, reducedMotion: boolean): boolean {
  const { stage } = stageAt(elapsed, reducedMotion)
  return stage === 'space' || stage === 'accelerate'
}
