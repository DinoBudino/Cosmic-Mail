import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_AUDIO_PREFERENCES } from '../game/audio/audioSettings'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('game store audio settings', () => {
  it('clamps every channel and stores mute independently', async () => {
    const { useGameStore } = await import('./gameStore')
    const store = useGameStore.getState()
    store.setMasterVolume(2)
    store.setMusicVolume(-1)
    store.setAmbienceVolume(0.33)
    store.setSfxVolume(0.77)
    store.setVoiceVolume(0.12)
    store.setMuted(true)

    const next = useGameStore.getState()
    expect(next.masterVolume).toBe(1)
    expect(next.musicVolume).toBe(0)
    expect(next.ambienceVolume).toBeCloseTo(0.33)
    expect(next.sfxVolume).toBeCloseTo(0.77)
    expect(next.voiceVolume).toBeCloseTo(0.12)
    expect(next.muted).toBe(true)
  })

  it('persists all five channels and the mute flag', async () => {
    const data = new Map<string, string>()
    const localStorage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
      removeItem: (key: string) => {
        data.delete(key)
      },
    }
    const windowStub = {
      localStorage,
      innerWidth: 1280,
      matchMedia: () => ({ matches: false }),
    }
    vi.stubGlobal('window', windowStub)
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    vi.resetModules()

    const { useGameStore } = await import('./gameStore')
    const store = useGameStore.getState()
    store.setMasterVolume(0.44)
    store.setMusicVolume(0.31)
    store.setAmbienceVolume(0.22)
    store.setSfxVolume(0.66)
    store.setVoiceVolume(0.88)
    store.setMuted(true)

    const raw = data.get('cosmic-mail:settings:v1')
    expect(raw).toBeTruthy()
    const saved = JSON.parse(raw!) as Record<string, unknown>
    expect(saved.masterVolume).toBeCloseTo(0.44)
    expect(saved.musicVolume).toBeCloseTo(0.31)
    expect(saved.ambienceVolume).toBeCloseTo(0.22)
    expect(saved.sfxVolume).toBeCloseTo(0.66)
    expect(saved.voiceVolume).toBeCloseTo(0.88)
    expect(saved.muted).toBe(true)
  })

  it('loads an older save with only musicVolume into the full mixer', async () => {
    const localStorage = {
      getItem: () =>
        JSON.stringify({
          quality: 'high',
          reducedMotion: false,
          voiceEnabled: true,
          musicVolume: 0.2,
        }),
      setItem: () => {},
      removeItem: () => {},
    }
    vi.stubGlobal('window', {
      localStorage,
      innerWidth: 1280,
      matchMedia: () => ({ matches: false }),
    })
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    vi.resetModules()

    const { useGameStore } = await import('./gameStore')
    const state = useGameStore.getState()
    expect(state.musicVolume).toBeCloseTo(0.2)
    expect(state.masterVolume).toBe(DEFAULT_AUDIO_PREFERENCES.masterVolume)
    expect(state.sfxVolume).toBe(DEFAULT_AUDIO_PREFERENCES.sfxVolume)
    expect(state.muted).toBe(false)
  })
})
