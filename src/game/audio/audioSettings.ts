/**
 * Audio preferences shared by the store, the settings UI and the mixer.
 * Pure and storage-agnostic so migration from the old `musicVolume`
 * setting can be tested without a browser.
 */

export interface AudioPreferences {
  masterVolume: number
  musicVolume: number
  ambienceVolume: number
  sfxVolume: number
  voiceVolume: number
  muted: boolean
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  masterVolume: 0.85,
  musicVolume: 0.55,
  ambienceVolume: 0.5,
  sfxVolume: 0.8,
  voiceVolume: 1,
  muted: false,
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function volumeFrom(
  record: Record<string, unknown>,
  key: keyof AudioPreferences,
  fallback: number,
): number {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value)
    ? clampVolume(value)
    : fallback
}

/**
 * Reads a persisted settings object. Older saves only had `musicVolume`;
 * the other channels receive conservative defaults while the old cabin
 * volume is preserved as the music channel.
 */
export function sanitizeAudioPreferences(input: unknown): AudioPreferences {
  const record =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {}

  const musicFallback =
    typeof record.musicVolume === 'number'
      ? clampVolume(record.musicVolume)
      : DEFAULT_AUDIO_PREFERENCES.musicVolume

  return {
    masterVolume: volumeFrom(
      record,
      'masterVolume',
      DEFAULT_AUDIO_PREFERENCES.masterVolume,
    ),
    musicVolume: volumeFrom(record, 'musicVolume', musicFallback),
    ambienceVolume: volumeFrom(
      record,
      'ambienceVolume',
      DEFAULT_AUDIO_PREFERENCES.ambienceVolume,
    ),
    sfxVolume: volumeFrom(
      record,
      'sfxVolume',
      DEFAULT_AUDIO_PREFERENCES.sfxVolume,
    ),
    voiceVolume: volumeFrom(
      record,
      'voiceVolume',
      DEFAULT_AUDIO_PREFERENCES.voiceVolume,
    ),
    muted: record.muted === true,
  }
}

export function withAudioPreference(
  current: AudioPreferences,
  key: keyof AudioPreferences,
  value: number | boolean,
): AudioPreferences {
  if (key === 'muted') {
    return { ...current, muted: value === true }
  }
  return { ...current, [key]: clampVolume(value as number) }
}

/** Voice files are plain HTMLAudioElements, so apply the effective gain. */
export function effectiveVoiceOutput(preferences: AudioPreferences): number {
  if (preferences.muted) return 0
  return clampVolume(preferences.masterVolume * preferences.voiceVolume)
}
