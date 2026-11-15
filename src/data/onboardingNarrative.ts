/**
 * Narrative content and cinematic beat sheet for the Cosmic Mail
 * onboarding under Proposal A.
 *
 * Arc: normality → interruption → a solar-storm diagnosis → consequence
 * → PIP's own missing memories → a clue → hope → invitation. "Show
 * first, explain after": the player SEES the Archive fail, then the
 * cabin detects the storm, and only then PIP explains it.
 *
 * Science vs. fiction: the solar flare, the coronal mass ejection, the
 * plasma cloud and their effect on radio links and electronics are real
 * space-weather ideas. The Cosmic Archive, its memory sync and PIP's
 * memory banks are the game's fiction — the intro never claims that a
 * solar storm erases files in the real world.
 *
 * No machine names, no equipment photos and no scientific identities are
 * revealed before the corresponding mission.
 */

import type { AudioEvent } from '../game/audio/audioEvents'

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
  | 'focused'
  | 'explaining'
  | 'sad'
  | 'thoughtful'
  | 'hopeful'

/**
 * One Archive projection per idea in PIP's line, shown inside the round
 * Cosmic Memory Window. The solar states show a sped-up replay of data
 * from Mailwing's space-weather monitor, never an explosion outside.
 */
export type IntroHologramState =
  | 'none'
  | 'mail'
  | 'stable'
  | 'losing1'
  | 'losing3'
  | 'solarAlert'
  | 'solarStorm'
  | 'stormImpact'
  | 'syncError'
  | 'fragmented'
  | 'recovering'
  | 'offline'
  | 'memory'
  | 'forgotten'
  | 'locations'
  | 'route'
  | 'dossier'
  | 'letter'

/**
 * `storm` is the only sub-variation of the four base framings: it leans
 * slightly toward the window so the solar projection is readable while
 * PIP stays in frame.
 */
export type IntroCameraShot = 'welcome' | 'archive' | 'storm' | 'pip' | 'invitation'

/** Cabin light mood: emergency orange grows and fades with the story. */
export type IntroAmbience = 'calm' | 'warning' | 'storm' | 'soft' | 'hope'

/** Small hologram PIP projects beside himself (diagnostic / memory check). */
export type IntroPipPanel = 'diagnostic' | 'memoryCheck'

/** Fine-grained step of the Solar Storm scene (the 3.x phases). */
export type IntroSubphase =
  | 'welcome'
  | 'cosmic-mail'
  | 'archive'
  | 'first-anomaly'
  | 'fault-spreads'
  | 'solar-alert'
  | 'storm-reveal'
  | 'archive-damage'
  | 'failed-recovery'
  | 'pip-affected'
  | 'last-signals'
  | 'invitation'

/**
 * One frame of an animated projection: `variant` selects a step of the
 * state's own animation (0 is the settled frame), `at` is when it shows,
 * in ms after the line starts. Replay restarts the whole timeline.
 */
export interface IntroHologramFrame {
  state: IntroHologramState
  variant: number
  at: number
}

export interface IntroBeat {
  /** Stable id (also the voice recording key). */
  id: string
  moment: IntroMoment
  subphase: IntroSubphase
  line: string
  /** PIP's facial expression for this beat. */
  emotion: IntroEmotion
  /** Settled Archive window projection for this beat. */
  hologram: IntroHologramState
  /**
   * Optional animation leading to the settled projection. Reduced motion
   * skips it and cuts straight to the settled frame, which always holds
   * the complete information on its own.
   */
  timeline?: readonly IntroHologramFrame[]
  /** Framing that supports the dialogue. */
  camera: IntroCameraShot
  ambience: IntroAmbience
  /** Sound played with the line (and again on Replay). */
  sound?: AudioEvent
  /** Hologram PIP projects beside himself during this line. */
  pipPanel?: IntroPipPanel
  /** Brief interference on one of PIP's eyes (never a lasting change). */
  pipGlitch?: boolean
}

function frames(
  state: IntroHologramState,
  ...steps: ReadonlyArray<readonly [variant: number, at: number]>
): IntroHologramFrame[] {
  return steps.map(([variant, at]) => ({ state, variant, at }))
}

export const INTRO_BEATS: readonly IntroBeat[] = [
  // ── Scene 1 · Welcome to Mailwing ────────────────────────────────
  {
    id: 'intro-01',
    moment: 'arrival',
    subphase: 'welcome',
    line: "Hi there! I'm PIP, and this is Mailwing, our mail ship.",
    emotion: 'welcome',
    hologram: 'none',
    camera: 'welcome',
    ambience: 'calm',
  },

  // ── Scene 2 · The Cosmic Archive ─────────────────────────────────
  {
    id: 'intro-02',
    moment: 'archive',
    subphase: 'cosmic-mail',
    line: 'We work for Cosmic Mail. We carry the stories of space explorers all the way home to Earth.',
    emotion: 'happy',
    hologram: 'mail',
    camera: 'archive',
    ambience: 'calm',
    sound: 'pipHologram',
  },
  {
    id: 'intro-03',
    moment: 'archive',
    subphase: 'archive',
    line: 'Every explorer has a file in the Cosmic Archive.',
    emotion: 'happy',
    hologram: 'stable',
    // The letter unfolds into files, then the network lights up.
    timeline: frames('stable', [2, 0], [1, 900], [0, 1800]),
    camera: 'archive',
    ambience: 'calm',
    sound: 'archiveActivated',
  },
  {
    id: 'intro-04',
    moment: 'archive',
    subphase: 'archive',
    line: "Look how they're all connected!",
    emotion: 'curious',
    hologram: 'stable',
    // Near the end, one link blinks once. PIP does not notice yet.
    timeline: frames('stable', [3, 0], [4, 2300], [3, 2450]),
    camera: 'archive',
    ambience: 'calm',
  },

  // ── Scene 3 · The Solar Storm ────────────────────────────────────
  // 3.1 The first anomaly (the fault music cue starts here).
  {
    id: 'intro-05',
    moment: 'fault',
    subphase: 'first-anomaly',
    line: 'Oh! That file just lost its connection.',
    emotion: 'surprised',
    hologram: 'losing1',
    // Connected → flickering → dim link → cut, with a yellow flash.
    timeline: frames('losing1', [3, 0], [2, 500], [1, 1000], [0, 1500]),
    camera: 'archive',
    ambience: 'calm',
  },
  // 3.2 The fault spreads.
  {
    id: 'intro-06',
    moment: 'fault',
    subphase: 'fault-spreads',
    line: "And another one, and another... They're all going dark!",
    emotion: 'worried',
    hologram: 'losing3',
    timeline: frames('losing3', [2, 0], [1, 1100], [0, 2200]),
    camera: 'archive',
    ambience: 'warning',
    sound: 'archiveConnectionLost',
  },
  // 3.3 Solar activity alert (new): diagnostic first, then the warning.
  {
    id: 'intro-07',
    moment: 'fault',
    subphase: 'solar-alert',
    line: 'Wait... Mailwing just detected something unusual!',
    emotion: 'focused',
    hologram: 'solarAlert',
    timeline: frames('solarAlert', [2, 0], [1, 1300], [0, 2300]),
    camera: 'storm',
    ambience: 'storm',
    sound: 'solarAlert',
    pipPanel: 'diagnostic',
  },
  // 3.4 The storm is revealed inside the projection.
  {
    id: 'intro-08',
    moment: 'fault',
    subphase: 'storm-reveal',
    line: 'Oh! A powerful solar storm!',
    emotion: 'surprised',
    hologram: 'solarStorm',
    // Calm Sun → active surface → eruption → expanding plasma cloud.
    timeline: frames('solarStorm', [3, 0], [2, 800], [1, 1700], [0, 2700]),
    camera: 'storm',
    ambience: 'storm',
    sound: 'solarStormReplay',
  },
  {
    id: 'intro-09',
    moment: 'fault',
    subphase: 'storm-reveal',
    line: 'It sent energy and particles into space, disrupting our communication network!',
    emotion: 'explaining',
    hologram: 'stormImpact',
    // The view zooms out to the network; nodes turn from blue to orange.
    timeline: frames('stormImpact', [3, 0], [2, 1200], [1, 2400], [0, 3400]),
    camera: 'storm',
    ambience: 'storm',
    sound: 'archiveConnectionLost',
  },
  // 3.5 How the Archive was damaged.
  {
    id: 'intro-10',
    moment: 'fault',
    subphase: 'archive-damage',
    line: 'The storm disrupted the Archive while its memories were being updated!',
    emotion: 'explaining',
    hologram: 'syncError',
    timeline: frames('syncError', [3, 0], [2, 1200], [1, 2400], [0, 3600]),
    camera: 'storm',
    ambience: 'storm',
    sound: 'archiveQueryFailed',
  },
  {
    id: 'intro-11',
    moment: 'fault',
    subphase: 'archive-damage',
    line: "Now some of the explorers' stories are incomplete!",
    emotion: 'worried',
    hologram: 'fragmented',
    timeline: frames('fragmented', [1, 0], [0, 1000]),
    camera: 'archive',
    ambience: 'warning',
    sound: 'archiveFaultGlitch',
  },
  // 3.6 The failed recovery attempt.
  {
    id: 'intro-12',
    moment: 'fault',
    subphase: 'failed-recovery',
    line: 'The Archive is trying to fix them...',
    emotion: 'worried',
    hologram: 'recovering',
    // Pieces reach for each other; some click, others slip away.
    timeline: frames('recovering', [2, 0], [1, 1000], [0, 2000]),
    camera: 'archive',
    ambience: 'warning',
    sound: 'archiveQuery',
  },
  {
    id: 'intro-13',
    moment: 'fault',
    subphase: 'failed-recovery',
    line: "But the pieces don't fit together!",
    emotion: 'sad',
    hologram: 'offline',
    timeline: frames('offline', [1, 0], [0, 900]),
    camera: 'archive',
    ambience: 'warning',
    sound: 'archiveFaultGlitch',
  },
  // 3.7 PIP is affected too: the most empathetic moment.
  {
    id: 'intro-14',
    moment: 'fault',
    subphase: 'pip-affected',
    line: 'And some of my own memories are missing too.',
    emotion: 'sad',
    hologram: 'memory',
    timeline: frames('memory', [1, 0], [0, 1200]),
    camera: 'pip',
    ambience: 'soft',
    pipPanel: 'memoryCheck',
    pipGlitch: true,
  },
  {
    id: 'intro-15',
    moment: 'fault',
    subphase: 'pip-affected',
    line: "I know these explorers... but I can't remember what they discovered.",
    emotion: 'thoughtful',
    hologram: 'forgotten',
    camera: 'pip',
    ambience: 'soft',
    pipPanel: 'memoryCheck',
  },

  // ── Scene 4 · The last signals ───────────────────────────────────
  {
    id: 'intro-16',
    moment: 'hope',
    subphase: 'last-signals',
    line: 'Wait! I still remember two places where their signals came from!',
    emotion: 'excited',
    hologram: 'locations',
    timeline: frames('locations', [2, 0], [1, 800], [0, 1600]),
    camera: 'archive',
    ambience: 'hope',
  },
  {
    id: 'intro-17',
    moment: 'hope',
    subphase: 'last-signals',
    line: 'If we fly there, we can find the explorers and recover their missing stories!',
    emotion: 'happy',
    hologram: 'route',
    timeline: frames('route', [1, 0], [0, 1200]),
    camera: 'archive',
    ambience: 'hope',
    sound: 'routeConfirmed',
  },

  // ── Scene 5 · Will you help me? ──────────────────────────────────
  {
    id: 'intro-18',
    moment: 'invitation',
    subphase: 'invitation',
    line: "Lots of explorers' stories are still waiting to be remembered.",
    emotion: 'curious',
    hologram: 'dossier',
    camera: 'invitation',
    ambience: 'hope',
  },
  {
    id: 'intro-19',
    moment: 'invitation',
    subphase: 'invitation',
    line: 'We can find them, rebuild their memories, and send their stories home!',
    emotion: 'excited',
    hologram: 'letter',
    // A demonstration of the future mechanic (never real progress):
    // incomplete file → scan → rebuilt → smart letter → toward Earth.
    timeline: frames('letter', [4, 0], [3, 1100], [2, 2200], [1, 3300], [0, 4400]),
    camera: 'invitation',
    ambience: 'hope',
    sound: 'pipHologram',
  },
  {
    id: 'intro-20',
    moment: 'invitation',
    subphase: 'invitation',
    line: 'So... will you help me?',
    emotion: 'hopeful',
    hologram: 'letter',
    timeline: frames('letter', [5, 0]),
    camera: 'invitation',
    ambience: 'hope',
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

/**
 * Frames to project for a line. Reduced motion (or a beat without an
 * animation) gets a single settled frame shown at once.
 */
export function introHologramTimeline(
  index: number,
  reducedMotion = false,
): readonly IntroHologramFrame[] {
  const beat = introBeatForLine(index)
  const settled = beat.timeline?.[beat.timeline.length - 1] ?? {
    state: beat.hologram,
    variant: 0,
    at: 0,
  }
  if (reducedMotion || !beat.timeline) return [{ ...settled, at: 0 }]
  return beat.timeline
}

export function introCameraForLine(
  index: number,
  reducedMotion = false,
): IntroCameraShot {
  if (reducedMotion) return 'welcome'
  return introBeatForLine(index).camera
}

/** Screen-reader description of each projection (announced on change). */
export const INTRO_HOLOGRAM_LABELS: Record<IntroHologramState, string> = {
  none: 'The Cosmic Memory Window shows space outside the ship.',
  mail: 'Hologram: a glowing letter travels from Earth across the stars.',
  stable:
    'Hologram: a letter unfolds into many explorer files, all linked to the Cosmic Archive by bright lines.',
  losing1:
    'Hologram: one file flickers, its link fades and breaks. The file turns yellow with a warning sign.',
  losing3:
    'Hologram: more links go dark one after another; the files show warning signs and the light turns orange.',
  solarAlert:
    'Alert: Extreme solar activity detected. Cosmic Archive connection unstable.',
  solarStorm:
    'Hologram, recorded solar data sped up: the Sun brightens, a huge cloud of plasma erupts from it and spreads into space.',
  stormImpact:
    'Hologram: zoomed out, the plasma cloud reaches the communication network; several relay stations turn from blue to orange and their links flicker.',
  syncError:
    'Hologram: the Sun on the left, the Archive on the right in the middle of a memory update. Warnings: communication link lost, archive sync interrupted.',
  fragmented:
    'Hologram: the explorer files break into geometric pieces. Warning: memory records incomplete.',
  recovering:
    'Hologram: the Archive tries to join the pieces with beams of light; some fit, others do not.',
  offline:
    'Hologram: recovery attempt failed. The central link is offline and the files are marked incomplete, but two backup signals still blink.',
  memory:
    "Hologram: PIP memory check. Some memory units are complete, others are marked fragmented.",
  forgotten:
    'Hologram: explorer files with question marks where their discoveries used to be.',
  locations:
    'Hologram: a map of the inner solar system. Two approximate signal areas light up, one near the Moon and one near Mars.',
  route:
    'Hologram: dotted routes reach from Mailwing toward the two signal areas, both marked as pending.',
  dossier:
    'Hologram: many incomplete explorer files wait, their signals gone quiet.',
  letter:
    'Hologram, a preview of how missions work: an incomplete file is scanned, its missing data is rebuilt, and it becomes a glowing letter that travels toward Earth.',
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
    line: 'Your mission album is on the console. Tap it to open it.',
    target: 'album',
    awaits: 'album',
    place: 'cabin',
  },
  // Inside the album
  {
    line: "This is your Cosmic Album! Here you see your carrier badge and how far we've come.",
    target: 'album-id',
    awaits: null,
    place: 'album',
  },
  {
    line: "Each card is an explorer we're looking for. It fills up as we find it and send its story home.",
    target: 'tab-missions',
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
    line: 'This is the photo lab. Every part you scan opens a new photo and a new fact!',
    target: 'tab-discoveries',
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
    line: 'You can open your album any time, even while exploring. Tap the X to close it.',
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
    'The connections break one by one. Mailwing detects an extreme solar storm that disrupted the Archive during a memory update; the files fragment, the recovery attempt fails and PIP finds some of his own memories missing.',
  hope: 'The emergency light fades. Two approximate signal areas appear on a map of the solar system, near the Moon and Mars, and a route reaches toward them.',
  invitation:
    'A preview shows an incomplete file being rebuilt into a smart letter for Earth while PIP asks the carrier for help.',
}
