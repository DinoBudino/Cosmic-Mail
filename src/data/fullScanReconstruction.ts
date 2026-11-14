/**
 * Pure rules for the interactive full recognition scan (the climax).
 *
 * The player sweeps the explorer to reveal four memory traces (identity,
 * trajectory, discoveries, mission end) and places them on the memory core's
 * timeline in the right order. A wrong placement is never a failure: the
 * fragment goes back to the tray with a gentle hint.
 *
 * State here is ephemeral by design. The only persisted effect is the
 * single `completeFullScan` event (`fullScanCompletedAt` + `memoryRecoveredAt`)
 * issued by the UI once the timeline is complete. No fields are added to
 * the save, and nothing here repairs or wakes the machine.
 */

import type { MissionDefinition, SmartLetterContent } from './missions'

export const MEMORY_FRAGMENT_KINDS = [
  'identity',
  'trajectory',
  'discoveries',
  'missionEnd',
] as const
export type MemoryFragmentKind = (typeof MEMORY_FRAGMENT_KINDS)[number]

export interface MemoryFragmentDefinition {
  kind: MemoryFragmentKind
  /** Neutral label; never reveals the explorer's name. */
  label: string
  /** Soft hint shown when this fragment is placed in the wrong slot. */
  hint: string
}

export const MEMORY_FRAGMENTS: Readonly<
  Record<MemoryFragmentKind, MemoryFragmentDefinition>
> = {
  identity: {
    kind: 'identity',
    label: 'Who it was',
    hint: 'Every story starts by knowing who the explorer was and why it went.',
  },
  trajectory: {
    kind: 'trajectory',
    label: 'How it traveled',
    hint: 'First we meet the explorer, then we follow its journey. Which comes next?',
  },
  discoveries: {
    kind: 'discoveries',
    label: 'What it found',
    hint: 'It had to arrive and get to work before it could discover things.',
  },
  missionEnd: {
    kind: 'missionEnd',
    label: 'How it ended',
    hint: 'Endings belong at the end of the timeline. Try an earlier piece first.',
  },
}

export interface ReconstructionState {
  /** Traces revealed by the scanner sweep, in reveal order. */
  revealed: readonly MemoryFragmentKind[]
  /** Core timeline: slot index -> locked, correctly placed fragment. */
  slots: readonly (MemoryFragmentKind | null)[]
  /** Fragment picked up from the tray, waiting for a slot. */
  selected: MemoryFragmentKind | null
  /** Latest soft hint, cleared on the next valid action. */
  hint: string | null
}

export type ReconstructionAction =
  | 'revealed'
  | 'already-revealed'
  | 'selected'
  | 'deselected'
  | 'placed'
  | 'wrong-slot'
  | 'ignored'

export interface ReconstructionResult {
  state: ReconstructionState
  action: ReconstructionAction
}

export function createReconstruction(): ReconstructionState {
  return {
    revealed: [],
    slots: MEMORY_FRAGMENT_KINDS.map(() => null),
    selected: null,
    hint: null,
  }
}

export function isFragmentPlaced(
  state: ReconstructionState,
  kind: MemoryFragmentKind,
): boolean {
  return state.slots.includes(kind)
}

/** Revealed fragments still waiting in the tray. */
export function getTrayFragments(
  state: ReconstructionState,
): MemoryFragmentKind[] {
  return state.revealed.filter((kind) => !isFragmentPlaced(state, kind))
}

export function allFragmentsRevealed(state: ReconstructionState): boolean {
  return MEMORY_FRAGMENT_KINDS.every((kind) => state.revealed.includes(kind))
}

/** True only when every fragment was revealed and sits in its own slot. */
export function isReconstructionComplete(state: ReconstructionState): boolean {
  return (
    allFragmentsRevealed(state) &&
    MEMORY_FRAGMENT_KINDS.every((kind, index) => state.slots[index] === kind)
  )
}

export type ReconstructionStep = 'sweep' | 'rebuild' | 'done'

/** Sweep progress 0 → 1 (revealed traces out of four). */
export function getSweepProgress(state: ReconstructionState): number {
  return state.revealed.length / MEMORY_FRAGMENT_KINDS.length
}

/** Rebuild progress 0 → 1 (fragments locked in their slot). */
export function getRebuildProgress(state: ReconstructionState): number {
  return (
    state.slots.filter((slot) => slot !== null).length /
    MEMORY_FRAGMENT_KINDS.length
  )
}

/** Step 2 only opens once the sweep has revealed every trace. */
export function isRebuildUnlocked(state: ReconstructionState): boolean {
  return allFragmentsRevealed(state)
}

export function getReconstructionStep(
  state: ReconstructionState,
): ReconstructionStep {
  if (isReconstructionComplete(state)) return 'done'
  return isRebuildUnlocked(state) ? 'rebuild' : 'sweep'
}

/** The single PIP line for step 2 (spoken once, when it unlocks). */
export const REBUILD_STEP_LINE =
  'All four traces found. Place them in order, earliest to latest.'

export function revealFragment(
  state: ReconstructionState,
  kind: MemoryFragmentKind,
): ReconstructionResult {
  if (!MEMORY_FRAGMENT_KINDS.includes(kind)) {
    return { state, action: 'ignored' }
  }
  if (state.revealed.includes(kind)) {
    return { state, action: 'already-revealed' }
  }
  return {
    state: { ...state, revealed: [...state.revealed, kind], hint: null },
    action: 'revealed',
  }
}

/** Picks up (or puts back) a revealed, unplaced fragment. */
export function selectFragment(
  state: ReconstructionState,
  kind: MemoryFragmentKind,
): ReconstructionResult {
  if (!state.revealed.includes(kind) || isFragmentPlaced(state, kind)) {
    return { state, action: 'ignored' }
  }
  if (state.selected === kind) {
    return { state: { ...state, selected: null }, action: 'deselected' }
  }
  return { state: { ...state, selected: kind, hint: null }, action: 'selected' }
}

/**
 * Places the selected fragment in a timeline slot. A correct placement
 * locks it. A wrong one returns the fragment to the tray with a hint:
 * no penalty, no counter, no failure state.
 */
export function placeFragment(
  state: ReconstructionState,
  slotIndex: number,
): ReconstructionResult {
  const kind = state.selected
  if (
    kind === null ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= MEMORY_FRAGMENT_KINDS.length ||
    state.slots[slotIndex] !== null
  ) {
    return { state, action: 'ignored' }
  }
  if (MEMORY_FRAGMENT_KINDS[slotIndex] !== kind) {
    return {
      state: { ...state, selected: null, hint: MEMORY_FRAGMENTS[kind].hint },
      action: 'wrong-slot',
    }
  }
  const slots = state.slots.map((slot, index) =>
    index === slotIndex ? kind : slot,
  )
  return {
    state: { ...state, slots, selected: null, hint: null },
    action: 'placed',
  }
}

/** The fragment's text comes from the mission's smart-letter content. */
export function getFragmentText(
  mission: Pick<MissionDefinition, 'smartLetter'>,
  kind: MemoryFragmentKind,
): string {
  const letter: SmartLetterContent = mission.smartLetter
  return letter[kind]
}
