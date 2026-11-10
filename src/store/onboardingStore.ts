import { create } from 'zustand'
import {
  computeTrait,
  explorersForTrait,
  getExplorer,
  getHeroForTrait,
  HISTORICAL_EXPLORERS,
  isValidExplorerName,
  sanitizeExplorerName,
  type TraitId,
} from '../data/personalization'
import { clearInput } from '../game/input'

export type OnboardingPhase =
  | 'menu'
  | 'intro'
  | 'name'
  | 'questions'
  | 'reveal'
  | 'explorer'
  | 'passport'
  | 'hub'
  | 'launching'
  | 'playing'

/** Within the cabin phases: first the approach to the ship, then inside. */
export type BoardingStage = 'approach' | 'cabin'

const STORAGE_KEY = 'cosmic-mail:explorer:v2'
const TUTORIAL_KEY = 'cosmic-mail:tutorial:v1'

function loadTutorialDone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(TUTORIAL_KEY) === 'done'
  } catch {
    return false
  }
}

function saveTutorialDone(done: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (done) window.localStorage.setItem(TUTORIAL_KEY, 'done')
    else window.localStorage.removeItem(TUTORIAL_KEY)
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}

export interface ExplorerPassport {
  explorerName: string
  trait: TraitId
  explorerId: string
  /** Heroes whose memory fragments PIP has recovered (includes the active hero). */
  unlockedExplorerIds: string[]
  /** Stamp ids earned (hero ids), shown in the passport stamp slots. */
  stamps: string[]
  /** Mars site ids that already gave their memory fragment. */
  memorySites: string[]
  missionNumber: number
  /** Chosen route destination, set at takeoff. */
  destination: string | null
}

interface PersistedPassport extends ExplorerPassport {
  completed: true
}

function isTraitId(value: unknown): value is TraitId {
  return (
    value === 'brave' ||
    value === 'observant' ||
    value === 'methodical' ||
    value === 'careful' ||
    value === 'reflective'
  )
}

/**
 * Roster migrations: the catalog replaced Valentina Tereshkova (Brave)
 * with Sally Ride. Only ids that no longer exist are rewritten; every
 * other saved field of the player's passport is left untouched.
 */
const LEGACY_EXPLORER_IDS: Readonly<Record<string, string>> = {
  'valentina-tereshkova': 'sally-ride',
}

export function migrateExplorerId(id: string): string {
  return LEGACY_EXPLORER_IDS[id] ?? id
}

function loadPassport(): ExplorerPassport | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Partial<PersistedPassport>
    if (
      record.completed !== true ||
      typeof record.explorerName !== 'string' ||
      !isValidExplorerName(record.explorerName) ||
      !isTraitId(record.trait) ||
      typeof record.explorerId !== 'string'
    ) {
      return null
    }
    const migrate = migrateExplorerId
    const asStringArray = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string').map(migrate)
        : []
    // Legacy passports may reference explorers that no longer exist
    // (roster changes): fall back to the first explorer of the saved
    // trait instead of crashing getExplorer() later.
    const savedExplorerId = migrate(record.explorerId)
    const knownExplorer = explorersForTrait(record.trait).some(
      (explorer) => explorer.id === savedExplorerId,
    )
    const explorerId = knownExplorer
      ? savedExplorerId
      : (explorersForTrait(record.trait)[0]?.id ?? savedExplorerId)
    const unlocked = [...new Set(asStringArray(record.unlockedExplorerIds))]
    return {
      explorerName: sanitizeExplorerName(record.explorerName),
      trait: record.trait,
      explorerId,
      unlockedExplorerIds: unlocked.includes(explorerId) ? unlocked : [...unlocked, explorerId],
      stamps: [...new Set(asStringArray(record.stamps))],
      memorySites: asStringArray(record.memorySites),
      missionNumber:
        typeof record.missionNumber === 'number' && record.missionNumber > 0
          ? Math.floor(record.missionNumber)
          : 1,
      destination: typeof record.destination === 'string' ? record.destination : null,
    }
  } catch {
    return null
  }
}

function savePassport(passport: ExplorerPassport): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...passport, completed: true } satisfies PersistedPassport),
    )
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}

function clearPassport(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}

interface OnboardingState {
  phase: OnboardingPhase
  boardingStage: BoardingStage
  setBoardingStage: (stage: BoardingStage) => void
  /** True while PIP's typewriter bubble is "speaking" (drives his mouth). */
  pipTalking: boolean
  setPipTalking: (talking: boolean) => void
  /** Which line of PIP's dialogue is showing (visual-novel style). */
  dialogueIndex: number
  setDialogueIndex: (index: number) => void
  /** Name phase only: PIP warned, now the signing window is showing. */
  signing: boolean
  setSigning: (signing: boolean) => void
  /** Route phase: chosen destination zone id, if any. */
  selectedZoneId: string | null
  /** True once SELECT confirms the route: the take-off lid opens. */
  routeConfirmed: boolean
  confirmRoute: () => void
  clearSelection: () => void
  /** Hub: the navigation tablet is open. */
  routeOpen: boolean
  setRouteOpen: (open: boolean) => void
  openRoute: () => void
  selectZone: (zoneId: string) => void
  takeOff: () => void
  /** End of the launch cinematic (or Skip): actually enter the world. */
  finishLaunch: () => void
  /** Hub tutorial (passport + navigation tour) already seen once. */
  tutorialDone: boolean
  setTutorialDone: (done: boolean) => void
  /** Passport detail overlay open over the 3D cabin card. */
  passportDetailOpen: boolean
  setPassportDetailOpen: (open: boolean) => void
  /**
   * Ephemeral Routine Check focus (a choice id), read by the 3D
   * hologram inside the window. Never persisted: focusing must not
   * record a vote or survive a reload.
   */
  routineFocus: string | null
  setRoutineFocus: (choiceId: string | null) => void
  /**
   * Ephemeral hero shown in the explorer hologram (recommendation or
   * a carousel preview). NEVER persisted: only confirmExplorer()
   * commits a hero + trait.
   */
  explorerPreviewId: string | null
  setExplorerPreview: (explorerId: string | null) => void
  passport: ExplorerPassport | null
  explorerName: string
  answers: TraitId[]
  questionIndex: number
  trait: TraitId | null
  explorerId: string | null
  startMission: () => void
  continueFromIntro: () => void
  submitName: (name: string) => void
  answerQuestion: (trait: TraitId) => void
  goBack: () => void
  continueFromReveal: () => void
  confirmExplorer: (explorerId: string) => void
  /**
   * Recover the memory fragment at a Mars site. Restores the next
   * locked hero in catalog order, adds its stamp, and returns the
   * restored hero id (or null when this site already gave a fragment
   * or every hero is already recovered).
   */
  collectMemory: (siteId: string) => string | null
  /** Switch the active hero/power to an already-recovered memory. */
  switchHero: (explorerId: string) => void
  enterWorld: () => void
  continueMission: () => void
  resetJourney: () => void
}

/**
 * The navigation panel only unlocks once PIP has reached the line
 * that tells the pilot to tap it ("When you are ready, tap the radar
 * screen…", dialogue index 2 of the hub tour). Before that the panel
 * is inert decoration — the side/close-up view (routeOpen) must not
 * trigger either. Returning carriers (tutorial done) and a route
 * already confirmed with SELECT are always unlocked.
 */
/** Hub tour line that explicitly invites tapping the radar screen. */
export const HUB_UNLOCK_DIALOGUE_INDEX = 3

export function isNavigationUnlocked(state: {
  phase: OnboardingPhase
  tutorialDone: boolean
  routeConfirmed: boolean
  dialogueIndex: number
}): boolean {
  if (state.phase !== 'hub') return false
  if (state.tutorialDone || state.routeConfirmed) return true
  // Line 4 of the tour ("tap the radar screen and choose") unlocks it.
  return state.dialogueIndex >= HUB_UNLOCK_DIALOGUE_INDEX
}

const initialPassport = loadPassport()

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  phase: 'menu',
  boardingStage: 'approach',
  setBoardingStage: (boardingStage) => set({ boardingStage }),
  pipTalking: false,
  setPipTalking: (pipTalking) => set({ pipTalking }),
  dialogueIndex: 0,
  setDialogueIndex: (dialogueIndex) => set({ dialogueIndex }),
  signing: false,
  setSigning: (signing) => set({ signing }),
  selectedZoneId: null,
  routeConfirmed: false,
  confirmRoute: () => set({ routeConfirmed: true }),
  clearSelection: () => set({ selectedZoneId: null, routeConfirmed: false }),
  routeOpen: false,
  setRouteOpen: (routeOpen) => {
    // Opening the navigation close-up is gated by PIP's tour: until
    // he says "tap the radar screen" the panel cannot be used.
    if (routeOpen && !isNavigationUnlocked(get())) return
    set({ routeOpen })
  },
  tutorialDone: loadTutorialDone(),
  setTutorialDone: (tutorialDone) => {
    saveTutorialDone(tutorialDone)
    set({ tutorialDone })
  },
  passportDetailOpen: false,
  setPassportDetailOpen: (passportDetailOpen) => set({ passportDetailOpen }),
  routineFocus: null,
  setRoutineFocus: (routineFocus) => set({ routineFocus }),
  explorerPreviewId: null,
  setExplorerPreview: (explorerPreviewId) => set({ explorerPreviewId }),
  openRoute: () => {
    clearInput()
    set({ phase: 'hub', routeOpen: false, selectedZoneId: null, routeConfirmed: false, dialogueIndex: 0 })
  },
  selectZone: (selectedZoneId) => {
    if (!isNavigationUnlocked(get())) return
    set({ selectedZoneId })
  },
  takeOff: () => {
    const { passport, selectedZoneId, tutorialDone } = get()
    if (!passport || !selectedZoneId) return
    // First take-off: entering Mars damages PIP's hero archive. Only
    // the active hero stays in memory; the rest must be recovered
    // from memory fragments at the Mars sites.
    const updated: ExplorerPassport = {
      ...passport,
      destination: selectedZoneId,
      unlockedExplorerIds: tutorialDone ? passport.unlockedExplorerIds : [passport.explorerId],
    }
    savePassport(updated)
    // The tutorial ends with the first trip to a planet: taking off
    // is what marks it done (forever), not the hub tour lines.
    saveTutorialDone(true)
    clearInput()
    // Pressing the red button starts the lift-off cinematic; the
    // world only mounts when it ends (finishLaunch) or is skipped.
    set({ passport: updated, phase: 'launching', tutorialDone: true })
  },
  finishLaunch: () => {
    if (get().phase !== 'launching') return
    clearInput()
    set({ phase: 'playing' })
  },
  passport: initialPassport,
  explorerName: initialPassport?.explorerName ?? '',
  answers: [],
  questionIndex: 0,
  trait: null,
  explorerId: null,

  startMission: () => {
    clearInput()
    // A new beginning is a clean slate: the tutorial runs again (so
    // the frontal framing and the hub tour apply), and no controls
    // or passport card exist until the ritual is finished.
    saveTutorialDone(false)
    set({ phase: 'intro', boardingStage: 'approach', dialogueIndex: 0, signing: false, answers: [], questionIndex: 0, trait: null, explorerId: null, explorerName: '', tutorialDone: false })
  },

  continueFromIntro: () => {
    if (get().phase !== 'intro') return
    clearInput()
    set({ phase: 'questions', dialogueIndex: 0 })
  },

  submitName: (name) => {
    if (!isValidExplorerName(name)) return
    const { trait, explorerId } = get()
    if (!trait || !explorerId) return
    const passport: ExplorerPassport = {
      explorerName: sanitizeExplorerName(name),
      trait,
      explorerId,
      unlockedExplorerIds: [explorerId],
      stamps: [],
      memorySites: [],
      missionNumber: get().passport?.missionNumber ?? 1,
      destination: null,
    }
    savePassport(passport)
    clearInput()
    // Signing ends with the signature: leaving it set would keep the
    // hub's PIP bubble (tour indications) suppressed forever.
    set({ explorerName: passport.explorerName, passport, phase: 'hub', dialogueIndex: 0, routeOpen: false, signing: false })
  },

  answerQuestion: (trait) => {
    const { answers, questionIndex } = get()
    const nextAnswers = [...answers.slice(0, questionIndex), trait]
    clearInput()
    if (questionIndex >= 3) {
      set({ answers: nextAnswers, questionIndex: 4, dialogueIndex: 0, trait: computeTrait(nextAnswers), phase: 'reveal' })
    } else {
      set({ answers: nextAnswers, questionIndex: questionIndex + 1, dialogueIndex: 0 })
    }
  },

  goBack: () => {
    const { phase, questionIndex } = get()
    clearInput()
    if (phase === 'intro') {
      set({ phase: 'menu' })
    } else if (phase === 'questions' && questionIndex > 0) {
      set({ questionIndex: questionIndex - 1, dialogueIndex: 0 })
    } else if (phase === 'questions') {
      set({ phase: 'intro', dialogueIndex: 0 })
    } else if (phase === 'reveal') {
      set({ phase: 'questions', questionIndex: 3, trait: null })
    } else if (phase === 'explorer') {
      set({ phase: 'reveal' })
    } else if (phase === 'name') {
      set({ phase: 'explorer', signing: false })
    } else if (phase === 'hub') {
      set({ phase: 'menu' })
    }
  },

  continueFromReveal: () => {
    const trait = get().trait
    if (get().phase !== 'reveal' || !trait) return
    clearInput()
    // The power's hero is assigned automatically; the child may keep
    // it or replace it in the explorer step (which also swaps power).
    set({ explorerId: getHeroForTrait(trait).id, phase: 'explorer' })
  },

  confirmExplorer: (explorerId) => {
    let hero: ReturnType<typeof getExplorer>
    try {
      hero = getExplorer(explorerId)
    } catch {
      return
    }
    clearInput()
    // Choosing another hero also chooses that hero's power: hero and
    // power are the same choice, never two separate ones.
    set({ explorerId, trait: hero.trait, signing: false, phase: 'name' })
  },

  collectMemory: (siteId) => {
    const { passport } = get()
    if (!passport) return null
    if (passport.memorySites.includes(siteId)) return null
    const next = HISTORICAL_EXPLORERS.find(
      (entry) => !passport.unlockedExplorerIds.includes(entry.id),
    )
    if (!next) return null
    const updated: ExplorerPassport = {
      ...passport,
      unlockedExplorerIds: [...passport.unlockedExplorerIds, next.id],
      stamps: passport.stamps.includes(next.id) ? passport.stamps : [...passport.stamps, next.id],
      memorySites: [...passport.memorySites, siteId],
    }
    savePassport(updated)
    set({ passport: updated })
    return next.id
  },

  switchHero: (explorerId) => {
    const { passport } = get()
    if (!passport || !passport.unlockedExplorerIds.includes(explorerId)) return
    let hero: ReturnType<typeof getExplorer>
    try {
      hero = getExplorer(explorerId)
    } catch {
      return
    }
    const updated: ExplorerPassport = { ...passport, explorerId, trait: hero.trait }
    savePassport(updated)
    clearInput()
    set({ passport: updated, explorerId, trait: hero.trait })
  },

  enterWorld: () => {
    clearInput()
    set({ phase: 'playing' })
  },

  continueMission: () => {
    if (!get().passport) return
    clearInput()
    // Continue lands on the control-center hub, not straight in the world:
    // approach flight, then a clean cut to the initial cabin view
    // (board, passport, PIP), with no bubble for returning carriers.
    // The close-up on the navigation panel only happens when the pilot
    // taps the radar screen (routeOpen).
    set({ phase: 'hub', boardingStage: 'approach', dialogueIndex: 0, routeOpen: false, selectedZoneId: null, routeConfirmed: false })
  },

  resetJourney: () => {
    clearPassport()
    saveTutorialDone(false)
    clearInput()
    set({
      phase: 'menu',
      passport: null,
      explorerName: '',
      answers: [],
      questionIndex: 0,
      trait: null,
      explorerId: null,
      tutorialDone: false,
    })
  },
}))

/** The 3D world only runs once the ritual is finished. */
export function isOnboardingActive(): boolean {
  return useOnboardingStore.getState().phase !== 'playing'
}
