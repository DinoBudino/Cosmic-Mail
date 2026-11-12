import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNarrativeStore } from './narrativeStore'

const cue = (id: string, text = id) => ({
  id,
  text,
  priority: 'mission' as const,
})

describe('narrative queue', () => {
  beforeEach(() => {
    useNarrativeStore.getState().reset()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays a one-time cue only once', () => {
    const store = useNarrativeStore.getState()
    expect(store.enqueue(cue('entered'))).toBe(true)
    expect(store.enqueue(cue('entered'))).toBe(false)

    useNarrativeStore.getState().complete()
    expect(useNarrativeStore.getState().current).toBeNull()
    expect(useNarrativeStore.getState().enqueue(cue('entered'))).toBe(false)
  })

  it('queues cues without overlapping and advances in order', () => {
    const store = useNarrativeStore.getState()
    store.enqueue(cue('first'))
    store.enqueue(cue('second'))
    store.enqueue(cue('third'))

    let state = useNarrativeStore.getState()
    expect(state.current?.id).toBe('first')
    expect(state.queue.map((line) => line.id)).toEqual(['second', 'third'])

    state.complete()
    state = useNarrativeStore.getState()
    expect(state.current?.id).toBe('second')
    expect(state.queue.map((line) => line.id)).toEqual(['third'])
  })

  it('lets higher-priority cues move ahead of queued mission lines', () => {
    const store = useNarrativeStore.getState()
    store.enqueue(cue('first'))
    store.enqueue(cue('mission'))
    store.enqueue({
      id: 'hint',
      text: 'hint',
      priority: 'discovery',
      once: false,
    })

    expect(useNarrativeStore.getState().queue.map((line) => line.id)).toEqual([
      'hint',
      'mission',
    ])
  })

  it('allows explicit repeated hints but never duplicates a pending cue', () => {
    const hint = { ...cue('hint'), once: false }
    const store = useNarrativeStore.getState()
    expect(store.enqueue(hint)).toBe(true)
    expect(store.enqueue(hint)).toBe(false)

    useNarrativeStore.getState().complete()
    expect(useNarrativeStore.getState().enqueue(hint)).toBe(true)
  })

  it('sends reactions and clears temporary attention', () => {
    vi.useFakeTimers()
    const store = useNarrativeStore.getState()
    store.react('scan', 'spirit-pancam')
    expect(useNarrativeStore.getState().reaction).toMatchObject({
      kind: 'scan',
      componentId: 'spirit-pancam',
    })

    store.showAttention('spirit-pancam', 'hint', 1000)
    expect(useNarrativeStore.getState().attention?.kind).toBe('hint')
    vi.advanceTimersByTime(1000)
    expect(useNarrativeStore.getState().attention).toBeNull()
  })

  it('stores the archive PIP line and clears it on reset', () => {
    const store = useNarrativeStore.getState()
    store.setArchiveLine({
      id: 'spirit:archive:letter',
      missionId: 'spirit',
      text: 'The smart letter is ready.',
      kind: 'letter',
    })
    expect(useNarrativeStore.getState().archiveLine?.kind).toBe('letter')

    store.reset()
    const reset = useNarrativeStore.getState()
    expect(reset.current).toBeNull()
    expect(reset.queue).toEqual([])
    expect(reset.spoken).toEqual({})
    expect(reset.reaction).toBeNull()
    expect(reset.attention).toBeNull()
    expect(reset.archiveLine).toBeNull()
  })
})
