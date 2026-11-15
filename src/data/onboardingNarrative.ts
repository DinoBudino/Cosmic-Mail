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
  | 'excited'
  | 'curious'
  | 'surprised'
  | 'confused'
  | 'worried'
  | 'sad'
  | 'thoughtful'

/**
 * One Archive projection per idea in PIP's line: what Cosmic Mail does,
 * the connected Archive, the failure as it happens, PIP's own missing
 * memories, the old locations and the many quiet signals.
 */
export type IntroHologramState =
  | 'none'
  | 'mail'
  | 'stable'
  | 'losing1'
  | 'losing3'
  | 'fragmented'
  | 'recovering'
  | 'offline'
  | 'memory'
  | 'forgotten'
  | 'locations'
  | 'route'
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
}

export const INTRO_BEATS: readonly IntroBeat[] = [
  // A — Normality
  {
    moment: 'arrival',
    line: "Hi there! I'm PIP, and this is Mailwing, our mail ship.",
    emotion: 'welcome',
    hologram: 'none',
    camera: 'welcome',
  },
  {
    moment: 'archive',
    line: 'We work for Cosmic Mail. We carry the stories of space explorers all the way home to Earth.',
    emotion: 'happy',
    hologram: 'mail',
    camera: 'archive',
  },
  {
    moment: 'archive',
    line: "Every explorer has a file in the Cosmic Archive. Look how they're all connected.",
    emotion: 'curious',
    hologram: 'stable',
    camera: 'archive',
  },

  // B — Interruption
  {
    moment: 'archive',
    line: 'Oh! That file just lost its connection.',
    emotion: 'surprised',
    hologram: 'losing1',
    camera: 'archive',
  },
  {
    moment: 'archive',
    line: "And another one, and another. They're all going dark!",
    emotion: 'surprised',
    hologram: 'losing3',
    camera: 'archive',
  },

  // C — Confusion and consequence
  {
    moment: 'fault',
    line: "Hmm, that's strange. Let me take a closer look.",
    emotion: 'worried',
    hologram: 'fragmented',
    camera: 'pip',
  },
  {
    moment: 'fault',
    line: "The Archive is trying to fix them, but the pieces don't fit together.",
    emotion: 'worried',
    hologram: 'recovering',
    camera: 'pip',
  },
  {
    moment: 'fault',
    line: 'Oh no. Now none of the files can connect.',
    emotion: 'worried',
    hologram: 'offline',
    camera: 'pip',
  },
  {
    moment: 'fault',
    line: 'And some of my own memories are missing too.',
    emotion: 'sad',
    hologram: 'memory',
    camera: 'pip',
  },
  {
    moment: 'fault',
    line: "I know these explorers, but I can't remember what they discovered.",
    emotion: 'thoughtful',
    hologram: 'forgotten',
    camera: 'pip',
  },

  // D — Hope
  {
    moment: 'hope',
    line: 'Wait, I still remember two places where their signals came from!',
    emotion: 'excited',
    hologram: 'locations',
    camera: 'archive',
  },
  {
    moment: 'hope',
    line: 'If we fly there, we can find the explorers and fix their stories.',
    emotion: 'happy',
    hologram: 'route',
    camera: 'archive',
  },

  // E — Invitation
  {
    moment: 'invitation',
    line: 'Lots of files are waiting, and their signals have gone quiet.',
    emotion: 'curious',
    hologram: 'dossier',
    camera: 'invitation',
  },
  {
    moment: 'invitation',
    line: 'So, will you help me bring their stories home?',
    emotion: 'welcome',
    hologram: 'letter',
    camera: 'invitation',
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

export const REGISTRATION_LINE =
  "Let's make your Carrier ID! Type your name on the screen."

export function registrationWelcomeLine(playerName: string): string {
  return `You're officially part of Cosmic Mail, ${playerName}!`
}

/**
 * Static so the recorded onboarding voice can speak it. The carrier's
 * name remains visible in the registration farewell and the album.
 */
export const HUB_ASSIGNMENT_LINE =
  "Your Carrier ID is saved in your mission album. Come on, I'll show you the cabin."

/**
 * Element PIP points at during the hub dialogue: the 3D cabin objects,
 * the sections of the open album and the parts of the navigation screen.
 */
export type HubTarget =
  | 'album'
  | 'nav'
  | 'button'
  | 'album-id'
  | 'tab-missions'
  | 'tab-stamps'
  | 'tab-discoveries'
  | 'album-close'
  | 'nav-cards'
  | 'nav-confirm'

/** What the child has to do before a guided step moves on. */
export type HubAwait =
  | 'album'
  | 'tab-stamps'
  | 'tab-discoveries'
  | 'album-close'
  | 'nav'
  | 'destination'
  | 'confirm'

/** Where the line is shown: the cabin, the open album or the nav close-up. */
export type HubPlace = 'cabin' | 'album' | 'nav'

export interface HubDialogueStep {
  line: string
  /** Element highlighted while PIP says the line. */
  target: HubTarget | null
  /**
   * Guided step: the bubble does not advance on click. The child has to
   * do this action; doing it moves the tour to the next line.
   */
  awaits: HubAwait | null
  place: HubPlace
}

/**
 * First-visit guided tour. PIP stays with the child inside the album and
 * the navigation screen and explains each part as it lights up. It never
 * names a destination: the navigation screen holds every signal.
 */
export const HUB_TOUR_STEPS: readonly HubDialogueStep[] = [
  { line: HUB_ASSIGNMENT_LINE, target: null, awaits: null, place: 'cabin' },
  {
    line: 'That book on the console is your mission album. Tap it to open it.',
    target: 'album',
    awaits: 'album',
    place: 'cabin',
  },
  // Inside the album
  {
    line: "This first page is your Carrier ID. It shows your name and how many stories we've restored.",
    target: 'album-id',
    awaits: null,
    place: 'album',
  },
  {
    line: 'The Record page shows every explorer story and what we need to do next.',
    target: 'tab-missions',
    awaits: null,
    place: 'album',
  },
  {
    line: 'Now tap Stamps.',
    target: 'tab-stamps',
    awaits: 'tab-stamps',
    place: 'album',
  },
  {
    line: 'Every story we deliver to Earth earns a stamp here.',
    target: 'tab-stamps',
    awaits: null,
    place: 'album',
  },
  {
    line: 'Now tap Discoveries.',
    target: 'tab-discoveries',
    awaits: 'tab-discoveries',
    place: 'album',
  },
  {
    line: 'Discoveries keeps the facts you find while exploring.',
    target: 'tab-discoveries',
    awaits: null,
    place: 'album',
  },
  {
    line: 'You can open your album any time. Tap Back to cabin to close it.',
    target: 'album-close',
    awaits: 'album-close',
    place: 'album',
  },
  // Back in the cabin
  {
    line: 'Now tap the navigation screen. It shows where the signals are coming from.',
    target: 'nav',
    awaits: 'nav',
    place: 'cabin',
  },
  // Inside the navigation screen: every step waits for a tap, PIP never
  // asks the child to click his bubble here.
  {
    line: 'These are the places we can fly to. Tap one with a signal.',
    target: 'nav-cards',
    awaits: 'destination',
    place: 'nav',
  },
  {
    line: 'Great choice! Now tap Confirm route to set our course.',
    target: 'nav-confirm',
    awaits: 'confirm',
    place: 'nav',
  },
]

export const HUB_TOUR_LINES: readonly string[] = HUB_TOUR_STEPS.slice(1).map(
  (step) => step.line,
)

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
  'Welcome back, carrier! The Archive is waiting for our next delivery.'

export const ROUTE_READY_LINE =
  'Route ready! Now press the big red button to take off.'

export interface HubDialogueOptions {
  routeConfirmed: boolean
  hubVisited: boolean
  hubTourDone: boolean
  /** Delivered stories so far; closes the slice once there is at least one. */
  restoredCount?: number
  totalStories?: number
}

function plainStep(line: string): HubDialogueStep {
  return { line, target: null, awaits: null, place: 'cabin' }
}

/**
 * First visit: assignment + guided tour. Finishing the tour must leave
 * the cabin quiet, never greet the player as if they had already left and
 * returned. Only a real re-entry (Continue or return from a mission) uses
 * the "welcome back" line.
 */
export function hubDialogueSteps(options: HubDialogueOptions): HubDialogueStep[] {
  if (options.routeConfirmed) {
    return [{ line: ROUTE_READY_LINE, target: 'button', awaits: null, place: 'cabin' }]
  }
  const restored = options.restoredCount ?? 0
  const total = options.totalStories ?? 2
  if (options.hubVisited && restored > 0 && restored < total) {
    return [plainStep(restoredLine(restored, total)), plainStep(NEW_SIGNAL_LINE)]
  }
  if (options.hubVisited) return [plainStep(HUB_RETURNING_LINE)]
  if (options.hubTourDone) return []
  return [...HUB_TOUR_STEPS]
}

export function hubDialogueLines(options: HubDialogueOptions): string[] {
  return hubDialogueSteps(options).map((step) => step.line)
}

/** True while the first-visit tour runs: only the highlighted element answers. */
export function isHubTourActive(options: HubDialogueOptions): boolean {
  return !options.routeConfirmed && !options.hubVisited && !options.hubTourDone
}

export const LAUNCH_CABIN_LINE =
  "Here we go. Let's bring this memory home."

/** Canonical success state after a mission transmission. */
export const TRANSMISSION_SUCCESS_LINE =
  'ENTREGA COMPLETADA — HISTORIA RESTAURADA'

export const TRANSMISSION_DESTINATION = 'Earth Cosmic Archive'

export const ARCHIVE_LABELS: Record<IntroMoment, string> = {
  arrival: 'PIP welcomes the carrier in the Mailwing cabin.',
  archive:
    'The Cosmic Archive window shows many anonymous files with stable connections.',
  fault:
    'The connections break one by one; the files fragment and the recovery attempt fails.',
  hope: 'Two old locations appear on a star map and a route reaches toward them.',
  invitation:
    'A smart letter begins to form while PIP asks the carrier for help.',
}
