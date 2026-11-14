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
    store.enqueue({ ...cue('first'), priority: 'archive' })
    store.enqueue(cue('mission'))
    store.enqueue({
      id: 'hint',
      text: 'hint',
      priority: 'archive',
      once: false,
    })

    expect(useNarrativeStore.getState().queue.map((line) => line.id)).toEqual([
      'hint',
      'mission',
    ])
  })

  it('allows explicit repeated hints but never duplicates a pending cue', () => {
    const hint = { ...cue('hint'), once: false, solicited: true }
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

describe('central dialogue policy', () => {
  beforeEach(() => {
    useNarrativeStore.getState().reset()
  })

  const line = (
    id: string,
    priority: 'ambient' | 'hint' | 'mission' | 'archive',
    extra: object = {},
  ) => ({ id, text: `Line ${id}.`, priority, ...extra })

  it('lets a more important line cut in and brings a story beat back', () => {
    const store = useNarrativeStore.getState()
    store.enqueue(line('beat', 'mission'), 0)
    expect(store.enqueue(line('ask', 'hint', { tier: 0, solicited: true }), 10)).toBe(true)
    const state = useNarrativeStore.getState()
    expect(state.current?.id).toBe('ask')
    expect(state.queue.map((l) => l.id)).toEqual(['beat'])
  })

  it('loses an interrupted optional line instead of replaying it', () => {
    const store = useNarrativeStore.getState()
    store.enqueue(line('nudge', 'hint'), 0)
    store.enqueue(line('beat', 'archive'), 10)
    const state = useNarrativeStore.getState()
    expect(state.current?.id).toBe('beat')
    expect(state.queue).toHaveLength(0)
  })

  it('drops optional lines while PIP is busy: they never pile up', () => {
    const store = useNarrativeStore.getState()
    store.enqueue(line('beat', 'mission'), 0)
    expect(store.enqueue(line('amb', 'ambient'), 20_000)).toBe(false)
    expect(store.enqueue(line('hint', 'hint'), 20_000)).toBe(false)
    expect(useNarrativeStore.getState().queue).toHaveLength(0)
  })

  it('drops ambient lines outside free exploration', () => {
    const state = useNarrativeStore.getState()
    expect(state.ambientAllowed).toBe(false)
    expect(state.enqueue(line('quiet', 'ambient'), 0)).toBe(false)
    expect(useNarrativeStore.getState().current).toBeNull()
    state.setAmbientAllowed(true)
    expect(useNarrativeStore.getState().enqueue(line('loud', 'ambient'), 1)).toBe(true)
  })

  it('spaces unsolicited optional lines and never re-says one in the window', () => {
    useNarrativeStore.getState().setAmbientAllowed(true)
    const store = useNarrativeStore.getState()
    expect(store.enqueue(line('a', 'ambient'), 0)).toBe(true)
    useNarrativeStore.getState().complete()
    expect(useNarrativeStore.getState().enqueue(line('b', 'ambient'), 5_000)).toBe(false)
    expect(useNarrativeStore.getState().enqueue(line('b', 'ambient'), 16_000)).toBe(true)
    useNarrativeStore.getState().complete()
    expect(
      useNarrativeStore
        .getState()
        .enqueue({ ...line('c', 'ambient'), text: 'Line b.', once: false }, 45_000),
    ).toBe(true)
    useNarrativeStore.getState().complete()
    // The same text again within the window is dropped.
    expect(
      useNarrativeStore
        .getState()
        .enqueue({ ...line('d', 'mission'), text: 'Line b.', once: false }, 46_000),
    ).toBe(false)
  })

  it('does not mark a dropped one-time cue as spoken', () => {
    const store = useNarrativeStore.getState()
    store.enqueue(line('beat', 'mission'), 0)
    store.enqueue(line('later', 'ambient'), 1)
    expect(useNarrativeStore.getState().spoken.later).toBeUndefined()
  })

  it('fits an over-long line before it reaches the screen', () => {
    useNarrativeStore.getState().enqueue(
      {
        id: 'long',
        text: 'First part is short. Second part is short. Third part is extra.',
        priority: 'mission',
      },
      0,
    )
    expect(useNarrativeStore.getState().current?.text).toBe(
      'First part is short. Second part is short.',
    )
  })

  it('cancels lines the player already moved past', () => {
    let stale = false
    const store = useNarrativeStore.getState()
    store.enqueue(line('first', 'mission'), 0)
    store.enqueue(line('old', 'mission', { cancelWhen: () => stale }), 1)
    store.enqueue(line('fresh', 'mission'), 2)
    stale = true
    useNarrativeStore.getState().complete()
    expect(useNarrativeStore.getState().current?.id).toBe('fresh')

    // The playing line is cancelled too when it goes stale.
    useNarrativeStore.getState().reset()
    let moved = false
    useNarrativeStore
      .getState()
      .enqueue(line('now', 'mission', { cancelWhen: () => moved }), 0)
    useNarrativeStore.getState().dropStaleCurrent()
    expect(useNarrativeStore.getState().current?.id).toBe('now')
    moved = true
    useNarrativeStore.getState().dropStaleCurrent()
    expect(useNarrativeStore.getState().current).toBeNull()
  })
})
