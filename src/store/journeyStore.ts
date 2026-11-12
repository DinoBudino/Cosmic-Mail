/**
 * Zustand wrapper around JourneySave. The store is intentionally thin:
 * all A progression rules live in journeyLogic.ts and all
 * validation/storage rules live in journeySchema.ts.
 *
 * The factory accepts a StorageLike so tests can simulate a reload
 * without touching the browser's real localStorage.
 */

import { create } from 'zustand'
import type { DestinationId, MissionId } from '../data/missions'
import {
  createJourney,
  getBrowserStorage,
  loadJourney,
  removeJourney,
  saveJourney,
  type JourneyLoadStatus,
  type JourneySave,
  type StorageLike,
} from './journeySchema'
import {
  completeFullScan as applyFullScan,
  markFinalQuoteShown as applyFinalQuoteShown,
  markIntroSeen as applyIntroSeen,
  markMissionDiscovered,
  markOnboardingComplete as applyOnboardingComplete,
  markReconstructionWatched as applyReconstructionWatched,
  prepareSmartLetter as applyPrepareSmartLetter,
  recordEnvironmentalScan as applyEnvironmentalScan,
  resetMissionProgress,
  scanComponent as applyScan,
  setCurrentDestination,
  transmitLetter as applyTransmitLetter,
  type EnvironmentalScanResult,
  type FullScanResult,
  type ScanResult,
  type SmartLetterResult,
  type TransmissionResult,
} from './journeyLogic'

export interface JourneyState {
  save: JourneySave | null
  loadStatus: JourneyLoadStatus
  /** Whether the last write reached storage. */
  persisted: boolean
  hydrate: () => JourneyLoadStatus
  startJourney: (playerName: string) => boolean
  setDestination: (destination: DestinationId) => boolean
  markIntroSeen: () => boolean
  completeOnboarding: () => boolean
  showFinalQuote: () => boolean
  scan: (missionId: MissionId, componentId: string) => ScanResult | null
  recordEnvironmentalScan: (
    siteId: string,
    detailed: boolean,
  ) => EnvironmentalScanResult | null
  discoverMission: (missionId: MissionId) => boolean
  completeFullScan: (missionId: MissionId) => FullScanResult | null
  prepareSmartLetter: (missionId: MissionId) => SmartLetterResult | null
  markReconstructionWatched: (missionId: MissionId) => boolean
  transmit: (missionId: MissionId) => TransmissionResult | null
  resetMission: (missionId: MissionId) => boolean
  resetJourney: () => boolean
}

export type JourneyStore = ReturnType<typeof createJourneyStore>

export function createJourneyStore(storage: StorageLike | null) {
  const read = () => loadJourney(storage)
  const initial = read()

  return create<JourneyState>((set, get) => {
    const commit = (next: JourneySave): boolean => {
      const persisted = saveJourney(storage, next)
      set({ save: next, persisted })
      return persisted
    }

    return {
      save: initial.save,
      loadStatus: initial.status,
      persisted: initial.persisted,

      hydrate: () => {
        const result = read()
        set({
          save: result.save,
          loadStatus: result.status,
          persisted: result.persisted,
        })
        return result.status
      },

      startJourney: (playerName) => {
        let save: JourneySave
        try {
          save = createJourney(playerName)
        } catch {
          return false
        }
        const persisted = saveJourney(storage, save)
        set({ save, loadStatus: 'loaded', persisted })
        return true
      },

      setDestination: (destination) => {
        const save = get().save
        if (!save) return false
        return commit(setCurrentDestination(save, destination))
      },

      markIntroSeen: () => {
        const save = get().save
        if (!save) return false
        return commit(applyIntroSeen(save))
      },

      completeOnboarding: () => {
        const save = get().save
        if (!save) return false
        return commit(applyOnboardingComplete(save))
      },

      showFinalQuote: () => {
        const save = get().save
        if (!save || save.finalQuoteShown) return false
        return commit(applyFinalQuoteShown(save))
      },

      scan: (missionId, componentId) => {
        const save = get().save
        if (!save) return null
        const result = applyScan(save, missionId, componentId)
        if (result.status === 'scanned') commit(result.save)
        return result
      },

      recordEnvironmentalScan: (siteId, detailed) => {
        const save = get().save
        if (!save) return null
        const result = applyEnvironmentalScan(save, siteId, detailed)
        if (result.status === 'quick' || result.status === 'detailed') {
          commit(result.save)
        }
        return result
      },

      discoverMission: (missionId) => {
        const save = get().save
        if (!save) return false
        const next = markMissionDiscovered(save, missionId)
        if (next === save) return true
        commit(next)
        // Discovery succeeded in memory even when storage is unavailable.
        return true
      },

      completeFullScan: (missionId) => {
        const save = get().save
        if (!save) return null
        const result = applyFullScan(save, missionId)
        if (result.status === 'memory-recovered') commit(result.save)
        return result
      },

      prepareSmartLetter: (missionId) => {
        const save = get().save
        if (!save) return null
        const result = applyPrepareSmartLetter(save, missionId)
        if (result.status === 'created') commit(result.save)
        return result
      },

      markReconstructionWatched: (missionId) => {
        const save = get().save
        if (!save) return false
        const result = applyReconstructionWatched(save, missionId)
        if (result.status === 'watched') commit(result.save)
        return result.status === 'watched' || result.status === 'already-watched'
      },

      transmit: (missionId) => {
        const save = get().save
        if (!save) return null
        const result = applyTransmitLetter(save, missionId)
        if (result.status === 'transmitted') commit(result.save)
        return result
      },

      resetMission: (missionId) => {
        const save = get().save
        if (!save) return false
        return commit(resetMissionProgress(save, missionId))
      },

      resetJourney: () => {
        const persisted = removeJourney(storage)
        set({ save: null, loadStatus: 'empty', persisted })
        return persisted
      },
    }
  })
}

export const useJourneyStore = createJourneyStore(getBrowserStorage())
