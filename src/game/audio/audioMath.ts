import type { AudioBus } from './types'
import type { AudioPreferences } from './audioSettings'
import { clampVolume, effectiveVoiceOutput } from './audioSettings'

export interface MixerState {
  preferences: AudioPreferences
  focusDucked: boolean
  pageHidden: boolean
}

/** Target gain for a bus before any ducking envelope is applied. */
export function busGain(state: MixerState, bus: AudioBus): number {
  const { preferences } = state
  if (preferences.muted || state.pageHidden) return 0

  const master = clampVolume(preferences.masterVolume)
  switch (bus) {
    case 'music':
      return master * clampVolume(preferences.musicVolume) * (state.focusDucked ? 0.62 : 1)
    case 'ambience':
      return master * clampVolume(preferences.ambienceVolume) * (state.focusDucked ? 0.55 : 1)
    case 'sfx':
      return master * clampVolume(preferences.sfxVolume)
    case 'voice':
      return effectiveVoiceOutput(preferences)
  }
}

/** Equal-power crossfade curve, t in 0..1. */
export function equalPowerGain(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return Math.sin((clamped * Math.PI) / 2)
}

/** Music/ambience duck level while PIP speaks. */
export const VOICE_DUCK_LEVEL = 0.34
export const FOCUS_DUCK_LEVEL = 0.62

export function duckGain(active: boolean, level = VOICE_DUCK_LEVEL): number {
  return active ? Math.min(1, Math.max(0, level)) : 1
}

/** Small deterministic window so a held pointer cannot retrigger a sound. */
export function isDuplicate(
  lastPlayedAt: number | undefined,
  now: number,
  windowMs: number,
): boolean {
  if (lastPlayedAt === undefined) return false
  return now - lastPlayedAt < Math.max(0, windowMs)
}

/** Conservative voice duration estimate for ducking when no audio event fires. */
export function estimateVoiceDurationMs(text: string): number {
  const clean = text.trim()
  if (clean.length === 0) return 0
  return Math.min(18000, 1400 + clean.length * 62)
}

export function clampPan(value: number): number {
  return Math.min(1, Math.max(-1, value))
}
