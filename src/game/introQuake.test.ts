import { afterEach, describe, expect, it } from 'vitest'
import {
  quakeEnvelope,
  quakeLight,
  quakeOffset,
  sampleIntroQuake,
  startIntroQuake,
  stopIntroQuake,
} from './introQuake'
import { INTRO_BEATS } from '../data/onboardingNarrative'

afterEach(() => stopIntroQuake())

describe('intro solar storm quake', () => {
  it('is idle until started and stops on its own', () => {
    expect(sampleIntroQuake(0)).toEqual({ shake: 0, light: 1, t: -1 })
    startIntroQuake(1000, 1, 0)
    expect(sampleIntroQuake(200).shake).toBeGreaterThan(0)
    expect(sampleIntroQuake(1000)).toEqual({ shake: 0, light: 1, t: -1 })
  })

  it('can be cancelled (new line, Replay or Skip)', () => {
    startIntroQuake(1600, 1, 0)
    stopIntroQuake()
    expect(sampleIntroQuake(300).shake).toBe(0)
  })

  it('ramps in fast and fades out to nothing', () => {
    expect(quakeEnvelope(0, 1.6)).toBe(0)
    expect(quakeEnvelope(0.1, 1.6)).toBeGreaterThan(0.8)
    expect(quakeEnvelope(1.59, 1.6)).toBeLessThan(0.01)
    expect(quakeEnvelope(2, 1.6)).toBe(0)
  })

  it('keeps the tremor small', () => {
    for (let t = 0; t < 1.6; t += 0.01) {
      const offset = quakeOffset(t, 1)
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(0.05)
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(0.035)
      expect(Math.abs(offset.roll)).toBeLessThanOrEqual(0.012)
    }
  })

  it('flickers safely: never dark, at most two dips in any second', () => {
    const step = 0.005
    const samples: number[] = []
    for (let t = 0; t < 2; t += step) samples.push(quakeLight(t, 1))
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.4)
    // Count dip onsets (light leaving 1) inside every 1 s window.
    const onsets: number[] = []
    samples.forEach((value, i) => {
      if (value < 0.99 && (i === 0 || samples[i - 1]! >= 0.99)) onsets.push(i * step)
    })
    for (const start of onsets) {
      expect(onsets.filter((t) => t >= start && t < start + 1).length).toBeLessThanOrEqual(2)
    }
    // Aftershocks dim less than the main hit.
    expect(quakeLight(0.18, 0.4)).toBeGreaterThan(quakeLight(0.18, 1))
  })

  it('hits the ship at the very instant data is lost, never during the replay', () => {
    const shaking = INTRO_BEATS.filter((beat) => beat.quakes?.length)
    expect(shaking.map((beat) => beat.subphase)).toEqual(['first-anomaly', 'fault-spreads'])
    for (const beat of shaking) {
      const breaks = new Set(beat.timeline!.map((frame) => frame.at))
      for (const quake of beat.quakes!) {
        // Each hit lands on a frame where a link changes, not after it.
        expect(breaks.has(quake.at), `${beat.id} @${quake.at}`).toBe(true)
        expect(quake.strength).toBeLessThanOrEqual(1)
      }
    }
    // The first loss is the main hit, right as the line starts, and the
    // link is fully cut while the ship is still shaking.
    const first = shaking[0]!
    const hit = first.quakes![0]!
    expect(hit.strength).toBe(1)
    expect(hit.at).toBeLessThanOrEqual(200)
    const cut = first.timeline![first.timeline!.length - 1]!.at
    expect(cut).toBeGreaterThan(hit.at)
    expect(cut).toBeLessThan(hit.at + hit.duration)
    // The solar storm is a recorded replay: it explains, it does not shake.
    for (const beat of INTRO_BEATS) {
      if (beat.subphase === 'storm-reveal' || beat.subphase === 'solar-alert') {
        expect(beat.quakes).toBeUndefined()
      }
    }
  })
})
