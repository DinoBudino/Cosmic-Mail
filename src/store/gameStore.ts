import { create } from 'zustand'
import type { Quality } from '../game/worldConfig'
import { MARS_OBJECTS, type MarsObjectId } from '../data/marsObjects'
import { clearInput } from '../game/input'
import { isOnboardingActive } from './onboardingStore'

const STORAGE_KEY = 'cosmic-mail:settings:v1'

interface PersistedSettings {
  quality: Quality
  reducedMotion: boolean
  /** PIP voice output (speechSynthesis, prefers Samantha when available). */
  voiceEnabled: boolean
  voiceName: string | null
  /** Cabin ambience music volume, 0..1. */
  musicVolume: number
}

function detectDefaultQuality(): Quality {
  if (typeof window === 'undefined') return 'high'
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const narrowViewport = window.innerWidth < 720
  const cores = navigator.hardwareConcurrency ?? 8
  return coarsePointer || narrowViewport || cores <= 4 ? 'low' : 'high'
}

function detectReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function loadSettings(): PersistedSettings {
  const fallback: PersistedSettings = {
    quality: detectDefaultQuality(),
    reducedMotion: detectReducedMotion(),
    voiceEnabled: true,
    voiceName: null,
    musicVolume: 0.5,
  }
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return fallback
    const record = parsed as Partial<PersistedSettings>
    return {
      quality:
        record.quality === 'high' || record.quality === 'low'
          ? record.quality
          : fallback.quality,
      reducedMotion:
        typeof record.reducedMotion === 'boolean'
          ? record.reducedMotion
          : fallback.reducedMotion,
      voiceEnabled:
        typeof record.voiceEnabled === 'boolean'
          ? record.voiceEnabled
          : fallback.voiceEnabled,
      voiceName:
        typeof record.voiceName === 'string' && record.voiceName.length > 0
          ? record.voiceName
          : null,
      musicVolume:
        typeof record.musicVolume === 'number' &&
        record.musicVolume >= 0 &&
        record.musicVolume <= 1
          ? record.musicVolume
          : fallback.musicVolume,
    }
  } catch {
    return fallback
  }
}

function saveSettings(settings: PersistedSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}

interface GameState {
  quality: Quality
  reducedMotion: boolean
  voiceEnabled: boolean
  voiceName: string | null
  musicVolume: number
  settingsOpen: boolean
  nearbySiteId: MarsObjectId | null
  activeSiteId: MarsObjectId | null
  challengePreview: boolean
  travelTargetId: MarsObjectId | null
  /** PIP's one-line orientation message (auto-expires in the UI). */
  pipMessage: string | null
  pipMessageKey: number
  /** Regions whose approach message has already been shown this session. */
  visitedRegions: Partial<Record<MarsObjectId, true>>
  startTravel: (id: MarsObjectId) => void
  cancelTravel: () => void
  setNearbySite: (id: MarsObjectId | null) => void
  showPipMessage: (message: string) => void
  clearPipMessage: () => void
  markRegionVisited: (id: MarsObjectId) => void
  openNearbySite: () => void
  closeSite: () => void
  startChallenge: (id: MarsObjectId) => void
  setQuality: (quality: Quality) => void
  setReducedMotion: (reducedMotion: boolean) => void
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceName: (name: string | null) => void
  setMusicVolume: (volume: number) => void
  openSettings: () => void
  closeSettings: () => void
}

const initialSettings = loadSettings()

export const useGameStore = create<GameState>((set, get) => ({
  quality: initialSettings.quality,
  reducedMotion: initialSettings.reducedMotion,
  voiceEnabled: initialSettings.voiceEnabled,
  voiceName: initialSettings.voiceName,
  musicVolume: initialSettings.musicVolume,
  settingsOpen: false,
  nearbySiteId: null,
  activeSiteId: null,
  challengePreview: false,
  travelTargetId: null,
  pipMessage: null,
  pipMessageKey: 0,
  visitedRegions: {},
  showPipMessage: (message) => set((state) => ({ pipMessage: message, pipMessageKey: state.pipMessageKey + 1 })),
  clearPipMessage: () => set({ pipMessage: null }),
  markRegionVisited: (id) => set((state) => ({ visitedRegions: { ...state.visitedRegions, [id]: true } })),
  startTravel: (id) => {
    if (get().settingsOpen || get().activeSiteId) return
    clearInput()
    set({ travelTargetId: id })
  },
  cancelTravel: () => set({ travelTargetId: null }),
  setNearbySite: (id) => {
    if (get().nearbySiteId !== id) set({ nearbySiteId: id })
  },
  openNearbySite: () => {
    const state = get()
    if (state.settingsOpen || state.activeSiteId || !state.nearbySiteId) return
    clearInput()
    set({ activeSiteId: state.nearbySiteId, challengePreview: false, travelTargetId: null })
  },
  closeSite: () => {
    clearInput()
    set({ activeSiteId: null, challengePreview: false })
  },
  // Integration point for future missions. No progress or rewards for this preview.
  startChallenge: (id) => {
    if (get().activeSiteId !== id || MARS_OBJECTS.find((site) => site.id === id)?.state !== 'available') return
    set({ challengePreview: true })
  },
  setQuality: (quality) => {
    set({ quality })
    saveSettings({ quality, reducedMotion: get().reducedMotion, voiceEnabled: get().voiceEnabled, voiceName: get().voiceName, musicVolume: get().musicVolume })
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion })
    saveSettings({ quality: get().quality, reducedMotion, voiceEnabled: get().voiceEnabled, voiceName: get().voiceName, musicVolume: get().musicVolume })
  },
  setVoiceEnabled: (voiceEnabled) => {
    set({ voiceEnabled })
    saveSettings({ quality: get().quality, reducedMotion: get().reducedMotion, voiceEnabled, voiceName: get().voiceName, musicVolume: get().musicVolume })
  },
  setVoiceName: (voiceName) => {
    set({ voiceName })
    saveSettings({ quality: get().quality, reducedMotion: get().reducedMotion, voiceEnabled: get().voiceEnabled, voiceName, musicVolume: get().musicVolume })
  },
  setMusicVolume: (musicVolume) => {
    const clamped = Math.min(1, Math.max(0, musicVolume))
    set({ musicVolume: clamped })
    saveSettings({ quality: get().quality, reducedMotion: get().reducedMotion, voiceEnabled: get().voiceEnabled, voiceName: get().voiceName, musicVolume: clamped })
  },
  openSettings: () => {
    if (get().activeSiteId) return
    clearInput()
    set({ settingsOpen: true, travelTargetId: null })
  },
  closeSettings: () => {
    clearInput()
    set({ settingsOpen: false })
  },
}))

export function isWorldPaused(): boolean {
  const state = useGameStore.getState()
  return isOnboardingActive() || state.settingsOpen || state.activeSiteId !== null
}
