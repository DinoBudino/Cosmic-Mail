import { useEffect, useRef } from 'react'
import {
  LATER_LINE,
  OFF_TRAIL_LINE,
  SAMPLE_LENS_LINE,
  STEP_ENTRY_LINES,
  CALIBRATION_SAMPLE,
  areFreeScansAllowed,
  hasReachedStation,
  hasWalkedEnough,
  isCalibrationSampleId,
  isOutsideCorridor,
  isRadarVisible,
  isScannerUnlocked,
  type ProtocolStep,
} from '../data/arrivalProtocol'
import { getEnvironmentalSite } from '../data/environmentalSites'
import { getMission } from '../data/missions'
import {
  getAmbientCue,
  getEnvironmentalCue,
  getFirstEnvironmentalScanCue,
  getApproachedCue,
  getArchiveCue,
  getComponentCue,
  getCompletionCues,
  getDetectedCue,
  getFullScanReadyCue,
  getIdentifiedCue,
  getLetterPreparedCue,
  getMissionEntryCue,
  getNewComponentIds,
  getReturnToShipCue,
  getSoftHintCue,
  scannedComponentCount,
  stageForProgress,
} from '../data/missionNarrative'
import { getFieldNotesView } from '../data/fieldNotes'
import { getRevisitExploreCue } from '../data/sliceClosure'
import { SPIRIT_SITE } from '../data/spiritSite'
import { emitAudio } from './audio/audioEvents'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import {
  requestProtocolLine,
  MISSION_APPROACH_RADIUS,
  MISSION_DETECT_RADIUS,
  MISSION_NARRATIVE_ID,
} from './missionNarrative'
import { stopPipVoice } from './pipVoice'
import { getCurrentProtocolStep } from './protocolStep'
import { playerPosition } from './playerPosition'
import { PLAYER } from './worldConfig'
import {
  createGuideTiming,
  noteAmbient,
  noteMovement,
  noteProgress,
  noteSoftHint,
  shouldOfferAmbient,
  shouldOfferSoftHint,
  type GuideTimingState,
} from './pipGuide'

/** True once the explorer is identified: far-sighting lines are then stale. */
function isMissionDiscovered(): boolean {
  return Boolean(
    useJourneyStore.getState().save?.missions[MISSION_NARRATIVE_ID]?.discovered,
  )
}

/**
 * Turns persistent mission progress and the player's world actions into
 * PIP's contextual narrative. It renders nothing: PipSpeech renders the
 * queue and Companion reacts to the ephemeral reaction/attention signals.
 *
 * Identity discipline: the far detection only says "something is there".
 * The journey store is not marked `discovered` by proximity: that only
 * happens when the player reaches the inspection ring and presses E
 * (`inspectSpirit`, called from SpiritInteraction). Only then can PIP say
 * Spirit's name.
 *
 * Repetition discipline: every cue has a stable id. Narrative lines are
 * once per visit, scan-start is once per component, interruptions have a
 * cooldown, and ambient lines are rare and capped.
 */
export function MissionNarrativeController() {
  const save = useJourneyStore((state) => state.save)
  const archiveView = useGameStore((state) => state.archiveView)
  const archiveMissionId = useGameStore((state) => state.archiveMissionId)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerCard = useGameStore((state) => state.scannerCardComponentId)
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const activeSiteId = useGameStore((state) => state.activeSiteId)

  const mission = getMission(MISSION_NARRATIVE_ID)
  const progress = save?.missions[MISSION_NARRATIVE_ID] ?? null
  const stage = stageForProgress(progress)

  const enteredRef = useRef(false)
  const detectedRef = useRef(false)
  const approachedRef = useRef(false)
  const approachAtRef = useRef(0)
  const previousScannedRef = useRef<string[]>([])
  const previousTransmittedRef = useRef(false)
  const previousLetterRef = useRef(false)
  const pendingCelebrateRef = useRef(false)
  const archiveWasOpenRef = useRef(false)
  const identifiedRef = useRef(false)
  const previousTargetRef = useRef<string | null>(null)
  const lastPlayerRef = useRef({ x: playerPosition.x, z: playerPosition.z })
  const lastStageRef = useRef(stage)
  const lastScannedCountRef = useRef(scannedComponentCount(progress))
  const guideTimingRef = useRef<GuideTimingState>(createGuideTiming(0))
  const enteredAtRef = useRef(0)
  const previousEnvironmentalRef = useRef<string[]>([])
  const previousEnvironmentalDetailedRef = useRef<string[]>([])
  const environmentalIntroShownRef = useRef(false)

  // A new Mars visit starts from a clean ephemeral narrative session.
  useEffect(
    () => () => {
      useNarrativeStore.getState().reset()
      stopPipVoice()
    },
    [],
  )

  // One entry/revisit line per mounted visit.
  useEffect(() => {
    if (enteredRef.current || !save) return
    enteredRef.current = true
    const cue = getMissionEntryCue(mission, progress)
    if (cue) useNarrativeStore.getState().enqueue(cue)
    // A restored mission is free exploration: field notes are the goal now.
    const notes = getFieldNotesView({
      environmentalDiscoveries: save.environmentalDiscoveries ?? [],
      memorialVisits: save.memorialVisits ?? [],
    })
    const exploreCue = getRevisitExploreCue(
      mission.id,
      progress,
      notes.totalCount - notes.unlockedCount,
    )
    if (exploreCue) useNarrativeStore.getState().enqueue(exploreCue)
    previousScannedRef.current = [...(progress?.scannedComponentIds ?? [])]
    previousTransmittedRef.current = Boolean(progress?.transmittedAt)
    previousLetterRef.current = Boolean(progress?.smartLetterCreatedAt)
    // A save that already knows the machine must never replay the anonymous
    // far-sighting lines on reload.
    detectedRef.current = Boolean(progress?.discovered)
    approachedRef.current = Boolean(progress?.discovered)
    identifiedRef.current = Boolean(progress?.discovered)
    lastStageRef.current = stageForProgress(progress)
    lastScannedCountRef.current = scannedComponentCount(progress)
    guideTimingRef.current = createGuideTiming(Date.now())
    lastPlayerRef.current = { x: playerPosition.x, z: playerPosition.z }
    enteredAtRef.current = Date.now()
    previousEnvironmentalRef.current = [
      ...(save.environmentalDiscoveries ?? []),
    ]
    previousEnvironmentalDetailedRef.current = [
      ...(save.environmentalDetailedDiscoveries ?? []),
    ]
  }, [save, mission, progress])

  // Detection, identification, scanner hints and voluntary guidance are
  // driven by the real player position and the real scanner state.
  useEffect(() => {
    if (!save) return

    const tick = () => {
      const currentSave = useJourneyStore.getState().save
      if (!currentSave) return
      const currentProgress = currentSave.missions[MISSION_NARRATIVE_ID]
      if (!currentProgress || currentProgress.transmittedAt) return

      const game = useGameStore.getState()
      const now = Date.now()
      let timing = guideTimingRef.current

      // Movement tracking: a player who keeps walking is exploring, not stuck.
      const dx = playerPosition.x - lastPlayerRef.current.x
      const dz = playerPosition.z - lastPlayerRef.current.z
      if (Math.hypot(dx, dz) > 0.35) {
        timing = noteMovement(timing, now)
      }
      lastPlayerRef.current = {
        x: playerPosition.x,
        z: playerPosition.z,
      }

      const currentStage = stageForProgress(currentProgress)
      const currentCount = scannedComponentCount(currentProgress)
      if (
        currentStage !== lastStageRef.current ||
        currentCount !== lastScannedCountRef.current
      ) {
        timing = noteProgress(timing, now)
        lastStageRef.current = currentStage
        lastScannedCountRef.current = currentCount
      }
      guideTimingRef.current = timing

      // Reading modals and site panels own the screen; no world dialogue and
      // no proactive help while the player is reading.
      if (
        game.settingsOpen ||
        game.scannerOpen ||
        game.scannerRecordsOpen ||
        game.scannerCardComponentId ||
        game.archiveView !== 'none' ||
        game.activeSiteId
      ) {
        guideTimingRef.current = {
          ...timing,
          lastProgressAt: now,
          lastMovementAt: now,
        }
        return
      }

      const narrative = useNarrativeStore.getState()
      const distance = Math.hypot(
        playerPosition.x - SPIRIT_SITE.position.x,
        playerPosition.z - SPIRIT_SITE.position.z,
      )

      const withinApproach =
        distance <= MISSION_APPROACH_RADIUS &&
        playerPosition.airborne <= PLAYER.inspectMaxHeight

      // Far sighting: a reaction, never the identity. If the player is
      // already at the inspection ring, skip it so the identification beat
      // is not pushed out of order.
      if (!detectedRef.current && distance <= MISSION_DETECT_RADIUS) {
        detectedRef.current = true
        if (!currentProgress.discovered && !withinApproach) {
          emitAudio('pipSurprised')
          const cue = getDetectedCue(mission)
          if (cue) {
            narrative.enqueue({ ...cue, cancelWhen: isMissionDiscovered })
          }
          narrative.react('detect', undefined, 2200)
          game.startCinematic(
            'sighting',
            {
              x: SPIRIT_SITE.position.x,
              z: SPIRIT_SITE.position.z,
            },
            4200,
          )
        }
      }

      // Inspection ring: this is the valid identification event, and it only
      // counts close to the ground so jet boots cannot skip it. The save is
      // updated first, then PIP may reconnect the historical record.
      if (!approachedRef.current && withinApproach) {
        approachedRef.current = true
        approachAtRef.current = now
        const wasDiscovered = Boolean(currentProgress.discovered)
        if (!wasDiscovered) {
          emitAudio('pipCurious')
          const approached = getApproachedCue(mission)
          if (approached) {
            narrative.enqueue({ ...approached, cancelWhen: isMissionDiscovered })
          }
          narrative.react('approach', undefined, 2400)
        } else {
          narrative.react('approach', undefined, 2400)
        }
      }

      // First time the reticle rests on a landscape feature, explain that the
      // same tool also reads optional environmental objects.
      if (
        game.scannerEquipped &&
        game.scannerEnvironmentalId &&
        !isCalibrationSampleId(game.scannerEnvironmentalId) &&
        areFreeScansAllowed(getCurrentProtocolStep(currentSave)) &&
        !environmentalIntroShownRef.current &&
        !narrative.current &&
        narrative.queue.length === 0
      ) {
        environmentalIntroShownRef.current = true
        narrative.enqueue(getFirstEnvironmentalScanCue())
      }

      // The reticle label, the scanner panel and the objective bar own the
      // aiming and holding feedback; PIP stays quiet there so nothing is said
      // twice. Only the reaction animation remains.
      const targetId = game.scannerSelectedComponentId
      if (targetId !== previousTargetRef.current) {
        previousTargetRef.current = targetId
        if (targetId && currentProgress.discovered) {
          narrative.react('scan', targetId, 2200)
        }
      }

      // Voluntary help: only after real time without progress AND with the
      // player genuinely stationary. It never fires during a cinematic or a
      // reading panel because this tick returned earlier.
      if (
        shouldOfferSoftHint(guideTimingRef.current, now) &&
        !game.scannerTriggerHeld &&
        game.scannerScanProgress === 0 &&
        !game.pipMessage &&
        !narrative.current &&
        narrative.queue.length === 0
      ) {
        const cue = getSoftHintCue(mission, currentProgress)
        if (cue) {
          guideTimingRef.current = noteSoftHint(guideTimingRef.current, now)
          narrative.enqueue(cue)
          narrative.react('hint', cue.componentId, 2400)
        }
      }

      // Rare environmental observations keep curiosity alive, but they never
      // interrupt a scan, an essential line or a reading panel.
      const spiritDistance = distance
      if (
        currentProgress.discovered &&
        !game.scannerEquipped &&
        !game.nearbySiteId &&
        !game.historicalExplanationId &&
        currentStage !== 'transmitted' &&
        spiritDistance > SPIRIT_SITE.ringRadius + 4 &&
        shouldOfferAmbient(guideTimingRef.current, now) &&
        !narrative.current &&
        narrative.queue.length === 0
      ) {
        const cue = getAmbientCue(
          mission,
          guideTimingRef.current.ambientShown,
        )
        if (cue) {
          guideTimingRef.current = noteAmbient(guideTimingRef.current, now)
          narrative.enqueue(cue)
        }
      }
    }

    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [save, mission])

  // Arrival protocol: flags, gates and one line per step. Everything here is
  // derived from the journey save plus ephemeral flags, so a reload resumes
  // at the right step. It runs even after transmission (M7 opens the world).
  const lastStepRef = useRef<ProtocolStep | null>(null)
  useEffect(() => {
    if (!save) return
    const tick = () => {
      const currentSave = useJourneyStore.getState().save
      if (!currentSave) return
      const narrative = useNarrativeStore.getState()
      const game = useGameStore.getState()
      const currentProgress = currentSave.missions[MISSION_NARRATIVE_ID]

      // Ephemeral facts earned by playing; only before the explorer is known.
      if (!currentProgress?.discovered) {
        if (!narrative.protocol.walked && hasWalkedEnough(playerPosition)) {
          narrative.markProtocol('walked')
        }
        const afterWalk = useNarrativeStore.getState().protocol
        if (
          afterWalk.walked &&
          !afterWalk.stationReached &&
          hasReachedStation(playerPosition)
        ) {
          narrative.markProtocol('stationReached')
        }
      }

      const step = getCurrentProtocolStep(currentSave)
      game.setRadarUnlocked(isRadarVisible(step))
      game.setScannerLocked(!isScannerUnlocked(step))
      game.setLandmarksLocked(!areFreeScansAllowed(step))
      narrative.setAmbientAllowed(areFreeScansAllowed(step))
      if (!isScannerUnlocked(step) && game.scannerEquipped) {
        game.unequipScanner()
      }

      const previous = lastStepRef.current
      if (previous !== step) {
        lastStepRef.current = step
        // The first observed step is the starting point (landing line or a
        // resumed save): only real transitions get a new line.
        const entry = STEP_ENTRY_LINES[step]
        if (previous !== null && entry) {
          narrative.enqueue({
            id: entry.id,
            text: entry.text,
            priority: 'mission',
            expression: 'focused',
            tier: 0,
            // Cancelled if the player has already moved on to another step.
            cancelWhen: () => getCurrentProtocolStep() !== step,
          })
        }
      }

      const quiet =
        game.settingsOpen ||
        game.scannerOpen ||
        game.scannerRecordsOpen ||
        game.scannerCardComponentId ||
        game.archiveView !== 'none' ||
        game.activeSiteId

      if (!quiet) {
        if (isOutsideCorridor(step, playerPosition)) {
          requestProtocolLine(OFF_TRAIL_LINE, 25_000)
        }
        if (game.nearbySiteId && game.landmarksLocked) {
          requestProtocolLine(LATER_LINE, 30_000)
        }
        if (
          step === 'M2' &&
          game.scannerEquipped &&
          game.scannerEnvironmentalId === CALIBRATION_SAMPLE.id &&
          game.scannerLens !== CALIBRATION_SAMPLE.lens
        ) {
          // The sample's lens is explained once, in the open.
          requestProtocolLine(SAMPLE_LENS_LINE, Number.MAX_SAFE_INTEGER)
        }
      }
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [save])

  // A new record produces exactly one explanation, even through assisted review.
  useEffect(() => {
    if (!save) return
    const scanned = progress?.scannedComponentIds ?? []
    const previous = previousScannedRef.current
    const newIds = getNewComponentIds(scanned, previous)

    // A scanner-first identification (possible at the edge of range) must
    // still get PIP's archive reconnection beat before the component story.
    if (progress?.discovered && !identifiedRef.current) {
      identifiedRef.current = true
      const identified = getIdentifiedCue(mission)
      if (identified && useNarrativeStore.getState().enqueue(identified)) {
        useGameStore.getState().setHistoricalExplanation(identified.id)
        useGameStore.getState().startCinematic(
          'identification',
          {
            x: SPIRIT_SITE.position.x,
            z: SPIRIT_SITE.position.z,
          },
          5200,
        )
      }
    }

    if (newIds.length > 0) {
      const narrative = useNarrativeStore.getState()
      const assistOpen = useGameStore.getState().scannerOpen
      for (const id of newIds) {
        if (!assistOpen) {
          const cue = getComponentCue(mission, id)
          if (cue && narrative.enqueue(cue)) {
            // Marks the explanation as active so ambient lines wait for it.
            // It never blocks scanning: the player can always keep going.
            useGameStore.getState().setHistoricalExplanation(cue.id)
          }
          narrative.showAttention(id, 'scan', 2600)
          narrative.react('scan', id)
        }
      }
      if (scannedComponentCount(progress) === mission.components.length) {
        emitAudio('pipCelebrate')
        for (const cue of getCompletionCues(mission)) narrative.enqueue(cue)
        const ready = getFullScanReadyCue(mission)
        if (ready) narrative.enqueue(ready)
      }
      useNarrativeStore
        .getState()
        .markSpoken(`${MISSION_NARRATIVE_ID}:target-detected`)
    }

    const hasLetter = Boolean(progress?.smartLetterCreatedAt)
    if (hasLetter && !previousLetterRef.current) {
      // The smart-letter dialog owns the first delivery of this line while
      // it is open; the world gets it once after the player closes it.
      if (archiveView === 'none') {
        previousLetterRef.current = true
        const narrative = useNarrativeStore.getState()
        const cue = getLetterPreparedCue(mission)
        if (cue) narrative.enqueue(cue)
        const back = getReturnToShipCue(mission)
        if (back) narrative.enqueue(back)
      }
    } else if (!hasLetter) {
      previousLetterRef.current = false
    }

    const transmitted = Boolean(progress?.transmittedAt)
    if (transmitted && !previousTransmittedRef.current) {
      previousTransmittedRef.current = true
      pendingCelebrateRef.current = true
    } else if (!transmitted) {
      previousTransmittedRef.current = false
    }

    previousScannedRef.current = [...scanned]
  }, [save, mission, progress, archiveView])

  // Optional environmental readings. They use the same queue, but ambient
  // priority means they can never delay or interrupt a historical beat.
  useEffect(() => {
    if (!save) return
    const quick = save.environmentalDiscoveries ?? []
    const detailed = save.environmentalDetailedDiscoveries ?? []
    const previousQuick = previousEnvironmentalRef.current
    const previousDetailed = previousEnvironmentalDetailedRef.current
    const newDetailed = detailed.filter((id) => !previousDetailed.includes(id))
    const newQuick = quick.filter(
      (id) => !previousQuick.includes(id) && !newDetailed.includes(id),
    )

    // One short P3 comment per observation, free exploration only. The
    // detailed reading lives in the reading card and the passport field notes.
    const narrative = useNarrativeStore.getState()
    if (areFreeScansAllowed(getCurrentProtocolStep(save))) {
      for (const id of [...newQuick, ...newDetailed]) {
        const site = getEnvironmentalSite(id)
        if (!site) continue
        narrative.enqueue(getEnvironmentalCue(id, false, site.shortLine))
      }
    }

    previousEnvironmentalRef.current = [...quick]
    previousEnvironmentalDetailedRef.current = [...detailed]
  }, [save])

  // Release the historical-scan lock when the explanation is no longer
  // current or queued: natural voice end, subtitle timer or explicit Skip.
  useEffect(() => {
    return useNarrativeStore.subscribe((state) => {
      const activeId = useGameStore.getState().historicalExplanationId
      if (!activeId) return
      const pending =
        state.current?.id === activeId ||
        state.queue.some((line) => line.id === activeId)
      if (!pending) {
        useGameStore.getState().setHistoricalExplanation(null)
      }
    })
  }, [])

  // The archive overlays own PIP's panel; world dialogue yields to them.
  useEffect(() => {
    const openForMission =
      archiveView === 'smart-letter' && archiveMissionId === MISSION_NARRATIVE_ID

    if (openForMission && !archiveWasOpenRef.current) {
      useNarrativeStore.getState().clearDialogue()
      stopPipVoice()
    }
    archiveWasOpenRef.current = openForMission

    if (openForMission) {
      useNarrativeStore
        .getState()
        .setArchiveLine(getArchiveCue(mission, progress))
    }
  }, [archiveView, archiveMissionId, mission, progress])

  useEffect(() => {
    if (archiveView === 'smart-letter') return
    useNarrativeStore.getState().setArchiveLine(null)
  }, [archiveView])

  // A transmission completed while the modal was open becomes a small
  // world celebration.
  useEffect(() => {
    if (archiveView !== 'none' || !pendingCelebrateRef.current) return
    pendingCelebrateRef.current = false
    useNarrativeStore
      .getState()
      .react('celebrate', undefined, 2600)
  }, [archiveView])

  // Reading/settings panels pause and clear world dialogue.
  useEffect(() => {
    if (
      !settingsOpen &&
      !scannerOpen &&
      !scannerCard &&
      !scannerRecordsOpen &&
      !activeSiteId &&
      archiveView === 'none'
    ) {
      return
    }
    useNarrativeStore.getState().clearDialogue()
    stopPipVoice()
  }, [
    settingsOpen,
    scannerOpen,
    scannerCard,
    scannerRecordsOpen,
    activeSiteId,
    archiveView,
  ])

  return null
}
