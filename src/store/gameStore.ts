import { create } from 'zustand'
import type { Quality } from '../game/worldConfig'
import type { MissionId } from '../data/missions'
import type { MarsObjectId } from '../data/marsObjects'
import {
  clampVolume,
  sanitizeAudioPreferences,
  type AudioPreferences,
} from '../game/audio/audioSettings'
import { clearInput } from '../game/input'
import { isOnboardingActive } from './onboardingStore'
import type { BriefingStepId } from '../data/marsBriefing'

const STORAGE_KEY = 'cosmic-mail:settings:v1'

/** One archive overlay at a time. Presentation-only, never persisted. */
export type ArchiveView =
  | 'none'
  | 'smart-letter'
  | 'reconstruction'

export type ScannerCamera = 'first-person' | 'third-person'

/** Physical raycast state, independent from mission/narrative states. */
export type ScannerPhysicalState =
  | 'idle'
  | 'valid'
  | 'out-of-range'
  | 'occluded'

/** Reward shown when a scan finishes (practice rock, part or landscape). */
export interface ScanCelebration {
  seq: number
  kind: 'practice' | 'component' | 'environmental'
  title: string
  /** Short action word, e.g. "Looks" for a camera. Optional. */
  verb?: string
  detail: string
  /** World point of the scanned surface, for the burst effect. */
  at: { x: number; y: number; z: number }
}

interface PersistedSettings extends AudioPreferences {
  quality: Quality
  reducedMotion: boolean
  /** PIP voice output (speechSynthesis, prefers Samantha when available). */
  voiceEnabled: boolean
  voiceName: string | null
  scannerCamera: ScannerCamera
  /** Accessibility-only assisted component review. Off by default. */
  assistedScanEnabled: boolean
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
    ...sanitizeAudioPreferences(null),
    quality: detectDefaultQuality(),
    reducedMotion: detectReducedMotion(),
    voiceEnabled: true,
    voiceName: null,
    scannerCamera: 'first-person',
    assistedScanEnabled: false,
  }
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return fallback
    const record = parsed as Partial<PersistedSettings>
    return {
      ...sanitizeAudioPreferences(record),
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
      scannerCamera:
        record.scannerCamera === 'third-person'
          ? 'third-person'
          : 'first-person',
      assistedScanEnabled: record.assistedScanEnabled === true,
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
  scannerCamera: ScannerCamera
  assistedScanEnabled: boolean
  masterVolume: number
  musicVolume: number
  ambienceVolume: number
  sfxVolume: number
  voiceVolume: number
  muted: boolean
  settingsOpen: boolean
  nearbySiteId: MarsObjectId | null
  activeSiteId: MarsObjectId | null
  /** Spirit's contextual scan range (independent from the four legacy sites). */
  nearbySpirit: boolean
  /** Close enough to Mailwing to board it. */
  nearbyShip: boolean
  /** Ephemeral Cosmic Scanner state; closed on reload. */
  scannerOpen: boolean
  scannerMissionId: MissionId | null
  scannerSelectedComponentId: string | null
  /**
   * The last finished scan, shown as a small reward card and a burst on the
   * target. Ephemeral: never persisted. `seq` grows with every scan.
   */
  scanCelebration: ScanCelebration | null
  celebrateScan: (celebration: Omit<ScanCelebration, 'seq'>) => void
  dismissScanCelebration: () => void
  /** Distractor rover part under the reticle (gives a note, no progress). */
  scannerDistractorId: string | null
  /** Primary 3D scanner mode: the astronaut physically holds the device. */
  scannerEquipped: boolean
  /**
   * Scan station: the explorer's parts hunt. The camera holds a fixed view
   * of the explorer, walking is paused and the reticle follows the pointer
   * until every part is found (set by MissionNarrativeController).
   */
  scanStation: boolean
  setScanStation: (active: boolean) => void
  /** 0..1 hold-to-scan progress for the current target. */
  scannerScanProgress: number
  /** Environmental target under the reticle, separate from mission parts. */
  scannerEnvironmentalId: string | null
  scannerTargetKind: 'component' | 'environmental' | null
  scannerPhysicalState: ScannerPhysicalState
  /** Result state for the current environmental target. */
  scannerAnalysis: 'idle' | 'quick' | 'detailed'
  /** Left mouse / touch hold while the scanner is equipped. */
  scannerTriggerHeld: boolean
  /**
   * Touch: a quick tap latched the scan on the current target so the finger
   * can lift. Always implies `scannerTriggerHeld`; releasing clears it.
   */
  scannerLatched: boolean
  /** Component explanation that temporarily blocks another historical scan. */
  historicalExplanationId: string | null
  /** Progressive radar: hidden during the first landing beat. */
  radarUnlocked: boolean
  /**
   * Guided Mars arrival briefing on screen (null = closed). While open the
   * world is paused and the HUD steps aside, except the radar PIP presents.
   */
  marsBriefingStep: BriefingStepId | null
  setMarsBriefingStep: (step: BriefingStepId | null) => void
  /** Arrival protocol: the scanner stays locked until the calibration station. */
  scannerLocked: boolean
  setScannerLocked: (locked: boolean) => void
  /** Memorial landmarks open only in free exploration (protocol M7). */
  landmarksLocked: boolean
  setLandmarksLocked: (locked: boolean) => void
  /** Short, skippable camera emphasis for sighting/identification. */
  cinematicFocus: {
    kind: 'sighting' | 'identification'
    target: { x: number; z: number }
    startedAt: number
    until: number
  } | null
  /** Component whose educational reading card is open. */
  scannerCardComponentId: string | null
  /** Optional mission records browser; shows the card/detail when set. */
  scannerRecordsOpen: boolean
  /** Ephemeral Archive overlay (full scan, smart letter, recreation). */
  archiveView: ArchiveView
  archiveMissionId: MissionId | null
  travelTargetId: MarsObjectId | null
  /** PIP's one-line orientation message (auto-expires in the UI). */
  pipMessage: string | null
  pipMessageKey: number
  /** Regions whose approach message has already been shown this session. */
  visitedRegions: Partial<Record<MarsObjectId, true>>
  startTravel: (id: MarsObjectId) => void
  cancelTravel: () => void
  setNearbySite: (id: MarsObjectId | null) => void
  setNearbySpirit: (nearby: boolean) => void
  setNearbyShip: (nearby: boolean) => void
  showPipMessage: (message: string) => void
  clearPipMessage: () => void
  markRegionVisited: (id: MarsObjectId) => void
  openNearbySite: () => void
  closeSite: () => void
  openScanner: (missionId: MissionId) => void
  closeScanner: () => void
  selectScannerComponent: (componentId: string | null) => void
  equipScanner: (missionId: MissionId) => void
  unequipScanner: () => void
  toggleScanner: (missionId: MissionId) => void
  setScannerTarget: (componentId: string | null) => void
  setScannerDistractorTarget: (distractorId: string | null) => void
  setScannerEnvironmentalTarget: (environmentalId: string | null) => void
  setScannerPhysicalState: (state: ScannerPhysicalState) => void
  setScannerAnalysis: (analysis: 'idle' | 'quick' | 'detailed') => void
  setScannerTrigger: (held: boolean) => void
  setScannerLatched: () => void
  setScannerScanProgress: (progress: number) => void
  setHistoricalExplanation: (cueId: string | null) => void
  setRadarUnlocked: (unlocked: boolean) => void
  startCinematic: (
    kind: 'sighting' | 'identification',
    target: { x: number; z: number },
    durationMs: number,
  ) => void
  endCinematic: () => void
  setScannerCamera: (camera: ScannerCamera) => void
  setAssistedScanEnabled: (enabled: boolean) => void
  openScannerCard: (componentId: string) => void
  closeScannerCard: () => void
  openScannerRecords: (
    missionId: MissionId,
    componentId?: string | null,
  ) => void
  openArchive: (view: Exclude<ArchiveView, 'none'>, missionId: MissionId) => void
  closeArchive: () => void
  setQuality: (quality: Quality) => void
  setReducedMotion: (reducedMotion: boolean) => void
  setVoiceEnabled: (enabled: boolean) => void
  setVoiceName: (name: string | null) => void
  setMasterVolume: (volume: number) => void
  setMusicVolume: (volume: number) => void
  setAmbienceVolume: (volume: number) => void
  setSfxVolume: (volume: number) => void
  setVoiceVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  openSettings: () => void
  closeSettings: () => void
}

const initialSettings = loadSettings()

export const useGameStore = create<GameState>((set, get) => {
  const persistSettings = () => {
    const state = get()
    saveSettings({
      quality: state.quality,
      reducedMotion: state.reducedMotion,
      voiceEnabled: state.voiceEnabled,
      voiceName: state.voiceName,
      scannerCamera: state.scannerCamera,
      assistedScanEnabled: state.assistedScanEnabled,
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      ambienceVolume: state.ambienceVolume,
      sfxVolume: state.sfxVolume,
      voiceVolume: state.voiceVolume,
      muted: state.muted,
    })
  }

  return {
  quality: initialSettings.quality,
  reducedMotion: initialSettings.reducedMotion,
  voiceEnabled: initialSettings.voiceEnabled,
  voiceName: initialSettings.voiceName,
  scannerCamera: initialSettings.scannerCamera,
  assistedScanEnabled: initialSettings.assistedScanEnabled,
  masterVolume: initialSettings.masterVolume,
  musicVolume: initialSettings.musicVolume,
  ambienceVolume: initialSettings.ambienceVolume,
  sfxVolume: initialSettings.sfxVolume,
  voiceVolume: initialSettings.voiceVolume,
  muted: initialSettings.muted,
  settingsOpen: false,
  nearbySiteId: null,
  activeSiteId: null,
  nearbySpirit: false,
  nearbyShip: false,
  setNearbyShip: (nearbyShip) => {
    if (get().nearbyShip === nearbyShip) return
    set({ nearbyShip })
  },
  scannerOpen: false,
  scannerMissionId: null,
  scannerSelectedComponentId: null,
  scanCelebration: null,
  scannerDistractorId: null,
  scannerEquipped: false,
  scanStation: false,
  scannerScanProgress: 0,
  scannerEnvironmentalId: null,
  scannerTargetKind: null,
  scannerPhysicalState: 'idle',
  scannerAnalysis: 'idle',
  scannerTriggerHeld: false,
  scannerLatched: false,
  historicalExplanationId: null,
  radarUnlocked: false,
  marsBriefingStep: null,
  setMarsBriefingStep: (marsBriefingStep) => {
    if (get().marsBriefingStep === marsBriefingStep) return
    clearInput()
    set({ marsBriefingStep })
  },
  scannerLocked: false,
  landmarksLocked: false,
  cinematicFocus: null,
  scannerCardComponentId: null,
  scannerRecordsOpen: false,
  archiveView: 'none',
  archiveMissionId: null,
  travelTargetId: null,
  pipMessage: null,
  pipMessageKey: 0,
  visitedRegions: {},
  showPipMessage: (message) => set((state) => ({ pipMessage: message, pipMessageKey: state.pipMessageKey + 1 })),
  clearPipMessage: () => set({ pipMessage: null }),
  markRegionVisited: (id) => set((state) => ({ visitedRegions: { ...state.visitedRegions, [id]: true } })),
  startTravel: (id) => {
    if (
      get().settingsOpen ||
      get().activeSiteId ||
      get().scannerOpen ||
      get().scannerEquipped ||
      get().scannerCardComponentId ||
      get().scannerRecordsOpen ||
      (get().archiveView !== 'none')
    ) {
      return
    }
    clearInput()
    set({ travelTargetId: id })
  },
  cancelTravel: () => set({ travelTargetId: null }),
  setNearbySite: (id) => {
    const state = get()
    if (state.nearbySiteId === id) return
    set({ nearbySiteId: id, ...(id ? { nearbySpirit: false } : {}) })
  },
  setNearbySpirit: (nearbySpirit) => {
    const state = get()
    if (state.nearbySpirit === nearbySpirit) return
    set({ nearbySpirit, ...(nearbySpirit ? { nearbySiteId: null } : {}) })
  },
  openNearbySite: () => {
    const state = get()
    if (
      state.landmarksLocked ||
      state.settingsOpen ||
      state.activeSiteId ||
      state.scannerOpen ||
      state.scannerEquipped ||
      state.scannerCardComponentId ||
      state.scannerRecordsOpen ||
      state.archiveView !== 'none' ||
      !state.nearbySiteId
    ) {
      return
    }
    clearInput()
    set({ activeSiteId: state.nearbySiteId, travelTargetId: null })
  },
  closeSite: () => {
    clearInput()
    set({ activeSiteId: null })
  },
  openScanner: (scannerMissionId) => {
    const state = get()
    if (
      state.settingsOpen ||
      state.activeSiteId ||
      state.scannerOpen ||
      state.scannerCardComponentId ||
      state.scannerRecordsOpen ||
      state.archiveView !== 'none'
    ) {
      return
    }
    clearInput()
    set({
      scannerOpen: true,
      scannerMissionId,
      scannerSelectedComponentId: null,
      scannerEnvironmentalId: null,
      scannerTargetKind: null,
      scannerPhysicalState: 'idle',
      scannerAnalysis: 'idle',
      scannerTriggerHeld: false,
      scannerLatched: false,
      scannerScanProgress: 0,
      travelTargetId: null,
    })
  },
  closeScanner: () => {
    const equipped = get().scannerEquipped
    clearInput()
    set({
      scannerOpen: false,
      scannerSelectedComponentId: null,
      scannerEnvironmentalId: null,
      scannerTargetKind: null,
      scannerPhysicalState: 'idle',
      scannerAnalysis: 'idle',
      scannerTriggerHeld: false,
      scannerLatched: false,
      scannerScanProgress: 0,
      ...(equipped ? {} : { scannerMissionId: null }),
    })
  },
  selectScannerComponent: (scannerSelectedComponentId) => {
    if (!get().scannerOpen) return
    set({ scannerSelectedComponentId })
  },
  equipScanner: (scannerMissionId) => {
    const state = get()
    if (
      state.scannerLocked ||
      state.settingsOpen ||
      state.activeSiteId ||
      state.scannerOpen ||
      state.scannerCardComponentId ||
      state.scannerRecordsOpen ||
      state.archiveView !== 'none'
    ) {
      return
    }
    // Movement keys stay held: equipping must not freeze the astronaut.
    set({
      scannerEquipped: true,
      scannerMissionId,
      scannerSelectedComponentId: null,
      scannerDistractorId: null,
      scannerEnvironmentalId: null,
      scannerTargetKind: null,
      scannerPhysicalState: 'idle',
      scannerAnalysis: 'idle',
      scannerScanProgress: 0,
      scannerTriggerHeld: false,
      scannerLatched: false,
      travelTargetId: null,
    })
  },
  setScanStation: (scanStation) => {
    if (get().scanStation === scanStation) return
    clearInput()
    set({ scanStation })
  },
  unequipScanner: () => {
    // Movement keys stay held here too; only scanner state is released.
    set({
      scannerEquipped: false,
      scannerMissionId: null,
      scannerSelectedComponentId: null,
      scannerDistractorId: null,
      scannerEnvironmentalId: null,
      scannerTargetKind: null,
      scannerPhysicalState: 'idle',
      scannerAnalysis: 'idle',
      scannerScanProgress: 0,
      scannerTriggerHeld: false,
      scannerLatched: false,
      scannerCardComponentId: null,
      scannerRecordsOpen: false,
    })
  },
  toggleScanner: (scannerMissionId) => {
    if (get().scannerEquipped) get().unequipScanner()
    else get().equipScanner(scannerMissionId)
  },
  setScannerTarget: (scannerSelectedComponentId) => {
    const state = get()
    if (!state.scannerEquipped && scannerSelectedComponentId !== null) return
    if (state.scannerSelectedComponentId === scannerSelectedComponentId) return
    set({
      scannerSelectedComponentId,
      scannerEnvironmentalId: null,
      ...(scannerSelectedComponentId ? { scannerDistractorId: null } : {}),
      scannerTargetKind: scannerSelectedComponentId ? 'component' : null,
      scannerPhysicalState: scannerSelectedComponentId ? 'valid' : 'idle',
      scannerAnalysis: 'idle',
      scannerScanProgress: 0,
    })
  },
  celebrateScan: (celebration) => {
    const seq = (get().scanCelebration?.seq ?? 0) + 1
    set({ scanCelebration: { ...celebration, seq } })
  },
  dismissScanCelebration: () => {
    if (get().scanCelebration === null) return
    set({ scanCelebration: null })
  },
  setScannerDistractorTarget: (scannerDistractorId) => {
    const state = get()
    if (!state.scannerEquipped && scannerDistractorId !== null) return
    if (state.scannerDistractorId === scannerDistractorId) return
    set({
      scannerDistractorId,
      ...(scannerDistractorId
        ? {
            scannerSelectedComponentId: null,
            scannerEnvironmentalId: null,
            scannerTargetKind: null,
            scannerPhysicalState: 'valid' as const,
            scannerAnalysis: 'idle' as const,
          }
        : {}),
      scannerScanProgress: 0,
    })
  },
  setScannerEnvironmentalTarget: (scannerEnvironmentalId) => {
    const state = get()
    if (!state.scannerEquipped && scannerEnvironmentalId !== null) return
    if (state.scannerEnvironmentalId === scannerEnvironmentalId) return
    set({
      scannerEnvironmentalId,
      scannerSelectedComponentId: null,
      ...(scannerEnvironmentalId ? { scannerDistractorId: null } : {}),
      scannerTargetKind: scannerEnvironmentalId ? 'environmental' : null,
      scannerPhysicalState: scannerEnvironmentalId ? 'valid' : 'idle',
      scannerAnalysis: 'idle',
      scannerScanProgress: 0,
    })
  },
  setScannerAnalysis: (scannerAnalysis) => {
    if (get().scannerAnalysis === scannerAnalysis) return
    set({ scannerAnalysis })
  },
  setScannerPhysicalState: (scannerPhysicalState) => {
    if (get().scannerPhysicalState === scannerPhysicalState) return
    set({ scannerPhysicalState })
  },
  setHistoricalExplanation: (historicalExplanationId) => {
    if (get().historicalExplanationId === historicalExplanationId) return
    set({ historicalExplanationId })
  },
  setLandmarksLocked: (landmarksLocked) => {
    if (get().landmarksLocked === landmarksLocked) return
    set({ landmarksLocked })
  },
  setScannerLocked: (scannerLocked) => {
    if (get().scannerLocked === scannerLocked) return
    set({ scannerLocked })
  },
  setRadarUnlocked: (radarUnlocked) => {
    if (get().radarUnlocked === radarUnlocked) return
    set({ radarUnlocked })
  },
  startCinematic: (kind, target, durationMs) => {
    const now = Date.now()
    set({
      cinematicFocus: {
        kind,
        target: { ...target },
        startedAt: now,
        until: now + Math.max(1000, durationMs),
      },
    })
  },
  endCinematic: () => {
    if (get().cinematicFocus === null) return
    set({ cinematicFocus: null })
  },
  setScannerTrigger: (scannerTriggerHeld) => {
    const state = get()
    if (!state.scannerEquipped) return
    if (state.scannerTriggerHeld === scannerTriggerHeld) return
    set({
      scannerTriggerHeld,
      // Releasing the trigger drops a touch latch. Progress is kept: letting
      // go early is never a penalty, the next hold continues from there.
      ...(scannerTriggerHeld ? {} : { scannerLatched: false }),
    })
  },
  setScannerLatched: () => {
    const state = get()
    if (!state.scannerEquipped || !state.scannerTriggerHeld) return
    if (state.scannerLatched) return
    set({ scannerLatched: true })
  },
  setScannerScanProgress: (progress) => {
    if (!get().scannerEquipped) return
    const scannerScanProgress = Math.min(1, Math.max(0, progress))
    if (get().scannerScanProgress === scannerScanProgress) return
    set({ scannerScanProgress })
  },
  openScannerCard: (scannerCardComponentId) => {
    clearInput()
    set({
      scannerRecordsOpen: true,
      scannerCardComponentId,
      scannerTriggerHeld: false,
      scannerLatched: false,
      scannerScanProgress: 0,
    })
  },
  openScannerRecords: (scannerMissionId, componentId = null) => {
    const state = get()
    if (
      state.settingsOpen ||
      state.activeSiteId ||
      state.archiveView !== 'none' ||
      state.scannerOpen
    ) {
      return
    }
    clearInput()
    set({
      scannerMissionId,
      scannerRecordsOpen: true,
      scannerCardComponentId: componentId,
      scannerEnvironmentalId: null,
      scannerTargetKind: null,
      scannerPhysicalState: 'idle',
      scannerAnalysis: 'idle',
      scannerTriggerHeld: false,
      scannerLatched: false,
      scannerScanProgress: 0,
      travelTargetId: null,
    })
  },
  closeScannerCard: () => {
    const equipped = get().scannerEquipped
    clearInput()
    set({
      scannerRecordsOpen: false,
      scannerCardComponentId: null,
      ...(equipped ? {} : { scannerMissionId: null }),
    })
  },
  openArchive: (archiveView, archiveMissionId) => {
    const state = get()
    if (state.settingsOpen || state.activeSiteId) return
    clearInput()
    set({
      archiveView,
      archiveMissionId,
      scannerOpen: false,
      scannerEquipped: false,
      scannerMissionId: null,
      scannerSelectedComponentId: null,
      scannerEnvironmentalId: null,
      scannerTargetKind: null,
      scannerPhysicalState: 'idle',
      scannerAnalysis: 'idle',
      scannerTriggerHeld: false,
      scannerLatched: false,
      scannerScanProgress: 0,
      scannerCardComponentId: null,
      scannerRecordsOpen: false,
      cinematicFocus: null,
      travelTargetId: null,
    })
  },
  closeArchive: () => {
    clearInput()
    set({ archiveView: 'none', archiveMissionId: null })
  },

  setQuality: (quality) => {
    set({ quality })
    persistSettings()
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion })
    persistSettings()
  },
  setVoiceEnabled: (voiceEnabled) => {
    set({ voiceEnabled })
    persistSettings()
  },
  setVoiceName: (voiceName) => {
    set({ voiceName })
    persistSettings()
  },
  setScannerCamera: (scannerCamera) => {
    set({ scannerCamera })
    persistSettings()
  },
  setAssistedScanEnabled: (assistedScanEnabled) => {
    set({ assistedScanEnabled })
    persistSettings()
  },
  setMasterVolume: (masterVolume) => {
    set({ masterVolume: clampVolume(masterVolume) })
    persistSettings()
  },
  setMusicVolume: (musicVolume) => {
    set({ musicVolume: clampVolume(musicVolume) })
    persistSettings()
  },
  setAmbienceVolume: (ambienceVolume) => {
    set({ ambienceVolume: clampVolume(ambienceVolume) })
    persistSettings()
  },
  setSfxVolume: (sfxVolume) => {
    set({ sfxVolume: clampVolume(sfxVolume) })
    persistSettings()
  },
  setVoiceVolume: (voiceVolume) => {
    set({ voiceVolume: clampVolume(voiceVolume) })
    persistSettings()
  },
  setMuted: (muted) => {
    set({ muted })
    persistSettings()
  },
  openSettings: () => {
    if (
      get().activeSiteId ||
      get().scannerOpen ||
      get().scannerCardComponentId ||
      get().scannerRecordsOpen ||
      (get().archiveView !== 'none')
    ) {
      return
    }
    clearInput()
    set({
      settingsOpen: true,
      travelTargetId: null,
      scannerEquipped: false,
      scannerMissionId: null,
      scannerSelectedComponentId: null,
      scannerEnvironmentalId: null,
      scannerTargetKind: null,
      scannerPhysicalState: 'idle',
      scannerAnalysis: 'idle',
      scannerTriggerHeld: false,
      scannerLatched: false,
      scannerScanProgress: 0,
      scannerCardComponentId: null,
      scannerRecordsOpen: false,
      cinematicFocus: null,
    })
  },
  closeSettings: () => {
    clearInput()
    set({ settingsOpen: false })
  },
  }
})

export function isWorldPaused(): boolean {
  const state = useGameStore.getState()
  return (
    isOnboardingActive() ||
    state.marsBriefingStep !== null ||
    state.settingsOpen ||
    state.activeSiteId !== null ||
    state.scannerOpen ||
    state.scannerCardComponentId !== null ||
    state.scannerRecordsOpen ||
    state.archiveView !== 'none'
  )
}
