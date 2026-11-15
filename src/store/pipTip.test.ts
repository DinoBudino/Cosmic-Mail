import { beforeEach, describe, expect, it } from 'vitest'
import {
  getHintCue,
  getHuntClueCue,
  getReturnToShipCue,
  getScannerPromptCue,
} from '../data/missionNarrative'
import { getMission } from '../data/missions'
import { TIP_DEFAULT_TTL_MS, useNarrativeStore } from './narrativeStore'

const T0 = 1_000_000

const line = (id: string, extra: object = {}) => ({
  id,
  text: `${id} text`,
  priority: 'mission' as const,
  tier: 0 as const,
  solicited: true,
  ...extra,
})

describe("PIP's tip card", () => {
  beforeEach(() => useNarrativeStore.getState().reset())

  it('pins an action tip when it starts and keeps it after the voice ends', () => {
    let done = false
    const store = useNarrativeStore.getState()
    store.enqueue(line('clue', { tip: { doneWhen: () => done } }), T0)
    expect(useNarrativeStore.getState().pinnedTip?.id).toBe('clue')

    useNarrativeStore.getState().complete()
    useNarrativeStore.getState().checkTip(T0 + 60_000)
    expect(useNarrativeStore.getState().pinnedTip?.id).toBe('clue')

    done = true
    useNarrativeStore.getState().checkTip(T0 + 60_400)
    expect(useNarrativeStore.getState().pinnedTip).toBeNull()
  })

  it('never pins a story line, and a story does not remove the tip', () => {
    const store = useNarrativeStore.getState()
    store.enqueue(line('story'), T0)
    expect(useNarrativeStore.getState().pinnedTip).toBeNull()
    useNarrativeStore.getState().complete()

    useNarrativeStore.getState().enqueue(line('tip', { tip: { doneWhen: () => false } }), T0 + 10_000)
    useNarrativeStore.getState().complete()
    useNarrativeStore.getState().enqueue(line('fact'), T0 + 20_000)
    expect(useNarrativeStore.getState().current?.id).toBe('fact')
    expect(useNarrativeStore.getState().pinnedTip?.id).toBe('tip')
  })

  it('replaces the old tip with a newer one', () => {
    useNarrativeStore.getState().enqueue(line('one', { tip: { doneWhen: () => false } }), T0)
    useNarrativeStore.getState().complete()
    useNarrativeStore.getState().enqueue(line('two', { tip: { doneWhen: () => false } }), T0 + 10_000)
    expect(useNarrativeStore.getState().pinnedTip?.id).toBe('two')
  })

  it('lets a tip with nothing to wait for leave after a while', () => {
    useNarrativeStore.getState().enqueue(line('notice', { tip: {} }), T0)
    useNarrativeStore.getState().checkTip(T0 + TIP_DEFAULT_TTL_MS - 1)
    expect(useNarrativeStore.getState().pinnedTip).not.toBeNull()
    useNarrativeStore.getState().checkTip(T0 + TIP_DEFAULT_TTL_MS)
    expect(useNarrativeStore.getState().pinnedTip).toBeNull()
  })

  it('does not pin a tip that is already done', () => {
    useNarrativeStore.getState().enqueue(line('late', { tip: { doneWhen: () => true } }), T0)
    expect(useNarrativeStore.getState().pinnedTip).toBeNull()
  })

  it('shrinks to the Tip button and opens again', () => {
    useNarrativeStore.getState().enqueue(line('clue', { tip: { doneWhen: () => false } }), T0)
    useNarrativeStore.getState().collapseTip()
    expect(useNarrativeStore.getState().pinnedTip?.collapsed).toBe(true)
    useNarrativeStore.getState().expandTip()
    expect(useNarrativeStore.getState().pinnedTip?.collapsed).toBe(false)
  })
})

describe('which lines are tips', () => {
  const mission = getMission('opportunity')

  it('marks clues, the scanner prompt, Ask PIP answers and going back to the ship', () => {
    for (const component of mission.components) {
      expect(getHuntClueCue(mission, component.id)?.tip, component.id).toBeDefined()
    }
    expect(getScannerPromptCue(mission, false)?.tip).toBeDefined()
    expect(getReturnToShipCue(mission)?.tip).toBeDefined()
    const hunting = { discovered: true, scannedComponentIds: [] }
    for (const level of [0, 1, 2]) {
      expect(getHintCue(mission, hunting, level)?.tip, `level ${level}`).toBeDefined()
    }
  })
})
