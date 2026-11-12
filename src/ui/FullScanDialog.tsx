import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { findMission } from '../data/missions'
import {
  getFullScanCompleteCues,
  getFullScanStartedCue,
} from '../data/missionNarrative'
import { audioManager } from '../game/audio/audioManager'
import { emitAudio } from '../game/audio/audioEvents'
import { speakPip, stopPipVoice } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { getMissionStage, scannedComponentCount } from './missionStage'
import { PipAvatar } from './PipSpeech'

/** Hold duration for the complete-object recognition scan. */
const FULL_SCAN_SECONDS = 2.4
const TICK_MS = 50

/**
 * Explicit full-object recognition scan. It is deliberately different from
 * reading an individual component: the player must have recognized all
 * three fragments first, and the scan studies the complete explorer. It
 * never repairs or reactivates the machine.
 */
export function FullScanOverlay() {
  const view = useGameStore((state) => state.archiveView)
  const missionId = useGameStore((state) => state.archiveMissionId)
  const closeArchive = useGameStore((state) => state.closeArchive)

  if (view !== 'full-scan' || !missionId) return null
  const mission = findMission(missionId)
  if (!mission) return null
  return <FullScanDialog mission={mission} onClose={closeArchive} />
}

function FullScanDialog({
  mission,
  onClose,
}: {
  mission: NonNullable<ReturnType<typeof findMission>>
  onClose: () => void
}) {
  const save = useJourneyStore((state) => state.save)
  const completeFullScan = useJourneyStore((state) => state.completeFullScan)
  const prepareSmartLetter = useJourneyStore(
    (state) => state.prepareSmartLetter,
  )
  const openArchive = useGameStore((state) => state.openArchive)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const historicalExplanationId = useGameStore(
    (state) => state.historicalExplanationId,
  )

  const progress = save?.missions[mission.id] ?? null
  const stage = getMissionStage(progress)
  const alreadyRecovered = progress?.memoryRecoveredAt != null
  const scannedCount = scannedComponentCount(progress)

  const [progressValue, setProgressValue] = useState(0)
  const [justRecovered, setJustRecovered] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [holding, setHolding] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const startedLineSpoken = useRef(false)

  const recovered = alreadyRecovered || justRecovered

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    previousFocus.current = document.activeElement
    if (!dialog.open) dialog.showModal()
    const frame = window.requestAnimationFrame(() => primaryRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      if (dialog.open) dialog.close()
      const previous = previousFocus.current
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus()
      }
    }
  }, [])

  useEffect(() => {
    if (recovered) {
      // The dialog owns this beat. Mark the world cue spoken so closing the
      // dialog never replays the same sentence twice.
      const cues = getFullScanCompleteCues(mission)
      for (const cue of cues) {
        useNarrativeStore.getState().markSpoken(cue.id)
      }
      const line = cues[1] ?? cues[0]
      if (line) {
        speakPip(
          line.text,
          voiceName,
          voiceEnabled,
          line.expression,
        )
      }
    }
    return () => stopPipVoice()
  }, [recovered, mission, voiceName, voiceEnabled])

  useEffect(() => () => audioManager.stopLoop('fullScan'), [])

  useEffect(() => {
    if (!holding || recovered) return
    const timer = window.setInterval(() => {
      setProgressValue((current) => {
        const next = Math.min(1, current + TICK_MS / (FULL_SCAN_SECONDS * 1000))
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [holding, recovered])

  useEffect(() => {
    if (progressValue < 1 || recovered) return
    const result = completeFullScan(mission.id)
    if (!result) {
      setMessage('No active journey save. The scan was not recorded.')
      setProgressValue(0)
      return
    }
    if (result.status === 'memory-recovered') {
      setJustRecovered(true)
      emitAudio('fullScanCompleted')
      // The dialog narrates the recovery; the world queue stays clean so the
      // same line is not repeated when the overlay closes.
      useNarrativeStore.getState().react('archive', undefined, 2600)
      return
    }
    setProgressValue(0)
    setMessage(
      result.status === 'locked'
        ? 'Recognize all three fragments before scanning the complete explorer.'
        : result.status === 'already-recovered'
          ? 'The memory was already recovered.'
          : 'This mission is not available.',
    )
  }, [progressValue, recovered, completeFullScan, mission])

  const startHold = () => {
    if (
      recovered ||
      stage !== 'ready_for_full_scan' ||
      historicalExplanationId
    ) {
      return
    }
    setMessage(null)
    setHolding(true)
    emitAudio('fullScanStarted')
    if (!startedLineSpoken.current) {
      startedLineSpoken.current = true
      const cue = getFullScanStartedCue(mission)
      if (cue) {
        useNarrativeStore.getState().markSpoken(cue.id)
        speakPip(cue.text, voiceName, voiceEnabled, cue.expression)
      }
    }
  }

  const stopHold = () => {
    if (!holding) return
    setHolding(false)
    if (!recovered) {
      if (progressValue > 0.02) emitAudio('fullScanCancelled')
      else audioManager.stopLoop('fullScan')
      setProgressValue(0)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    startHold()
  }

  const handlePointerUp = () => stopHold()

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (event.repeat) return
    startHold()
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    stopHold()
  }

  const handlePrepare = () => {
    const result = prepareSmartLetter(mission.id)
    if (result?.status === 'created' || result?.status === 'already-created') {
      openArchive('smart-letter', mission.id)
      return
    }
    setMessage('The memory must be recovered before preparing the letter.')
  }

  return (
    <dialog
      ref={dialogRef}
      className="smart-letter-dialog"
      aria-labelledby="full-scan-title"
      aria-describedby="full-scan-description"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <article className="smart-letter">
        <header className="smart-letter__header">
          <div className="smart-letter__heading">
            <p className="smart-letter__eyebrow">
              Cosmic Archive · Full recognition scan
            </p>
            <h2 id="full-scan-title">
              {progress?.discovered
                ? mission.machineName
                : 'Unidentified explorer'}
            </h2>
            <p className="smart-letter__meta">
              {mission.missionName} · {mission.yearLabel}
            </p>
          </div>
          <button
            type="button"
            className="settings-close smart-letter__close-x"
            aria-label="Close full recognition scan"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <p id="full-scan-description" className="smart-letter__summary">
          Recognize the complete explorer, not a single part. The machine stays
          still; this scan reads its whole structure for the Archive.
        </p>

        <div
          className="smart-letter__records"
          aria-label={`${scannedCount} of 3 fragments recognized`}
        >
          <h3>Recognition prerequisite</h3>
          <div
            className="cosmic-scanner__progress"
            aria-label={`${scannedCount} of 3 fragments recognized`}
          >
            {mission.components.map((component) => (
              <span
                key={component.id}
                className={`cosmic-scanner__pip${
                  progress?.scannedComponentIds.includes(component.id)
                    ? ' is-filled'
                    : ''
                }`}
              />
            ))}
            <span className="cosmic-scanner__count">{scannedCount}/3</span>
          </div>
        </div>

        {recovered ? (
          <div className="full-scan__result" role="status">
            <h3>OBJETO COMPLETO — MEMORIA RECUPERADA</h3>
            <p>
              The fictional memory core has been recovered. The explorer remains
              immobile; no data is requested from the real machine.
            </p>
            <p>
              The memory can now become a smart letter for the Earth Cosmic
              Archive.
            </p>
            <div className="archive-actions">
              <button
                ref={primaryRef}
                type="button"
                className="archive-action archive-action--primary"
                onClick={handlePrepare}
              >
                Prepare smart letter
              </button>
              <button
                type="button"
                className="archive-action"
                onClick={() => openArchive('smart-letter', mission.id)}
              >
                Open smart letter
              </button>
            </div>
          </div>
        ) : stage === 'ready_for_full_scan' ? (
          <>
            <div
              className="full-scan__meter"
              role="progressbar"
              aria-label="Full recognition scan progress"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={Number(progressValue.toFixed(2))}
            >
              <span
                className="full-scan__meter-fill"
                style={{ transform: `scaleX(${progressValue})` }}
              />
            </div>
            <div className="archive-actions">
              <button
                ref={primaryRef}
                type="button"
                className="archive-action archive-action--primary"
                disabled={Boolean(historicalExplanationId)}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onLostPointerCapture={handlePointerUp}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onBlur={stopHold}
              >
                Hold to scan the complete explorer
              </button>
              <button type="button" className="archive-action" onClick={onClose}>
                Cancel
              </button>
            </div>
            <p className="smart-letter__status">
              {historicalExplanationId
                ? 'PIP is still explaining the last fragment. Listen or skip the line, then start the full scan.'
                : `The scan takes about ${FULL_SCAN_SECONDS.toFixed(1)} seconds. Release to cancel.`}
            </p>
          </>
        ) : (
          <div className="smart-letter__locked" role="status">
            <p>The complete recognition scan is still locked.</p>
            <p>
              Recognize all three fragments first, then return to the scanner
              and choose the full recognition scan.
            </p>
            <p className="smart-letter__locked-count">
              {scannedCount}/3 fragments recognized
            </p>
          </div>
        )}

        <div className="smart-letter__pip">
          <PipAvatar />
          <div>
            <p className="pip-name">PIP</p>
            <p className="smart-letter__pip-line">
              {recovered
                ? mission.narrative?.fullScanComplete[1] ??
                  'The memory is safe. Let us prepare its smart letter.'
                : holding
                  ? mission.narrative?.fullScanStarted ??
                    'Linking the three fragments into one record.'
                  : 'A full scan reads the whole explorer. It does not wake it up.'}
            </p>
          </div>
        </div>

        {message && (
          <p className="smart-letter__message" role="status">
            {message}
          </p>
        )}

        <footer className="smart-letter__footer">
          <span className="smart-letter__barcode" aria-hidden="true" />
          <button
            type="button"
            className="smart-letter__return"
            onClick={onClose}
          >
            Return to exploring
          </button>
        </footer>
      </article>
    </dialog>
  )
}
