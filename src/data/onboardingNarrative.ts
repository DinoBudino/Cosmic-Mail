/**
 * Narrative content and cinematic beat sheet for the Cosmic Mail
 * onboarding under Proposal A.
 *
 * Arc: normality → interruption → confusion → concern → a clue → hope →
 * invitation. The player SEES the Archive fail before PIP explains it.
 * No machine names, no equipment photos and no scientific identities are
 * revealed before the corresponding mission.
 */

export type IntroMoment =
  | 'arrival'
  | 'archive'
  | 'fault'
  | 'hope'
  | 'invitation'

export type IntroEmotion =
  | 'welcome'
  | 'happy'
  | 'curious'
  | 'surprised'
  | 'confused'
  | 'worried'
  | 'sad'
  | 'thoughtful'

export type IntroHologramState =
  | 'none'
  | 'stable'
  | 'losing1'
  | 'losing2'
  | 'losing3'
  | 'fragmented'
  | 'recovering'
  | 'hint'
  | 'dossier'
  | 'letter'

export type IntroCameraShot = 'welcome' | 'archive' | 'pip' | 'invitation'

export interface IntroBeat {
  moment: IntroMoment
  line: string
  /** PIP's facial expression for this beat. */
  emotion: IntroEmotion
  /** Archive window projection for this beat. */
  hologram: IntroHologramState
  /** Framing that supports the dialogue. */
  camera: IntroCameraShot
  /**
   * Short reaction lines advance on their own after the line is read, so
   * the sequence feels like a scene instead of a slideshow. The Continue
   * control is always available and the final invitation always waits for
   * the player.
   */
  autoAdvance: boolean
  /** Extra reading time after the estimated speech duration. */
  holdMs?: number
}

export const INTRO_BEATS: readonly IntroBeat[] = [
  // A — Normality
  {
    moment: 'arrival',
    line: "Hi, I'm PIP! Welcome aboard Mailwing!",
    emotion: 'welcome',
    hologram: 'none',
    camera: 'welcome',
    autoAdvance: true,
    holdMs: 700,
  },
  {
    moment: 'archive',
    line: 'We’re part of Cosmic Mail. We carry important stories across the stars!',
    emotion: 'happy',
    hologram: 'stable',
    camera: 'archive',
    autoAdvance: true,
  },
  {
    moment: 'archive',
    line: 'Every explorer has a file in the Cosmic Archive. See how their records connect?',
    emotion: 'curious',
    hologram: 'stable',
    camera: 'archive',
    autoAdvance: true,
  },

  // B — Interruption
  {
    moment: 'archive',
    line: 'Wait... one of the records just lost its connection.',
    emotion: 'surprised',
    hologram: 'losing1',
    camera: 'archive',
    autoAdvance: true,
    holdMs: 450,
  },
  {
    moment: 'archive',
    line: 'Another one... and now the third!',
    emotion: 'surprised',
    hologram: 'losing3',
    camera: 'archive',
    autoAdvance: true,
    holdMs: 450,
  },

  // C — Confusion and consequence
  {
    moment: 'fault',
    line: 'Huh? That’s strange...',
    emotion: 'confused',
    hologram: 'fragmented',
    camera: 'pip',
    autoAdvance: true,
    holdMs: 500,
  },
  {
    moment: 'fault',
    line: 'The archive is trying to reconnect them, but the pieces don’t match.',
    emotion: 'worried',
    hologram: 'recovering',
    camera: 'pip',
    autoAdvance: true,
  },
  {
    moment: 'fault',
    line: 'Wait... these records aren’t connecting anymore!',
    emotion: 'worried',
    hologram: 'fragmented',
    camera: 'pip',
    autoAdvance: true,
  },
  {
    moment: 'fault',
    line: 'I know these explorers... but some of my own records are missing.',
    emotion: 'sad',
    hologram: 'fragmented',
    camera: 'pip',
    autoAdvance: true,
  },
  {
    moment: 'fault',
    line: 'I can’t remember everything they discovered.',
    emotion: 'thoughtful',
    hologram: 'fragmented',
    camera: 'pip',
    autoAdvance: true,
    holdMs: 800,
  },

  // D — Hope
  {
    moment: 'hope',
    line: 'But wait! I still have some old locations!',
    emotion: 'surprised',
    hologram: 'hint',
    camera: 'archive',
    autoAdvance: true,
    holdMs: 550,
  },
  {
    moment: 'hope',
    line: 'Maybe we can find them and put their stories back together!',
    emotion: 'happy',
    hologram: 'dossier',
    camera: 'archive',
    autoAdvance: true,
  },

  // E — Invitation
  {
    moment: 'invitation',
    line: 'Three incomplete files. Three silent signals.',
    emotion: 'curious',
    hologram: 'dossier',
    camera: 'invitation',
    autoAdvance: true,
  },
  {
    moment: 'invitation',
    line: 'Will you help me bring their stories back?',
    emotion: 'happy',
    hologram: 'letter',
    camera: 'invitation',
    autoAdvance: false,
  },
]

function clampBeatIndex(index: number): number {
  return Math.max(0, Math.min(index, INTRO_BEATS.length - 1))
}

export function introBeatForLine(index: number): IntroBeat {
  return INTRO_BEATS[clampBeatIndex(index)]!
}

export function introMomentForLine(index: number): IntroMoment {
  return introBeatForLine(index).moment
}

export function introEmotionForLine(index: number): IntroEmotion {
  return introBeatForLine(index).emotion
}

export function introHologramForLine(index: number): IntroHologramState {
  return introBeatForLine(index).hologram
}

export function introCameraForLine(
  index: number,
  reducedMotion = false,
): IntroCameraShot {
  if (reducedMotion) return 'welcome'
  return introBeatForLine(index).camera
}

/** Rough speech length so auto-advance never cuts a line short. */
export function estimatePipLineMs(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length
  return Math.max(2400, 900 + words * 390)
}

/**
 * Auto-advance delay for a beat, or null when the beat must wait for the
 * player. The Continue action remains available for every beat.
 */
export function introAutoAdvanceMs(index: number): number | null {
  const beat = introBeatForLine(index)
  if (!beat.autoAdvance) return null
  return estimatePipLineMs(beat.line) + (beat.holdMs ?? 600)
}

/** Reduced motion uses user-paced reading: no automatic cuts. */
export function introAutoAdvanceForMode(
  index: number,
  reducedMotion: boolean,
): number | null {
  return reducedMotion ? null : introAutoAdvanceMs(index)
}

export const REGISTRATION_LINE =
  "Then let's make it official! Every Cosmic Mail Carrier needs a name."

export function registrationWelcomeLine(playerName: string): string {
  return `You're officially part of Cosmic Mail, ${playerName}!`
}

/**
 * Static so the recorded onboarding voice can speak it. The carrier's
 * name remains visible in the registration farewell and the passport.
 */
export const HUB_ASSIGNMENT_LINE =
  'Your passport is ready. Let me show you around the cabin.'

export const HUB_TOUR_LINES: readonly string[] = [
  'This is your Cosmic Passport. It keeps every history we bring back to Earth.',
  'The navigation screen shows approximate signals. Mars is the closest one.',
  'Pick the signal, confirm the route, then press the red button.',
  "When you find the explorer, use the scanner. I'll help you recognize its parts.",
]

export function storiesRestoredLabel(restored: number, total: number): string {
  return `${restored} of ${total} ${total === 1 ? 'story' : 'stories'} restored`
}

export function restoredLine(restored: number, total: number): string {
  return `${storiesRestoredLabel(restored, total)}. Great work, carrier!`
}

/** PIP's note about another signal. No machine, planet or order is named. */
export const NEW_SIGNAL_LINE =
  "I'm picking up another faint signal. It's still too weak to follow, but the Archive has marked it for later."

export const HUB_RETURNING_LINE =
  'Welcome back, carrier. The archive is waiting for your next delivery.'

/**
 * First visit: assignment + tour. Finishing the tour must leave the cabin
 * quiet, never greet the player as if they had already left and returned.
 * Only a real re-entry (Continue or return from a mission) uses the
 * "welcome back" line.
 */
export function hubDialogueLines(options: {
  routeConfirmed: boolean
  hubVisited: boolean
  hubTourDone: boolean
  /** Delivered stories so far; closes the slice once there is at least one. */
  restoredCount?: number
  totalStories?: number
}): string[] {
  if (options.routeConfirmed) return [ROUTE_READY_LINE]
  const restored = options.restoredCount ?? 0
  const total = options.totalStories ?? 3
  if (options.hubVisited && restored > 0 && restored < total) {
    return [restoredLine(restored, total), NEW_SIGNAL_LINE]
  }
  if (options.hubVisited) return [HUB_RETURNING_LINE]
  if (options.hubTourDone) return []
  return [HUB_ASSIGNMENT_LINE, ...HUB_TOUR_LINES]
}

export const ROUTE_READY_LINE =
  "Route ready! Press the red button when you're set!"

export const LAUNCH_CABIN_LINE =
  "Here we go. Let's bring this memory home."

/** Canonical success state after a mission transmission. */
export const TRANSMISSION_SUCCESS_LINE =
  'ENTREGA COMPLETADA — HISTORIA RESTAURADA'

export const TRANSMISSION_DESTINATION = 'Earth Cosmic Archive'

export const ARCHIVE_LABELS: Record<IntroMoment, string> = {
  arrival: 'PIP welcomes the carrier in the Mailwing cabin.',
  archive:
    'The Cosmic Archive window shows three anonymous files with stable connections.',
  fault:
    'The three connections break; the files fragment and the recovery attempt fails.',
  hope: 'One file glows again with an approximate location clue.',
  invitation:
    'A smart letter begins to form while PIP asks the carrier for help.',
}
