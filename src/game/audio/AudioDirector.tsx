import { useCallback, useEffect, useRef, useState } from 'react'
import { INTRO_BEATS } from '../../data/onboardingNarrative'
import { MISSION_IDS, type MissionId } from '../../data/missions'
import { SPIRIT_SITE } from '../../data/spiritSite'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { areAllMissionsComplete } from '../../store/journeyLogic'
import { applyPipVoiceVolume } from '../pipVoice'
import { audioManager } from './audioManager'
import { emitAudio } from './audioEvents'
import {
  sceneAmbienceFor,
  sceneMusicFor,
  type MusicCueId,
} from './musicCues'
import {
  diffMissionAudio,
  snapshotFromProgress,
  type MissionAudioSnapshot,
} from './audioProgress'
import { stepScannerAudio } from './scannerAudio'
import type { DestinationId } from '../../data/missions'

const FIRST_FAULT_BEAT = Math.max(
  0,
  INTRO_BEATS.findIndex((beat) => beat.hologram === 'losing1'),
)
const HOPE_BEAT = Math.max(
  0,
  INTRO_BEATS.findIndex((beat) => beat.moment === 'hope'),
)
const UI_HOVER_SELECTOR =
  'button, [role="button"], a[href], summary, [data-audio-hover]'
const UI_CLICK_SELECTOR =
  'button, [role="button"], a[href], summary, [data-audio-click]'
const CRITICAL_PRELOAD = [
  'ui.hoverLow',
  'ui.clickLow',
  'ui.confirm',
  'ui.error',
  'pip.attention',
  'pip.curious',
  'scanner.start',
  'scanner.fragment',
  'player.footstepRock1',
  'player.footstepRock2',
  'player.footstepRock3',
  'player.footstepRock4',
  'player.scannerEquip',
] as const

/**
 * One React bridge between game state and the Audio Manager. It is the
 * only component allowed to decide scene music/ambience, and it emits
 * idempotent domain events when persistent progress changes.
 */
export function AudioDirector() {
  const phase = useOnboardingStore((state) => state.phase)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)
  const selectedDestination = useOnboardingStore(
    (state) => state.selectedDestination,
  )
  const passportDetailOpen = useOnboardingStore(
    (state) => state.passportDetailOpen,
  )
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerMissionId = useGameStore((state) => state.scannerMissionId)
  const scannerSelected = useGameStore(
    (state) => state.scannerSelectedComponentId,
  )
  const scannerProgress = useGameStore((state) => state.scannerScanProgress)
  const scannerTriggerHeld = useGameStore((state) => state.scannerTriggerHeld)
  const scannerAnalysis = useGameStore((state) => state.scannerAnalysis)
  const archiveView = useGameStore((state) => state.archiveView)
  const masterVolume = useGameStore((state) => state.masterVolume)
  const musicVolume = useGameStore((state) => state.musicVolume)
  const ambienceVolume = useGameStore((state) => state.ambienceVolume)
  const sfxVolume = useGameStore((state) => state.sfxVolume)
  const voiceVolume = useGameStore((state) => state.voiceVolume)
  const muted = useGameStore((state) => state.muted)

  const save = useJourneyStore((state) => state.save)
  const destination: DestinationId = save?.currentDestination ?? 'mars'
  const allMissionsComplete = save ? areAllMissionsComplete(save) : false
  const finalQuoteShown = save?.finalQuoteShown ?? false

  const [musicOverride, setMusicOverride] = useState<MusicCueId | null>(null)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const overrideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearOverride = useCallback(() => {
    setMusicOverride(null)
    if (overrideTimer.current) {
      clearTimeout(overrideTimer.current)
      overrideTimer.current = null
    }
  }, [])

  const setTemporaryMusic = useCallback((cue: MusicCueId, ms: number) => {
    setMusicOverride(cue)
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => {
      overrideTimer.current = null
      setMusicOverride(null)
    }, ms)
  }, [])

  const sceneCue = sceneMusicFor({
    phase,
    dialogueIndex,
    destination,
    archiveView,
    allMissionsComplete,
    finalQuoteShown,
  })
  const sceneAmbience = sceneAmbienceFor({ phase, destination })
  const effectiveCue = musicOverride ?? sceneCue

  /* -------------------------------------------------------------- mixer */

  useEffect(() => {
    audioManager.setVolumes({
      masterVolume,
      musicVolume,
      ambienceVolume,
      sfxVolume,
      voiceVolume,
      muted,
    })
    applyPipVoiceVolume()
  }, [
    masterVolume,
    musicVolume,
    ambienceVolume,
    sfxVolume,
    voiceVolume,
    muted,
  ])

  useEffect(() => {
    audioManager.setFocusDucked(settingsOpen)
  }, [settingsOpen])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => audioManager.setPageHidden(document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  /* ------------------------------------------------------------ autoplay */

  const unlockAudio = useCallback(() => {
    void audioManager.unlock().then(() => {
      audioManager.preload(CRITICAL_PRELOAD)
      setAudioUnlocked(
        audioManager.getDebugState().contextState === 'running',
      )
    })
  }, [setAudioUnlocked])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('pointerdown', unlockAudio, { passive: true })
    window.addEventListener('keydown', unlockAudio)
    window.addEventListener('touchstart', unlockAudio, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }
  }, [unlockAudio])

  useEffect(
    () => () => {
      if (overrideTimer.current) clearTimeout(overrideTimer.current)
      audioManager.stopAll()
    },
    [],
  )

  /* --------------------------------------------------------- global UI sfx */

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPointerOver = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest(UI_HOVER_SELECTOR)) return
      emitAudio('uiHover', {
        dedupeKey: 'global-ui-hover',
        dedupeMs: 110,
        volume: 0.55,
      })
    }
    const onClick = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest(UI_CLICK_SELECTOR)) return
      emitAudio('uiClick', {
        dedupeKey: 'global-ui-click',
        dedupeMs: 45,
        volume: 0.6,
      })
    }
    window.addEventListener('pointerover', onPointerOver, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerover', onPointerOver, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [])

  /* ----------------------------------------------------------- scene beds */

  useEffect(() => {
    void audioManager.playMusic(effectiveCue)
  }, [effectiveCue])

  useEffect(() => {
    void audioManager.playAmbience(sceneAmbience)
  }, [sceneAmbience])

  /* ------------------------------------------------------ phase transitions */

  const previousPhase = useRef(phase)
  useEffect(() => {
    const previous = previousPhase.current
    if (previous === phase) return
    previousPhase.current = phase

    audioManager.stopAllLoops(0.12)
    clearOverride()

    if (previous === 'menu' && phase === 'intro') {
      emitAudio('introStarted')
    } else if (previous === 'intro' && phase === 'registration') {
      emitAudio('registrationStarted')
    } else if (previous === 'registration' && phase === 'hub') {
      emitAudio('hubEntered')
    } else if (previous === 'hub' && phase === 'launching') {
      emitAudio('launchStarted')
    } else if (previous === 'launching' && phase === 'playing') {
      emitAudio('playerLanded')
    } else if (previous === 'playing' && phase === 'hub') {
      emitAudio('returnedToShip')
    }
  }, [phase, clearOverride])

  /* ------------------------------------------------------------ intro beats */

  const previousBeat = useRef(dialogueIndex)
  useEffect(() => {
    const previous = previousBeat.current
    previousBeat.current = dialogueIndex
    if (phase !== 'intro' || previous === dialogueIndex) return

    if (previous < HOPE_BEAT && dialogueIndex >= HOPE_BEAT) {
      emitAudio('archiveClueRecovered')
    } else if (
      previous < FIRST_FAULT_BEAT &&
      dialogueIndex >= FIRST_FAULT_BEAT
    ) {
      emitAudio('archiveFaultStarted')
    }
  }, [dialogueIndex, phase])

  /* ------------------------------------------------------ persistent progress */

  const progressSnapshots = useRef(
    new Map<MissionId, MissionAudioSnapshot>(),
  )
  useEffect(() => {
    if (!save) return
    for (const missionId of MISSION_IDS) {
      const next = snapshotFromProgress(save.missions[missionId])
      const previous = progressSnapshots.current.get(missionId)
      if (!previous) {
        progressSnapshots.current.set(missionId, next)
        continue
      }
      const events = new Set(diffMissionAudio(previous, next))
      if (events.has('fragmentRecovered')) {
        emitAudio('archiveFragmentRecovered')
      }
      if (events.has('memoryRecovered')) {
        emitAudio('memoryRecovered')
        setTemporaryMusic('memory', 12000)
      }
      if (events.has('smartLetterCreated')) {
        emitAudio('smartLetterCreated')
      }
      if (events.has('transmissionCompleted')) {
        emitAudio('transmissionCompleted')
        setTemporaryMusic('transmission', 10000)
      }
      progressSnapshots.current.set(missionId, next)
    }
  }, [save, setTemporaryMusic])

  /* ---------------------------------------------------------- archive views */

  const previousArchive = useRef(archiveView)
  useEffect(() => {
    const previous = previousArchive.current
    if (previous === archiveView) return
    previousArchive.current = archiveView

    if (archiveView !== 'none' && previous === 'none') {
      emitAudio('archiveActivated')
    }

    if (archiveView === 'smart-letter') {
      clearOverride()
      emitAudio('smartLetterOpened')
    } else if (archiveView === 'reconstruction') {
      clearOverride()
      emitAudio('reconstructionOpened')
    } else if (archiveView === 'full-scan') {
      emitAudio('fullScanOpened')
    } else if (archiveView === 'none' && previous !== 'none') {
      if (previous === 'reconstruction') emitAudio('reconstructionClosed')
      else if (previous === 'smart-letter') emitAudio('smartLetterClosed')
      else emitAudio('archiveClosed')
    }
  }, [archiveView, clearOverride])

  /* ------------------------------------------------------------- scanner */

  const previousTarget = useRef<string | null>(null)
  useEffect(() => {
    const previous = previousTarget.current
    previousTarget.current = scannerSelected
    if (scannerSelected && scannerSelected !== previous) {
      emitAudio('scannerTargetAcquired')
    } else if (!scannerSelected && previous && scannerEquipped) {
      emitAudio('scannerTargetLost')
    }
  }, [scannerSelected, scannerEquipped])

  const previousScanProgress = useRef(0)
  const halfTickPlayed = useRef(false)
  useEffect(() => {
    const previous = previousScanProgress.current
    previousScanProgress.current = scannerProgress

    const step = stepScannerAudio(
      previous,
      scannerProgress,
      halfTickPlayed.current,
    )
    halfTickPlayed.current = step.halfPlayed
    for (const event of step.events) {
      if (event === 'scanStarted') emitAudio('scanStarted')
      if (event === 'scanProgressHalf') emitAudio('scanProgressHalf')
      if (
        event === 'scanInterrupted' &&
        scannerAnalysis === 'idle'
      ) {
        // Releasing after a successful environmental quick reading is not
        // an interruption.
        emitAudio('scanInterrupted')
      }
      if (event === 'scanCompleted') emitAudio('scanCompleted')
    }
    if (step.stopLoop) audioManager.stopLoop('scanner')
    if (!scannerEquipped && scannerProgress === 0) {
      audioManager.stopLoop('scanner')
    }
  }, [scannerProgress, scannerEquipped, scannerAnalysis])

  const scannerEquippedKnown = useRef(false)
  useEffect(() => {
    if (!scannerEquippedKnown.current) {
      scannerEquippedKnown.current = true
      return
    }
    emitAudio(scannerEquipped ? 'scannerEquipped' : 'scannerUnequipped')
  }, [scannerEquipped])

  const alreadyScanned = Boolean(
    scannerSelected &&
      save?.missions[
        scannerMissionId ?? SPIRIT_SITE.missionId
      ]?.scannedComponentIds.includes(scannerSelected),
  )
  useEffect(() => {
    if (!scannerTriggerHeld || !alreadyScanned || !scannerSelected) return
    emitAudio('scanAlreadyRegistered', {
      dedupeKey: `already:${scannerSelected}`,
      dedupeMs: 1600,
    })
  }, [scannerTriggerHeld, alreadyScanned, scannerSelected])

  /* ---------------------------------------------------------- hub controls */

  const previousRouteOpen = useRef(routeOpen)
  useEffect(() => {
    if (phase !== 'hub') {
      previousRouteOpen.current = routeOpen
      return
    }
    if (routeOpen !== previousRouteOpen.current) {
      previousRouteOpen.current = routeOpen
      emitAudio(routeOpen ? 'navigationOpened' : 'navigationClosed')
    }
  }, [routeOpen, phase])

  const previousPassportOpen = useRef(passportDetailOpen)
  useEffect(() => {
    if (phase !== 'hub') {
      previousPassportOpen.current = passportDetailOpen
      return
    }
    if (passportDetailOpen !== previousPassportOpen.current) {
      previousPassportOpen.current = passportDetailOpen
      emitAudio(passportDetailOpen ? 'passportOpened' : 'passportClosed')
    }
  }, [passportDetailOpen, phase])

  const previousDestination = useRef(selectedDestination)
  useEffect(() => {
    if (selectedDestination && selectedDestination !== previousDestination.current) {
      emitAudio('destinationSelected')
    }
    previousDestination.current = selectedDestination
  }, [selectedDestination])

  const previousRouteConfirmed = useRef(routeConfirmed)
  useEffect(() => {
    if (routeConfirmed && !previousRouteConfirmed.current) {
      emitAudio('routeConfirmed')
    }
    previousRouteConfirmed.current = routeConfirmed
  }, [routeConfirmed])

  const previousSettings = useRef(settingsOpen)
  useEffect(() => {
    if (settingsOpen !== previousSettings.current) {
      previousSettings.current = settingsOpen
      emitAudio(settingsOpen ? 'settingsOpened' : 'settingsClosed')
    }
  }, [settingsOpen])

  // Browsers block audio until a gesture. Show an honest, dismissible hint
  // instead of leaving the menu mysteriously silent.
  if (phase === 'menu' && !audioUnlocked) {
    return (
      <button
        type="button"
        className="audio-start-hint"
        onClick={unlockAudio}
      >
        <span aria-hidden="true">♪</span> Click anywhere to start the music
      </button>
    )
  }

  return null
}
