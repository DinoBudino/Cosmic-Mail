import { useEffect, useRef, useState } from 'react'
import {
  TRANSMISSION_DESTINATION,
  TRANSMISSION_SUCCESS_LINE,
} from '../data/onboardingNarrative'
import { findMission } from '../data/missions'
import { getArchiveCue } from '../data/missionNarrative'
import { emitAudio } from '../game/audio/audioEvents'
import { speakPip, stopPipVoice } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { getMissionStage } from './missionStage'
import { PipAvatar } from './PipSpeech'

/**
 * The Proposal A smart letter: a digital capsule with the recovered memory
 * and its history, addressed to the fictional Earth Cosmic Archive. It is
 * only generated after a valid full recognition scan and recovered memory.
 * There is no quiz and no seal: transmission from Mailwing grants the
 * stamp.
 */
export function SmartLetterOverlay() {
  const view = useGameStore((state) => state.archiveView)
  const missionId = useGameStore((state) => state.archiveMissionId)
  const closeArchive = useGameStore((state) => state.closeArchive)

  if (view !== 'smart-letter' || !missionId) return null
  const mission = findMission(missionId)
  if (!mission) return null
  return <SmartLetter mission={mission} onClose={closeArchive} />
}

function Stamp({
  label,
  transmitted,
  animate,
}: {
  label: string
  transmitted: boolean
  animate: boolean
}) {
  if (!transmitted) {
    return (
      <span className="smart-letter__stamp-pending">
        Awaiting
        <br />
        delivery
      </span>
    )
  }
  return (
    <div
      className={`smart-letter__stamp${animate ? ' is-just-sealed' : ''}`}
      role="img"
      aria-label={`Archive stamp: ${label}`}
    >
      <span className="smart-letter__stamp-star" aria-hidden="true">
        ✦
      </span>
      <span className="smart-letter__stamp-label">{label}</span>
      <span className="smart-letter__stamp-word">TRANSMITTED</span>
    </div>
  )
}

function SmartLetter({
  mission,
  onClose,
}: {
  mission: NonNullable<ReturnType<typeof findMission>>
  onClose: () => void
}) {
  const save = useJourneyStore((state) => state.save)
  const prepareSmartLetter = useJourneyStore(
    (state) => state.prepareSmartLetter,
  )
  const transmit = useJourneyStore((state) => state.transmit)
  const markReconstructionWatched = useJourneyStore(
    (state) => state.markReconstructionWatched,
  )
  const archiveLine = useNarrativeStore((state) => state.archiveLine)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const openArchive = useGameStore((state) => state.openArchive)
  const phase = useOnboardingStore((state) => state.phase)

  const [message, setMessage] = useState<string | null>(null)
  const [justTransmitted, setJustTransmitted] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)

  const progress = save?.missions[mission.id] ?? null
  const stage = getMissionStage(progress)
  const memoryRecovered = progress?.memoryRecoveredAt != null
  const hasLetter = progress?.smartLetterCreatedAt != null
  const transmitted = progress?.transmittedAt != null
  const isAboardMailwing = phase === 'hub'
  const cue = getArchiveCue(mission, progress)
  const activeCue = archiveLine?.missionId === mission.id ? archiveLine : cue
  const pipLine = activeCue.text
  const recovered = new Set(progress?.scannedComponentIds ?? [])

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
    // The dialog speaks this beat, so the world queue must not replay it
    // after the overlay closes.
    useNarrativeStore.getState().markSpoken(activeCue.id)
    speakPip(pipLine, voiceName, voiceEnabled, 'hopeful')
    return () => stopPipVoice()
  }, [pipLine, activeCue.id, voiceName, voiceEnabled])

  const handleDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  const handlePrepare = () => {
    const result = prepareSmartLetter(mission.id)
    if (!result) {
      setMessage('No active journey save. Return to exploring and try again.')
      return
    }
    if (result.status === 'created' || result.status === 'already-created') {
      emitAudio('smartLetterPrepared')
      setMessage(null)
      return
    }
    emitAudio('archiveQueryFailed')
    setMessage(
      result.status === 'locked'
        ? 'The memory must be recovered before a smart letter can be prepared.'
        : 'This mission is not available.',
    )
  }

  const handleTransmit = () => {
    emitAudio('transmissionStarted')
    const result = transmit(mission.id)
    if (!result) {
      emitAudio('uiError')
      setMessage('No active journey save. Return to exploring and try again.')
      return
    }
    if (result.status === 'transmitted') {
      setJustTransmitted(true)
      setMessage(null)
      return
    }
    if (result.status === 'already-transmitted') {
      setMessage('This history is already restored in the Archive.')
      return
    }
    emitAudio('uiError')
    setMessage(
      result.status === 'letter-missing'
        ? 'Prepare the smart letter before transmitting it.'
        : 'This mission is not available.',
    )
  }

  const handleReconstruction = () => {
    markReconstructionWatched(mission.id)
    openArchive('reconstruction', mission.id)
  }

  const handleReturnToShip = () => {
    onClose()
    useOnboardingStore.getState().returnToShip()
  }

  return (
    <dialog
      ref={dialogRef}
      className="smart-letter-dialog"
      aria-labelledby="smart-letter-title"
      aria-describedby="smart-letter-summary"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={handleDialogClick}
    >
      <article className="smart-letter">
        <header className="smart-letter__header">
          <div className="smart-letter__heading">
            <p className="smart-letter__eyebrow">
              Cosmic Archive · Smart letter
            </p>
            <h2 id="smart-letter-title">
              {progress?.discovered ? mission.machineName : 'Unidentified explorer'}
            </h2>
            <p id="smart-letter-summary" className="smart-letter__meta">
              {mission.missionName} · {mission.yearLabel}
            </p>
          </div>
          <div className="smart-letter__stamp-slot">
            <Stamp
              label={`${mission.stampLabel} · ${TRANSMISSION_DESTINATION}`}
              transmitted={transmitted}
              animate={justTransmitted}
            />
          </div>
          <button
            type="button"
            className="settings-close smart-letter__close-x"
            aria-label="Close smart letter"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="smart-letter__postal">
          <span>To: {TRANSMISSION_DESTINATION}</span>
          <span className="smart-letter__postmark" aria-hidden="true">
            ✦
          </span>
          <span>{transmitted ? 'Delivered' : 'Awaiting transmission'}</span>
        </div>

        <p className="smart-letter__summary">{mission.summary}</p>

        <section
          className="smart-letter__records"
          aria-labelledby="smart-letter-records-title"
        >
          <h3 id="smart-letter-records-title">
            Recognized fragments · {recovered.size}/3
          </h3>
          <ul>
            {mission.components.map((component) => {
              const isRecovered = recovered.has(component.id)
              return (
                <li
                  key={component.id}
                  className={`smart-letter__record${
                    isRecovered ? ' is-recovered' : ''
                  }`}
                >
                  <span
                    className="smart-letter__record-mark"
                    aria-hidden="true"
                  >
                    {isRecovered ? '✓' : '·'}
                  </span>
                  <span className="smart-letter__record-copy">
                    <strong>{component.shortName}</strong>
                    <small>{component.pipLine}</small>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <div
          className={`smart-letter__pip${
            transmitted ? ' is-success' : ''
          }`}
        >
          <PipAvatar />
          <div>
            <p className="pip-name">PIP</p>
            <p className="smart-letter__pip-line">{pipLine}</p>
          </div>
        </div>

        {!memoryRecovered ? (
          <div className="smart-letter__locked" role="status">
            <p>This smart letter is still locked.</p>
            <p>
              Recognize all three fragments and complete the full recognition
              scan before the Archive can recover the memory.
            </p>
            <p className="smart-letter__locked-count">
              {recovered.size}/3 fragments recognized
            </p>
            {stage === 'ready_for_full_scan' && (
              <button
                type="button"
                className="archive-action archive-action--primary"
                onClick={() => openArchive('full-scan', mission.id)}
              >
                Open full recognition scan
              </button>
            )}
          </div>
        ) : !hasLetter ? (
          <div className="smart-letter__locked" role="status">
            <p>Memory recovered.</p>
            <p>
              The Archive can now prepare the smart letter with the identity,
              trajectory, discoveries and mission end.
            </p>
            <button
              ref={primaryRef}
              type="button"
              className="archive-action archive-action--primary"
              onClick={handlePrepare}
            >
              Prepare smart letter
            </button>
          </div>
        ) : (
          <>
            <dl className="smart-letter__sections">
              <div className="smart-letter__section">
                <dt>Identity</dt>
                <dd>{mission.smartLetter.identity}</dd>
              </div>
              <div className="smart-letter__section">
                <dt>Trajectory</dt>
                <dd>{mission.smartLetter.trajectory}</dd>
              </div>
              <div className="smart-letter__section">
                <dt>Discoveries</dt>
                <dd>{mission.smartLetter.discoveries}</dd>
              </div>
              <div className="smart-letter__section">
                <dt>End of mission</dt>
                <dd>{mission.smartLetter.missionEnd}</dd>
              </div>
            </dl>

            {progress?.legacySealAt != null && (
              <p className="smart-letter__legacy">
                Legacy record: this carrier sealed an older version of this
                story before the Archive fault. It is kept as history, not as
                an Archive delivery.
              </p>
            )}

            <p className="smart-letter__status" role="status">
              {transmitted
                ? TRANSMISSION_SUCCESS_LINE
                : 'Smart letter prepared. It must be transmitted from Mailwing to the Earth Cosmic Archive.'}
            </p>

            <div className="archive-actions">
              <button
                ref={primaryRef}
                type="button"
                className="archive-action"
                onClick={handleReconstruction}
              >
                {progress?.reconstructionWatchedAt != null
                  ? 'Replay historical reconstruction'
                  : 'View historical reconstruction'}
              </button>
              {!transmitted && isAboardMailwing && (
                <button
                  type="button"
                  className="archive-action archive-action--primary"
                  onClick={handleTransmit}
                >
                  Transmit to {TRANSMISSION_DESTINATION}
                </button>
              )}
              {!transmitted && !isAboardMailwing && (
                <button
                  type="button"
                  className="archive-action archive-action--primary"
                  onClick={handleReturnToShip}
                >
                  Carry it to Mailwing
                </button>
              )}
            </div>
          </>
        )}

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
            {phase === 'hub' ? 'Back to cabin' : 'Return to exploring'}
          </button>
        </footer>
      </article>
    </dialog>
  )
}
