import {
  hubDialogueSteps,
  isHubTourActive,
  type HubDialogueStep,
  type HubTarget,
} from '../data/onboardingNarrative'
import { getSliceClosure } from '../data/sliceClosure'
import { areAllMissionsComplete } from './journeyLogic'
import { useGameStore } from './gameStore'
import { useJourneyStore } from './journeyStore'
import { useOnboardingStore } from './onboardingStore'

export interface HubFocus {
  /** Every dialogue step PIP has for the cabin right now. */
  steps: HubDialogueStep[]
  /** The step on screen (index clamped), or null when PIP is quiet. */
  step: HubDialogueStep | null
  /** Element PIP is pointing at, if any. */
  target: HubTarget | null
  /** First-visit tour running: elements other than the target are locked. */
  tourActive: boolean
}

/**
 * Shared by the DOM bubble, the 3D cabin and the keyboard mirrors so the
 * guided tour highlights and unlocks exactly the same element everywhere.
 */
export function useHubFocus(): HubFocus {
  const phase = useOnboardingStore((state) => state.phase)
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)
  const hubVisited = useOnboardingStore((state) => state.hubVisited)
  const hubTourDone = useOnboardingStore((state) => state.hubTourDone)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const save = useJourneyStore((state) => state.save)
  // PIP stays quiet while an archive dialog (letter, delivery) is open, so
  // the slice-closing lines never talk over the delivery ceremony.
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')

  // The journey's finale (ArchiveRestored) owns the cabin until it closes.
  const finalePending = Boolean(save && areAllMissionsComplete(save) && !save.finalQuoteShown)
  if (phase !== 'hub' || archiveOpen || finalePending) {
    return { steps: [], step: null, target: null, tourActive: false }
  }
  const closure = getSliceClosure(save)
  const options = {
    routeConfirmed,
    hubVisited,
    hubTourDone,
    restoredCount: closure.restored,
    totalStories: closure.total,
  }
  const steps = hubDialogueSteps(options)
  const step =
    steps[Math.min(dialogueIndex, Math.max(0, steps.length - 1))] ?? null
  return {
    steps,
    step,
    target: step?.target ?? null,
    tourActive: isHubTourActive(options),
  }
}

/**
 * Whether a cabin element may be used right now. During the first-visit
 * tour only the element PIP points at answers (other ids, such as
 * 'nav-back', stay locked until the tour ends).
 */
export function hubElementEnabled(
  focus: HubFocus,
  element: HubTarget | (string & {}),
): boolean {
  return !focus.tourActive || focus.target === element
}

/**
 * Index the guided tour should move to, given what is on screen. PIP
 * opens and closes things himself, but the child may get there first:
 * tapping the album or the navigation screen PIP is pointing at, or the
 * album's X, jumps ahead. A choice step (destination) moves on once the
 * child has picked; if the album or navigation closes mid-explanation
 * the tour returns to the line that opens it again.
 */
export function tourIndexFor(
  steps: readonly HubDialogueStep[],
  index: number,
  state: {
    albumOpen: boolean
    routeOpen: boolean
    albumTab: string
    selectedDestination: string | null
  },
): number {
  const step = steps[index]
  if (!step) return index
  if (step.awaits === 'destination' && state.selectedDestination) return index + 1
  if (step.place === 'cabin') {
    if (step.target === 'album' && state.albumOpen) return index + 1
    if (step.target === 'nav' && state.routeOpen) return index + 1
    return index
  }
  const opener = (target: HubTarget) =>
    steps.findIndex((entry) => entry.place === 'cabin' && entry.target === target)
  if (step.place === 'album' && !state.albumOpen) {
    if (step.target === 'album-close') return index + 1
    const at = opener('album')
    if (at >= 0) return at
  }
  if (step.place === 'nav') {
    if (!state.routeOpen) {
      const at = opener('nav')
      if (at >= 0) return at
    }
    const pick = steps.findIndex((entry) => entry.awaits === 'destination')
    if (!state.selectedDestination && pick >= 0 && index > pick) return pick
  }
  return index
}
