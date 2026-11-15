import type { MissionId } from '../data/missions'
import { useEffect, useRef } from 'react'
import {
  LATER_LINE,
  OFF_TRAIL_LINE,
  STEP_ENTRY_LINES,
  areFreeScansAllowed,
  hasReachedStation,
  hasWalkedEnough,
  isCalibrationActive,
  isCalibrationSampleId,
  isOutsideCorridor,
  isRadarVisible,
  isScannerUnlocked,
  isStepAtLeast,
  needsArrivalBriefing,
  type ProtocolStep,
  hasPriorFieldWork,
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
  getCompletionCue,
  getDetectedCue,
  getHuntClueCue,
  getHuntTarget,
  getIdentifiedCue,
  getMissionEntryCue,
  getNewComponentIds,
  getReturnToShipCue,
  getScannerPromptCue,
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
import { useOnboardingStore } from '../store/onboardingStore'
import {
  isCoarsePointer,
  requestProtocolLine,
  withTipDone,
  MISSION_APPROACH_RADIUS,
  MISSION_DETECT_RADIUS,
} from './missionNarrative'
import { stopPipVoice } from './pipVoice'
import { getCurrentProtocolStep } from './protocolStep'
import { playerPosition } from './playerPosition'
import { faceOrbitToward } from './cameraRig'
import { getGuideLane } from './practiceGuide'
import { CALIBRATION_SAMPLE, PRACTICE_STATION_VIEW } from '../data/calibrationSample'
import type { ScanStationTarget } from '../store/gameStore'
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
    useJourneyStore.getState().save?.missions[SPIRIT_SITE.missionId]?.discovered,
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
 * Guidance discipline: one action at a time. Arriving → "press E"; once
 * identified → "take out the scanner"; scanner out → one clue per part.
 * Every cue has a stable id, so nothing repeats within a visit.
 */
/**
 * After the last part: PIP finishes the explanation and the celebration,
 * the scan station ends, the scanner goes away and the Cosmic Album opens
 * on the explorer's card, where PIP guides sealing, watching and sending
 * its story. Nothing to walk to, nothing extra to scan.
 */
function openTabletAfter(cueId: string | null, missionId: MissionId): void {
  const startedAt = performance.now()
  let unsubscribe: (() => void) | null = null
  let done = false
  const open = () => {
    if (done) return
    done = true
    unsubscribe?.()
    window.clearTimeout(safety)
    const game = useGameStore.getState()
    game.endCinematic()
    game.setScanStation(false)
    if (game.scannerEquipped) game.unequipScanner()
    if (game.archiveView !== 'none') return
    if (game.albumOpen) game.closeAlbum()
    useNarrativeStore.getState().clearDialogue()
    stopPipVoice()
    useGameStore.getState().openAlbum(missionId)
  }
  const pending = () => {
    if (!cueId) return false
    const state = useNarrativeStore.getState()
    return (
      state.current?.id === cueId ||
      state.queue.some((line) => line.id === cueId)
    )
  }
  const check = () => {
    if (pending()) return
    // A short beat of celebration before the panel slides in.
    const wait = Math.max(0, 1400 - (performance.now() - startedAt))
    window.setTimeout(open, wait)
  }
  // Never stuck: the album opens even if the voice hangs.
  const safety = window.setTimeout(open, 25_000)
  unsubscribe = useNarrativeStore.subscribe(check)
  check()
}

/** Part close-up: as long as PIP's line, at most this long (ms). */
const PART_FILM_MAX_MS = 20000
/** A short beat on the part after PIP's line ends. */
const PART_FILM_TAIL_MS = 900

/** Length of the identification film (three shots of about 3 s). */
const IDENTIFICATION_FILM_MS = 9600

export function MissionNarrativeController() {
  const save = useJourneyStore((state) => state.save)
  // The landing-site title opens every landing; PIP speaks after it.
  const arrived = useGameStore((state) => state.arrivalStage === 'done')
  const archiveView = useGameStore((state) => state.archiveView)
  // The album guides a completed story; the world waits until it closes.
  const albumOpen = useGameStore((state) => state.albumOpen)
  const archiveMissionId = useGameStore((state) => state.archiveMissionId)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerCard = useGameStore((state) => state.scannerCardComponentId)
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const activeSiteId = useGameStore((state) => state.activeSiteId)

  const mission = getMission(SPIRIT_SITE.missionId)
  const progress = save?.missions[SPIRIT_SITE.missionId] ?? null
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
    if (enteredRef.current || !save || !arrived) return
    enteredRef.current = true
    // A fresh landing gets the guided arrival briefing instead of the
    // short entry line (MarsBriefing owns PIP's voice until it ends).
    const briefing = needsArrivalBriefing({
      progress,
      flags: useNarrativeStore.getState().protocol,
      priorFieldWork: hasPriorFieldWork(save, SPIRIT_SITE.missionId),
    })
    const cue = briefing ? null : getMissionEntryCue(mission, progress)
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
  }, [save, mission, progress, arrived])

  // Detection, identification, scanner hints and voluntary guidance are
  // driven by the real player position and the real scanner state.
  useEffect(() => {
    if (!save) return

    const tick = () => {
      const currentSave = useJourneyStore.getState().save
      if (!currentSave) return
      const currentProgress = currentSave.missions[SPIRIT_SITE.missionId]
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

      // Reading modals, site panels and the arrival briefing own the screen;
      // no world dialogue and no proactive help while the player is reading
      // (the idle clock restarts, so no hint fires the moment they close).
      if (
        game.marsBriefingStep !== null ||
        game.arrivalStage !== 'done' ||
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
      // counts close to the ground. The save is
      // updated first, then PIP may reconnect the historical record.
      if (!approachedRef.current && withinApproach) {
        approachedRef.current = true
        approachAtRef.current = now
        const wasDiscovered = Boolean(currentProgress.discovered)
        if (!wasDiscovered) {
          emitAudio('pipCurious')
          const approached = getApproachedCue(mission, isCoarsePointer())
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

      // Parts hunt (M4): once the scanner is out, PIP gives the clue for the
      // part to find now. One clue per part, and only when PIP is free, so
      // it always comes after the story of the part just found.
      const huntTarget = getHuntTarget(mission, currentProgress)
      // The save effect must have queued the story of the last part first.
      const storyQueued =
        previousScannedRef.current.length ===
        currentProgress.scannedComponentIds.length
      if (
        huntTarget &&
        storyQueued &&
        game.scannerEquipped &&
        !game.historicalExplanationId &&
        narrative.queue.length === 0 &&
        (!narrative.current ||
          narrative.current.id === `${mission.id}:scanner-prompt`)
      ) {
        const clue = getHuntClueCue(mission, huntTarget.id)
        if (clue && narrative.enqueue(withTipDone(clue, mission.id))) {
          narrative.react('hint', undefined, 2000)
        }
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
        // The guided walk and practice rock have their own step-by-step
        // guidance; the explorer hint ("follow the star…") would contradict it.
        isStepAtLeast(getCurrentProtocolStep(), 'M3') &&
        !game.scannerTriggerHeld &&
        game.scannerScanProgress === 0 &&
        !game.pipMessage &&
        !narrative.current &&
        narrative.queue.length === 0
      ) {
        const cue = getSoftHintCue(mission, currentProgress)
        if (cue) {
          guideTimingRef.current = noteSoftHint(guideTimingRef.current, now)
          narrative.enqueue(withTipDone(cue, mission.id))
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
  const lastStationRef = useRef<ScanStationTarget | null>(null)
  const lastBriefedRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (!save) return
    const tick = () => {
      const currentSave = useJourneyStore.getState().save
      if (!currentSave) return
      const narrative = useNarrativeStore.getState()
      const game = useGameStore.getState()
      const currentProgress = currentSave.missions[SPIRIT_SITE.missionId]

      // Ephemeral facts earned by playing; only before the explorer is known.
      if (!currentProgress?.discovered) {
        if (!narrative.protocol.walked && hasWalkedEnough(playerPosition)) {
          narrative.markProtocol('walked')
        }
        // The practice rock is a few steps from the landing: reaching it
        // also counts as the first walk, so the child goes straight to it.
        const afterWalk = useNarrativeStore.getState().protocol
        if (!afterWalk.stationReached && hasReachedStation(playerPosition)) {
          if (!afterWalk.walked) narrative.markProtocol('walked')
          narrative.markProtocol('stationReached')
        }
      }

      // Saves that stopped before the old full recognition scan: the hunt is
      // done, so the memory is recovered now (no extra scan any more).
      if (
        currentProgress &&
        !currentProgress.memoryRecoveredAt &&
        stageForProgress(currentProgress) === 'ready_for_full_scan'
      ) {
        useJourneyStore.getState().completeFullScan(SPIRIT_SITE.missionId)
      }

      const step = getCurrentProtocolStep(currentSave)

      // Scan station: the parts hunt happens right in front of the explorer,
      // with a still view, until all three parts are found.
      const nearExplorer =
        Math.hypot(
          playerPosition.x - SPIRIT_SITE.position.x,
          playerPosition.z - SPIRIT_SITE.position.z,
        ) <=
        MISSION_APPROACH_RADIUS + 1.5
      // The close-up of the last part still belongs to the hunt: the
      // station (and the scanner) stay until PIP has told its story.
      const huntOn =
        (step === 'M4' &&
          Boolean(currentProgress?.discovered) &&
          !currentProgress?.memoryRecoveredAt) ||
        game.cinematicFocus?.kind === 'part'
      const explorerStation =
        huntOn &&
        game.scannerEquipped &&
        game.scannerMissionId === SPIRIT_SITE.missionId &&
        ((game.scanStation && game.scanStationTarget === 'explorer') || nearExplorer)

      // Practice station: the first rock is scanned the same way, with a
      // still view on it, and the scanner stays out until it is done.
      const nearRock =
        Math.hypot(
          playerPosition.x - CALIBRATION_SAMPLE.position.x,
          playerPosition.z - CALIBRATION_SAMPLE.position.z,
        ) <= PRACTICE_STATION_VIEW.startRadius
      const practiceStation =
        isCalibrationActive(step) &&
        game.scannerEquipped &&
        ((game.scanStation && game.scanStationTarget === 'practice') || nearRock)

      const stationTarget: ScanStationTarget | null = explorerStation
        ? 'explorer'
        : practiceStation
          ? 'practice'
          : null
      game.setScanStation(stationTarget !== null, stationTarget ?? undefined)

      // A station that ends because its task is done puts the scanner away
      // and leaves the camera looking at what was just scanned, instead of
      // swinging the first-person view somewhere else.
      const endedStation = lastStationRef.current
      lastStationRef.current = stationTarget
      if (endedStation && !stationTarget) {
        const finished =
          endedStation === 'practice'
            ? !isCalibrationActive(step)
            : Boolean(currentProgress?.memoryRecoveredAt)
        if (finished) {
          const center =
            endedStation === 'practice'
              ? CALIBRATION_SAMPLE.position
              : SPIRIT_SITE.position
          faceOrbitToward(center.x - playerPosition.x, center.z - playerPosition.z)
          if (useGameStore.getState().scannerEquipped) {
            useGameStore.getState().unequipScanner()
          }
        }
      }

      game.setRadarUnlocked(
        isRadarVisible(step, useNarrativeStore.getState().protocol),
      )
      game.setScannerLocked(!isScannerUnlocked(step))
      game.setLandmarksLocked(!areFreeScansAllowed(step))
      narrative.setAmbientAllowed(areFreeScansAllowed(step))
      if (!isScannerUnlocked(step) && game.scannerEquipped) {
        game.unequipScanner()
      }

      // Guided first walk: when PIP's briefing ends the view turns down the
      // lane to the practice rock, and on arrival it turns to the rock.
      const briefedNow = useNarrativeStore.getState().protocol.briefed
      if (briefedNow && !lastBriefedRef.current && (step === 'M0' || step === 'M1')) {
        const { end } = getGuideLane()
        faceOrbitToward(end.x - playerPosition.x, end.z - playerPosition.z)
      }
      lastBriefedRef.current = briefedNow

      const previous = lastStepRef.current
      if (previous !== step && step === 'M2' && previous !== null) {
        faceOrbitToward(
          CALIBRATION_SAMPLE.position.x - playerPosition.x,
          CALIBRATION_SAMPLE.position.z - playerPosition.z,
        )
      }
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
            // What to do in this step stays in the tip card until it is done.
            tip: { doneWhen: () => getCurrentProtocolStep() !== step },
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
        // A pause to look at the machine: three close shots (reveal,
        // close-up, low hero angle) while PIP says who it is.
        useGameStore.getState().startCinematic(
          'identification',
          {
            x: SPIRIT_SITE.position.x,
            z: SPIRIT_SITE.position.z,
          },
          IDENTIFICATION_FILM_MS,
        )
        // PIP leads the next move: take out the scanner (the clue for the
        // first part follows once it is out).
        if (!useGameStore.getState().scannerEquipped) {
          const prompt = getScannerPromptCue(mission, isCoarsePointer())
          if (prompt) {
            useNarrativeStore.getState().enqueue({
              ...prompt,
              cancelWhen: () => useGameStore.getState().scannerEquipped,
              tip: { doneWhen: () => useGameStore.getState().scannerEquipped },
            })
          }
        }
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
            // A pause to look: the camera comes close to the part and PIP
            // flies in beside it to tell its story. It ends with his line.
            // It lasts until PIP's line is done (see the explanation
            // release below); this is only the safety cap. The last part
            // gets it too, even though the scanner is put away right then.
            useGameStore.getState().startCinematic(
              'part',
              { x: SPIRIT_SITE.position.x, z: SPIRIT_SITE.position.z },
              PART_FILM_MAX_MS,
              id,
            )
          }
          narrative.showAttention(id, 'scan', 2600)
          narrative.react('scan', id)
        }
      }
      if (scannedComponentCount(progress) === mission.components.length) {
        emitAudio('pipCelebrate')
        const done = getCompletionCue(mission)
        const queued = done ? narrative.enqueue(done) : false
        narrative.react('celebrate', undefined, 2600)
        openTabletAfter(queued && done ? done.id : null, mission.id)
      }
      useNarrativeStore
        .getState()
        .markSpoken(`${SPIRIT_SITE.missionId}:target-detected`)
    }

    const hasLetter = Boolean(progress?.smartLetterCreatedAt)
    if (hasLetter && !previousLetterRef.current) {
      // The smart-letter dialog owns the first delivery of this line while
      // it is open; the world gets it once after the player closes it.
      if (archiveView === 'none' && !albumOpen) {
        previousLetterRef.current = true
        // The tablet already said "Sealed!": the world only points home.
        const back = getReturnToShipCue(mission)
        // Walking back to Mailwing stays in the tip card until boarding.
        if (back) {
          useNarrativeStore.getState().enqueue({
            ...back,
            tip: { doneWhen: () => useOnboardingStore.getState().phase !== 'playing' },
          })
        }
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
  }, [save, mission, progress, archiveView, albumOpen])

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
        // The part's story is told: the close-up hands back to the hunt.
        const film = useGameStore.getState().cinematicFocus
        if (film?.kind === 'part') {
          window.setTimeout(() => {
            if (useGameStore.getState().cinematicFocus === film) {
              useGameStore.getState().endCinematic()
            }
          }, PART_FILM_TAIL_MS)
        }
      }
    })
  }, [])

  // The archive overlays own PIP's panel; world dialogue yields to them.
  useEffect(() => {
    const openForMission =
      archiveView === 'smart-letter' && archiveMissionId === SPIRIT_SITE.missionId

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
    if (archiveView !== 'none' || albumOpen || !pendingCelebrateRef.current) return
    pendingCelebrateRef.current = false
    useNarrativeStore
      .getState()
      .react('celebrate', undefined, 2600)
  }, [archiveView, albumOpen])

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
