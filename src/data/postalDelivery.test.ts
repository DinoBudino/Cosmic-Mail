import { describe, expect, it } from 'vitest'
import {
  advanceDelivery,
  createDelivery,
  hasCapsuleDeparted,
  isDeliveryInProgress,
} from './postalDelivery'

describe('postal delivery ceremony', () => {
  it('walks seal → load → send → departing → stamp → done in order', () => {
    let state = createDelivery(false)
    expect(state.step).toBe('seal')
    for (const [event, step] of [
      ['sealed', 'load'],
      ['loaded', 'send'],
      ['sent', 'departing'],
      ['departed', 'stamp'],
      ['stamped', 'done'],
    ] as const) {
      state = advanceDelivery(state, event)
      expect(state.step).toBe(step)
    }
  })

  it('cannot skip steps: out-of-order events keep the same state', () => {
    const start = createDelivery(false)
    expect(advanceDelivery(start, 'sent')).toBe(start)
    expect(advanceDelivery(start, 'stamped')).toBe(start)
    expect(advanceDelivery(start, 'loaded')).toBe(start)
    const sealed = advanceDelivery(start, 'sealed')
    expect(advanceDelivery(sealed, 'sent')).toBe(sealed)
  })

  it('ignores repeated events, e.g. double-pressing Send', () => {
    let state = createDelivery(false)
    state = advanceDelivery(advanceDelivery(state, 'sealed'), 'loaded')
    const sent = advanceDelivery(state, 'sent')
    expect(advanceDelivery(sent, 'sent')).toBe(sent)
  })

  it('starts finished for an already transmitted mission (reload-safe)', () => {
    const state = createDelivery(true)
    expect(state.step).toBe('done')
    expect(isDeliveryInProgress(state)).toBe(false)
    expect(advanceDelivery(state, 'sealed')).toBe(state)
  })

  it('reports progress and capsule departure', () => {
    expect(isDeliveryInProgress(null)).toBe(false)
    let state = createDelivery(false)
    expect(isDeliveryInProgress(state)).toBe(true)
    expect(hasCapsuleDeparted(state)).toBe(false)
    state = advanceDelivery(advanceDelivery(state, 'sealed'), 'loaded')
    expect(hasCapsuleDeparted(state)).toBe(false)
    state = advanceDelivery(state, 'sent')
    expect(hasCapsuleDeparted(state)).toBe(true)
  })
})
