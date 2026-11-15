import { useEffect, useRef, useState } from 'react'
import {
  TRANSMISSION_DESTINATION,
} from '../data/onboardingNarrative'
import { findMission } from '../data/missions'
import { getArchiveCue } from '../data/missionNarrative'
import { emitAudio } from '../game/audio/audioEvents'
import { speakPip, stopPipVoice } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { PipAvatar } from './PipSpeech'
import { HuntIconGlyph } from './HuntTracker'

type TimelineKey = 'launch' | 'landing' | 'discovery' | 'end'

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
  const markReconstructionWatched = useJourneyStore(
    (state) => state.markReconstructionWatched,
  )
  const archiveLine = useNarrativeStore((state) => state.archiveLine)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const openArchive = useGameStore((state) => state.openArchive)
  const phase = useOnboardingStore((state) => state.phase)

  const [message, setMessage] = useState<string | null>(null)
  const [openStep, setOpenStep] = useState<TimelineKey | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)

  const progress = save?.missions[mission.id] ?? null
  const memoryRecovered = progress?.memoryRecoveredAt != null
  const hasLetter = progress?.smartLetterCreatedAt != null
  const transmitted = progress?.transmittedAt != null
  const showDelivered = transmitted
  const isAboardMailwing = phase === 'hub' || phase === 'orbit'
  // A sealed letter is sent right after its story video (StoryTransmission),
  // so the only thing left on the tablet is "Watch its story". On Mars the
  // tablet cannot be closed: the story is the way forward.
  const storyPending = hasLetter && !transmitted
  const storyOnly = storyPending && !isAboardMailwing
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
    if (event.target === event.currentTarget && !storyOnly) onClose()
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

  const handleReconstruction = () => {
    markReconstructionWatched(mission.id)
    openArchive('reconstruction', mission.id)
  }

  const parts = mission.components
  const timeline = mission.smartLetter.timeline
  const chips: { key: TimelineKey; label: string; glyph: string; short: string; long: string }[] = [
    { key: 'launch', label: 'Launch', glyph: '↑', short: timeline?.launch ?? 'Launch', long: mission.smartLetter.trajectory },
    { key: 'landing', label: 'Landing', glyph: '◎', short: timeline?.landing ?? 'Landing', long: mission.smartLetter.identity },
    { key: 'discovery', label: 'Discovery', glyph: '✦', short: timeline?.discovery ?? 'Discoveries', long: mission.smartLetter.discoveries },
    { key: 'end', label: 'Mission end', glyph: '☾', short: timeline?.end ?? 'Mission end', long: mission.smartLetter.missionEnd },
  ]
  const openChip = chips.find((chip) => chip.key === openStep) ?? null
  const status = showDelivered
    ? 'Delivered'
    : hasLetter
      ? 'Letter sealed'
      : memoryRecovered
        ? 'Memory back'
        : `${recovered.size}/3 parts`

  return (
    <dialog
      ref={dialogRef}
      className="smart-letter-dialog"
      aria-labelledby="smart-letter-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={handleDialogClick}
    >
      <article className="archive-tablet" data-state={showDelivered ? 'delivered' : hasLetter ? 'sealed' : memoryRecovered ? 'recovered' : 'locked'}>
        <span className="archive-tablet__camera" aria-hidden="true" />
        <div className="archive-tablet__screen">
          <header className="archive-tablet__bar">
            <span className="archive-tablet__app">
              <span aria-hidden="true">✦</span> Cosmic Archive
            </span>
            <span className="archive-tablet__status">{status}</span>
            {!storyOnly && (
              <button
                type="button"
                className="archive-tablet__close"
                aria-label="Close the archive tablet"
                onClick={onClose}
              >
                ×
              </button>
            )}
          </header>

          <div className="archive-tablet__hero">
            <div className="archive-tablet__badge" aria-hidden={!showDelivered}>
              {showDelivered ? (
                <span
                  className="archive-tablet__holo-stamp"
                  role="img"
                  aria-label={`Archive stamp: ${mission.stampLabel} · ${TRANSMISSION_DESTINATION}`}
                  style={{
                    backgroundImage: `url(${import.meta.env.BASE_URL}textures/${mission.destination === 'moon' ? 'moon/moon' : 'mars/mars'}-color.jpg)`,
                  }}
                >
                  <b aria-hidden="true">✦</b>
                </span>
              ) : (
                <span className="archive-tablet__badge-glyph">
                  {progress?.discovered ? '✉' : '?'}
                </span>
              )}
            </div>
            <div>
              <h2 id="smart-letter-title">
                {progress?.discovered ? mission.machineName : 'Unknown explorer'}
              </h2>
              <p className="archive-tablet__meta">
                {progress?.discovered ? mission.yearLabel : 'Find it to learn its story'}
              </p>
            </div>
          </div>

          <ul className="archive-tablet__parts" aria-label={`Parts found: ${recovered.size} of 3`}>
            {parts.map((component) => {
              const found = recovered.has(component.id)
              return (
                <li key={component.id} className="archive-tablet__part" data-found={found}>
                  <span className="archive-tablet__part-icon">
                    {found && component.huntClue ? (
                      <HuntIconGlyph name={component.huntClue.icon} />
                    ) : (
                      <span aria-hidden="true">{found ? '✓' : '?'}</span>
                    )}
                  </span>
                  <strong>{found ? (component.huntClue?.label ?? component.shortName) : '???'}</strong>
                  {found && component.howItWorks && (
                    <small>{component.howItWorks.verb}</small>
                  )}
                </li>
              )
            })}
          </ul>

          {hasLetter && (
            <section className="archive-tablet__story" aria-label="Its story">
              <ol className="archive-tablet__timeline">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      className="archive-tablet__chip"
                      aria-expanded={openStep === chip.key}
                      onClick={() =>
                        setOpenStep((current) => (current === chip.key ? null : chip.key))
                      }
                    >
                      <span className="archive-tablet__chip-glyph" aria-hidden="true">
                        {chip.glyph}
                      </span>
                      <span className="archive-tablet__chip-label">{chip.label}</span>
                      <span className="archive-tablet__chip-short">{chip.short}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {openChip ? (
                <p className="archive-tablet__detail" role="status">{openChip.long}</p>
              ) : (
                <p className="archive-tablet__detail archive-tablet__detail--hint">Tap a step to read more.</p>
              )}
            </section>
          )}

          <div className={`archive-tablet__pip${transmitted ? ' is-success' : ''}`}>
            <PipAvatar />
            <p className="archive-tablet__pip-line">{pipLine}</p>
          </div>

          {progress?.legacySealAt != null && hasLetter && (
            <p className="archive-tablet__legacy">
              Older record kept as history.
            </p>
          )}

          <div className="archive-tablet__actions">
            {memoryRecovered && !hasLetter && (
              <button
                ref={primaryRef}
                type="button"
                className="archive-tablet__action archive-tablet__action--primary archive-tablet__action--seal"
                onClick={handlePrepare}
              >
                <span aria-hidden="true">✉</span> Seal the letter
              </button>
            )}
            {hasLetter && (
              <button
                ref={hasLetter ? primaryRef : undefined}
                type="button"
                className={`archive-tablet__action${storyPending ? ' archive-tablet__action--primary archive-tablet__action--story' : ''}`}
                onClick={handleReconstruction}
              >
                {storyPending ? '▶ Watch its story' : 'Replay its story'}
              </button>
            )}
            {(!hasLetter || transmitted) && !(memoryRecovered && !hasLetter) && (
              <button
                ref={primaryRef}
                type="button"
                className="archive-tablet__action"
                onClick={onClose}
              >
                {isAboardMailwing ? 'Close' : 'Keep exploring'}
              </button>
            )}
          </div>


          {message && (
            <p className="archive-tablet__message" role="status">
              {message}
            </p>
          )}

          {progress?.discovered && (
            <details className="archive-tablet__sources">
              <summary>NASA sources</summary>
              <ul>
                {mission.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </article>
    </dialog>
  )
}
