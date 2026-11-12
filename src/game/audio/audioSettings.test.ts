import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUDIO_PREFERENCES,
  clampVolume,
  effectiveVoiceOutput,
  sanitizeAudioPreferences,
  withAudioPreference,
} from './audioSettings'

describe('audio preferences', () => {
  it('migrates a legacy save that only had musicVolume', () => {
    const migrated = sanitizeAudioPreferences({ musicVolume: 0.25 })
    expect(migrated.musicVolume).toBe(0.25)
    expect(migrated.masterVolume).toBe(DEFAULT_AUDIO_PREFERENCES.masterVolume)
    expect(migrated.sfxVolume).toBe(DEFAULT_AUDIO_PREFERENCES.sfxVolume)
    expect(migrated.muted).toBe(false)
  })

  it('clamps out-of-range and non-finite channel values', () => {
    const settings = sanitizeAudioPreferences({
      masterVolume: 4,
      musicVolume: -1,
      ambienceVolume: Number.POSITIVE_INFINITY,
      sfxVolume: 0.42,
      voiceVolume: Number.NaN,
      muted: true,
    })
    expect(settings.masterVolume).toBe(1)
    expect(settings.musicVolume).toBe(0)
    expect(settings.ambienceVolume).toBe(
      DEFAULT_AUDIO_PREFERENCES.ambienceVolume,
    )
    expect(settings.sfxVolume).toBe(0.42)
    expect(settings.voiceVolume).toBe(DEFAULT_AUDIO_PREFERENCES.voiceVolume)
    expect(settings.muted).toBe(true)
  })

  it('never lets a persisted mute string turn audio off by accident', () => {
    expect(sanitizeAudioPreferences({ muted: 'true' }).muted).toBe(false)
  })

  it('applies master and voice to the HTML voice output', () => {
    const settings = withAudioPreference(
      withAudioPreference(DEFAULT_AUDIO_PREFERENCES, 'masterVolume', 0.5),
      'voiceVolume',
      0.4,
    )
    expect(effectiveVoiceOutput(settings)).toBeCloseTo(0.2)
    expect(effectiveVoiceOutput({ ...settings, muted: true })).toBe(0)
  })

  it('clamps a single preference update', () => {
    const next = withAudioPreference(
      DEFAULT_AUDIO_PREFERENCES,
      'musicVolume',
      9,
    )
    expect(next.musicVolume).toBe(1)
    expect(clampVolume(-3)).toBe(0)
    expect(clampVolume(Number.NaN)).toBe(0)
  })
})
