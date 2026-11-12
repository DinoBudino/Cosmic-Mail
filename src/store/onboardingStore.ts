import { create } from 'zustand'
import { getDestination } from '../data/destinations'
import type { DestinationId } from '../data/missions'
import { clearInput } from '../game/input'
import { useJourneyStore } from './journeyStore'

/**
 * Presentation-only onboarding state. Persistent carrier data, mission
 * progress, stamps and the current destination live exclusively in
 * JourneySave (journeyStore); this store never writes a passport copy.
 */
export type OnboardingPhase =
  | 'menu'
  | 'intro'
  | 'registration'
  | 'hub'
  | 'launching'
  | 'playing'

export type BoardingStage = 'approach' | 'cabin'

interface OnboardingState {
  phase: OnboardingPhase
  boardingStage: BoardingStage
  setBoardingStage: (stage: BoardingStage) => void
  /** Drives PIP's 3D mouth while a line is being spoken. */
  pipTalking: boolean
  setPipTalking: (talking: boolean) => void
  /** Current subtitle/hub-tour line. */
  dialogueIndex: number
  setDialogueIndex: (index: number) => void
  /** Navigation close-up inside the cabin. */
  routeOpen: boolean
  setRouteOpen: (open: boolean) => void
  selectedDestination: DestinationId | null
  routeConfirmed: boolean
  /** Ephemeral: a returning carrier gets a short hub greeting. */
  hubVisited: boolean
  /** The first cabin tour has been read; it must not turn into "welcome back". */
  hubTourDone: boolean
  markHubVisited: () => void
  passportDetailOpen: boolean
  setPassportDetailOpen: (open: boolean) => void
  startNewJourney: () => void
  finishIntro: () => void
  completeRegistration: () => void
  continueJourney: () => void
  selectDestination: (id: DestinationId) => void
  confirmRoute: () => void
  clearSelection: () => void
  takeOff: () => void
  finishLaunch: () => void
  /** Return from a surface mission to Mailwing without losing progress. */
  returnToShip: () => void
  goBack: () => void
  resetPresentation: () => void
}

const EMPTY_PRESENTATION = {
  boardingStage: 'approach' as BoardingStage,
  pipTalking: false,
  dialogueIndex: 0,
  routeOpen: false,
  selectedDestination: null,
  routeConfirmed: false,
  hubVisited: false,
  hubTourDone: false,
  passportDetailOpen: false,
}

function setDestinationInJourney(destination: DestinationId): void {
  const journey = useJourneyStore.getState()
  if (journey.save) journey.setDestination(destination)
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  phase: 'menu',
  ...EMPTY_PRESENTATION,

  setBoardingStage: (boardingStage) => set({ boardingStage }),
  setPipTalking: (pipTalking) => set({ pipTalking }),
  setDialogueIndex: (dialogueIndex) => set({ dialogueIndex }),
  setRouteOpen: (routeOpen) => {
    if (routeOpen && get().phase !== 'hub') return
    set({ routeOpen })
  },
  setPassportDetailOpen: (passportDetailOpen) => {
    if (passportDetailOpen && get().phase !== 'hub') return
    set({ passportDetailOpen })
  },
  markHubVisited: () => set({ hubTourDone: true }),

  startNewJourney: () => {
    clearInput()
    set({ phase: 'intro', ...EMPTY_PRESENTATION })
  },

  finishIntro: () => {
    if (get().phase !== 'intro') return
    clearInput()
    set({ phase: 'registration', routeOpen: false, dialogueIndex: 0 })
  },

  completeRegistration: () => {
    if (get().phase !== 'registration') return
    clearInput()
    set({
      phase: 'hub',
      routeOpen: false,
      passportDetailOpen: false,
      selectedDestination: null,
      routeConfirmed: false,
      dialogueIndex: 0,
      hubVisited: false,
      hubTourDone: false,
      pipTalking: false,
    })
  },

  continueJourney: () => {
    if (!useJourneyStore.getState().save) return
    clearInput()
    set({
      phase: 'hub',
      boardingStage: 'approach',
      pipTalking: false,
      dialogueIndex: 0,
      routeOpen: false,
      selectedDestination: null,
      routeConfirmed: false,
      hubVisited: true,
      hubTourDone: true,
      passportDetailOpen: false,
    })
  },

  selectDestination: (id) => {
    if (get().phase !== 'hub') return
    const destination = getDestination(id)
    if (!destination.available) return
    set({ selectedDestination: id, routeConfirmed: false })
  },

  confirmRoute: () => {
    const { phase, selectedDestination } = get()
    if (phase !== 'hub' || !selectedDestination) return
    const destination = getDestination(selectedDestination)
    if (!destination.available) return
    setDestinationInJourney(selectedDestination)
    set({ routeConfirmed: true, routeOpen: false, dialogueIndex: 0 })
  },

  clearSelection: () => set({ selectedDestination: null, routeConfirmed: false }),

  takeOff: () => {
    const { phase, selectedDestination, routeConfirmed } = get()
    if (phase !== 'hub' || !routeConfirmed || !selectedDestination) return
    if (!getDestination(selectedDestination).available) return
    if (!useJourneyStore.getState().save) return
    clearInput()
    useJourneyStore.getState().completeOnboarding()
    set({
      phase: 'launching',
      routeOpen: false,
      passportDetailOpen: false,
      dialogueIndex: 0,
      pipTalking: false,
    })
  },

  finishLaunch: () => {
    if (get().phase !== 'launching') return
    clearInput()
    set({ phase: 'playing', pipTalking: false })
  },

  returnToShip: () => {
    if (get().phase !== 'playing') return
    clearInput()
    set({
      phase: 'hub',
      boardingStage: 'cabin',
      pipTalking: false,
      dialogueIndex: 0,
      routeOpen: false,
      selectedDestination: null,
      routeConfirmed: false,
      hubVisited: true,
      hubTourDone: true,
      passportDetailOpen: false,
    })
  },

  goBack: () => {
    const { phase } = get()
    clearInput()
    if (phase === 'intro') {
      set({ phase: 'menu', ...EMPTY_PRESENTATION })
      return
    }
    if (phase === 'registration') {
      set({ phase: 'intro', dialogueIndex: 0, routeOpen: false })
      return
    }
    if (phase === 'hub') {
      set({ phase: 'menu', ...EMPTY_PRESENTATION })
    }
  },

  resetPresentation: () => {
    clearInput()
    set({ phase: 'menu', ...EMPTY_PRESENTATION })
  },
}))

/** The 3D world only runs after the launch cinematic. */
export function isOnboardingActive(): boolean {
  return useOnboardingStore.getState().phase !== 'playing'
}
