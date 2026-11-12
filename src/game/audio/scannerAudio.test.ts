import { describe, expect, it } from 'vitest'
import { stepScannerAudio } from './scannerAudio'

describe('scanner progress audio', () => {
  it('starts once when the hold begins', () => {
    expect(stepScannerAudio(0, 0.1, false)).toEqual({
      events: ['scanStarted'],
      halfPlayed: false,
      stopLoop: false,
    })
    expect(stepScannerAudio(0.1, 0.2, false).events).toEqual([])
  })

  it('ticks once at the half-way point', () => {
    const first = stepScannerAudio(0.4, 0.5, false)
    expect(first.events).toEqual(['scanProgressHalf'])
    expect(first.halfPlayed).toBe(true)
    expect(stepScannerAudio(0.5, 0.9, true).events).toEqual([])
  })

  it('stops and reports an interruption when released early', () => {
    expect(stepScannerAudio(0.42, 0, false)).toEqual({
      events: ['scanInterrupted'],
      halfPlayed: false,
      stopLoop: true,
    })
  })

  it('stops without an interruption sound when the scan completed', () => {
    expect(stepScannerAudio(0.98, 0, true)).toEqual({
      events: ['scanCompleted'],
      halfPlayed: false,
      stopLoop: true,
    })
  })

  it('does nothing while idle or when a target is lost before progress', () => {
    expect(stepScannerAudio(0, 0, false)).toEqual({
      events: [],
      halfPlayed: false,
      stopLoop: false,
    })
    expect(stepScannerAudio(0.02, 0, false)).toEqual({
      events: [],
      halfPlayed: false,
      stopLoop: false,
    })
  })
})
