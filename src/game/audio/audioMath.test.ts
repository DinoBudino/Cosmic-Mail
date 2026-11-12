import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO_PREFERENCES } from './audioSettings'
import {
  busGain,
  duckGain,
  equalPowerGain,
  estimateVoiceDurationMs,
  isDuplicate,
  type MixerState,
} from './audioMath'

const base: MixerState = {
  preferences: {
    ...DEFAULT_AUDIO_PREFERENCES,
    masterVolume: 0.8,
    musicVolume: 0.5,
    ambienceVolume: 0.4,
    sfxVolume: 0.7,
    voiceVolume: 0.9,
  },
  focusDucked: false,
  pageHidden: false,
}

describe('mixer math', () => {
  it('keeps every channel independent under the master', () => {
    expect(busGain(base, 'music')).toBeCloseTo(0.4)
    expect(busGain(base, 'ambience')).toBeCloseTo(0.32)
    expect(busGain(base, 'sfx')).toBeCloseTo(0.56)
    expect(busGain(base, 'voice')).toBeCloseTo(0.72)
  })

  it('mutes every bus when the master mute is on', () => {
    const muted = {
      ...base,
      preferences: { ...base.preferences, muted: true },
    }
    expect(busGain(muted, 'music')).toBe(0)
    expect(busGain(muted, 'sfx')).toBe(0)
    expect(busGain(muted, 'voice')).toBe(0)
  })

  it('lowers music and ambience when a modal has focus', () => {
    const focused = { ...base, focusDucked: true }
    expect(busGain(focused, 'music')).toBeLessThan(busGain(base, 'music'))
    expect(busGain(focused, 'ambience')).toBeLessThan(
      busGain(base, 'ambience'),
    )
    expect(busGain(focused, 'sfx')).toBe(busGain(base, 'sfx'))
  })

  it('ducks the bed while PIP speaks and restores it afterwards', () => {
    expect(duckGain(true)).toBeLessThan(1)
    expect(duckGain(false)).toBe(1)
  })

  it('uses an equal-power curve for crossfades', () => {
    expect(equalPowerGain(0)).toBe(0)
    expect(equalPowerGain(0.5)).toBeCloseTo(Math.SQRT1_2)
    expect(equalPowerGain(1)).toBe(1)
  })

  it('blocks retriggers inside the dedupe window', () => {
    expect(isDuplicate(undefined, 1000, 80)).toBe(false)
    expect(isDuplicate(950, 1000, 80)).toBe(true)
    expect(isDuplicate(900, 1000, 80)).toBe(false)
  })

  it('estimates a voice window without exceeding the cap', () => {
    expect(estimateVoiceDurationMs('')).toBe(0)
    expect(estimateVoiceDurationMs('Hi!')).toBeGreaterThan(1000)
    expect(estimateVoiceDurationMs('word '.repeat(1000))).toBe(18000)
  })
})
