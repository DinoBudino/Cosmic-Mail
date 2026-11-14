import { describe, expect, it } from 'vitest'
import {
  MEMORY_FRAGMENT_KINDS,
  MEMORY_FRAGMENTS,
  allFragmentsRevealed,
  createReconstruction,
  getFragmentText,
  getReconstructionStep,
  getRebuildProgress,
  getSweepProgress,
  getTrayFragments,
  isRebuildUnlocked,
  REBUILD_STEP_LINE,
  isReconstructionComplete,
  placeFragment,
  revealFragment,
  selectFragment,
  type ReconstructionState,
} from './fullScanReconstruction'
import { MISSIONS } from './missions'

function revealAll(state = createReconstruction()): ReconstructionState {
  return MEMORY_FRAGMENT_KINDS.reduce(
    (current, kind) => revealFragment(current, kind).state,
    state,
  )
}

describe('full scan steps', () => {
  it('moves sweep → rebuild → done and never skips a step', () => {
    let state = createReconstruction()
    expect(getReconstructionStep(state)).toBe('sweep')
    expect(isRebuildUnlocked(state)).toBe(false)
    expect(getSweepProgress(state)).toBe(0)
    for (const kind of MEMORY_FRAGMENT_KINDS.slice(0, 3)) {
      state = revealFragment(state, kind).state
    }
    // Three of four traces: still sweeping, rebuild stays locked.
    expect(getReconstructionStep(state)).toBe('sweep')
    expect(getSweepProgress(state)).toBe(0.75)
    expect(isRebuildUnlocked(state)).toBe(false)
    state = revealFragment(state, MEMORY_FRAGMENT_KINDS[3]!).state
    expect(getReconstructionStep(state)).toBe('rebuild')
    expect(getSweepProgress(state)).toBe(1)
    expect(getRebuildProgress(state)).toBe(0)
    MEMORY_FRAGMENT_KINDS.forEach((kind, index) => {
      state = selectFragment(state, kind).state
      state = placeFragment(state, index).state
    })
    expect(getRebuildProgress(state)).toBe(1)
    expect(getReconstructionStep(state)).toBe('done')
  })

  it('does not unlock the rebuild with out-of-order or repeated reveals', () => {
    let state = createReconstruction()
    state = revealFragment(state, MEMORY_FRAGMENT_KINDS[2]!).state
    state = revealFragment(state, MEMORY_FRAGMENT_KINDS[2]!).state
    expect(getSweepProgress(state)).toBe(0.25)
    expect(isRebuildUnlocked(state)).toBe(false)
  })

  it('keeps the step-2 PIP line short and name-free', () => {
    expect(REBUILD_STEP_LINE.length).toBeLessThanOrEqual(140)
    expect(REBUILD_STEP_LINE).not.toMatch(/spirit|rover|pancam/i)
  })

  it('a half-finished reconstruction is plain ephemeral state: nothing persists', () => {
    // The reconstruction functions only return new objects; the journey save
    // is written by exactly one call (completeFullScan) after completion.
    const before = createReconstruction()
    const after = revealFragment(before, MEMORY_FRAGMENT_KINDS[0]!).state
    expect(before.revealed).toHaveLength(0)
    expect(after).not.toBe(before)
  })
})

describe('full scan reconstruction rules', () => {
  it('starts empty with four slots and nothing complete', () => {
    const state = createReconstruction()
    expect(state.slots).toEqual([null, null, null, null])
    expect(isReconstructionComplete(state)).toBe(false)
    expect(allFragmentsRevealed(state)).toBe(false)
  })

  it('reveals each trace once and never duplicates it', () => {
    const first = revealFragment(createReconstruction(), 'identity')
    expect(first.action).toBe('revealed')
    const again = revealFragment(first.state, 'identity')
    expect(again.action).toBe('already-revealed')
    expect(again.state).toBe(first.state)
    expect(again.state.revealed).toEqual(['identity'])
  })

  it('cannot select or place an unrevealed fragment', () => {
    const state = createReconstruction()
    expect(selectFragment(state, 'identity').action).toBe('ignored')
    expect(placeFragment(state, 0).action).toBe('ignored')
  })

  it('places a fragment in its own slot and locks it', () => {
    let state = revealFragment(createReconstruction(), 'identity').state
    state = selectFragment(state, 'identity').state
    const placed = placeFragment(state, 0)
    expect(placed.action).toBe('placed')
    expect(placed.state.slots[0]).toBe('identity')
    expect(placed.state.selected).toBeNull()
    expect(getTrayFragments(placed.state)).toEqual([])
    // A locked fragment cannot be picked up again.
    expect(selectFragment(placed.state, 'identity').action).toBe('ignored')
  })

  it('returns a wrongly placed fragment to the tray with a hint, no penalty', () => {
    let state = revealAll()
    state = selectFragment(state, 'missionEnd').state
    const wrong = placeFragment(state, 0)
    expect(wrong.action).toBe('wrong-slot')
    expect(wrong.state.slots).toEqual([null, null, null, null])
    expect(wrong.state.selected).toBeNull()
    expect(wrong.state.hint).toBe(MEMORY_FRAGMENTS.missionEnd.hint)
    expect(getTrayFragments(wrong.state)).toContain('missionEnd')
    // Nothing tracks mistakes: the player can simply try again.
    const retry = placeFragment(
      selectFragment(wrong.state, 'missionEnd').state,
      3,
    )
    expect(retry.action).toBe('placed')
  })

  it('ignores occupied, out-of-range and non-integer slots', () => {
    let state = revealAll()
    state = placeFragment(selectFragment(state, 'identity').state, 0).state
    state = selectFragment(state, 'trajectory').state
    expect(placeFragment(state, 0).action).toBe('ignored')
    expect(placeFragment(state, 9).action).toBe('ignored')
    expect(placeFragment(state, -1).action).toBe('ignored')
    expect(placeFragment(state, 1.5).action).toBe('ignored')
  })

  it('toggles selection off when the same fragment is chosen twice', () => {
    let state = revealFragment(createReconstruction(), 'trajectory').state
    state = selectFragment(state, 'trajectory').state
    expect(state.selected).toBe('trajectory')
    const off = selectFragment(state, 'trajectory')
    expect(off.action).toBe('deselected')
    expect(off.state.selected).toBeNull()
  })

  it('completes only when all four are revealed and correctly ordered', () => {
    let state = revealAll()
    for (const [index, kind] of MEMORY_FRAGMENT_KINDS.entries()) {
      expect(isReconstructionComplete(state)).toBe(false)
      state = placeFragment(selectFragment(state, kind).state, index).state
    }
    expect(isReconstructionComplete(state)).toBe(true)
  })

  it('cannot complete with traces still hidden', () => {
    // Slots can only be filled from revealed fragments, so partial reveal
    // can never reach completion.
    let state = createReconstruction()
    for (const [index, kind] of MEMORY_FRAGMENT_KINDS.slice(0, 3).entries()) {
      state = revealFragment(state, kind).state
      state = placeFragment(selectFragment(state, kind).state, index).state
    }
    expect(isReconstructionComplete(state)).toBe(false)
  })

  it('never reveals an explorer name in its neutral labels and hints', () => {
    const names = MISSIONS.map((m) => m.machineName)
    for (const definition of Object.values(MEMORY_FRAGMENTS)) {
      for (const name of names) {
        expect(definition.label).not.toContain(name)
        expect(definition.hint).not.toContain(name)
      }
    }
  })

  it('reads fragment content from every mission smart letter', () => {
    for (const mission of MISSIONS) {
      for (const kind of MEMORY_FRAGMENT_KINDS) {
        expect(getFragmentText(mission, kind).length).toBeGreaterThan(10)
      }
    }
  })
})
