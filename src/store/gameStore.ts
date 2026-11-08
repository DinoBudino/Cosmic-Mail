import { create } from 'zustand'
import type { Quality } from '../game/worldConfig'
import { MARS_OBJECTS, type MarsObjectId } from '../data/marsObjects'
import { clearInput } from '../game/input'

const STORAGE_KEY = 'cosmic-mail:settings:v1'

interface PersistedSettings {
  quality: Quality
  reducedMotion: boolean
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
  settingsOpen: boolean
  nearbySiteId: MarsObjectId | null
  activeSiteId: MarsObjectId | null
  challengePreview: boolean
  travelTargetId: MarsObjectId | null
  startTravel: (id: MarsObjectId) => void
  cancelTravel: () => void
  setNearbySite: (id: MarsObjectId | null) => void
  openNearbySite: () => void
  closeSite: () => void
  startChallenge: (id: MarsObjectId) => void
  setQuality: (quality: Quality) => void
  setReducedMotion: (reducedMotion: boolean) => void
  openSettings: () => void
  closeSettings: () => void
}

const initialSettings = loadSettings()

export const useGameStore = create<GameState>((set, get) => ({
  quality: initialSettings.quality,
  reducedMotion: initialSettings.reducedMotion,
  settingsOpen: false,
  nearbySiteId: null,
  activeSiteId: null,
  challengePreview: false,
  travelTargetId: null,
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
    saveSettings({ quality, reducedMotion: get().reducedMotion })
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion })
    saveSettings({ quality: get().quality, reducedMotion })
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
  return state.settingsOpen || state.activeSiteId !== null
}
