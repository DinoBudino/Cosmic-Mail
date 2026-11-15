import { useEffect, useRef, useState } from 'react'
import { findMission } from '../data/missions'
import { emitAudio } from '../game/audio/audioEvents'
import { audioManager } from '../game/audio/audioManager'
import { speakPip, stopPipVoice } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useOnboardingStore } from '../store/onboardingStore'

/**
 * First-person historical reconstruction. It is clearly labelled as a
 * recreation, never as an original recording or a live message from the
 * machine. The final audiovisual production is still an open decision; this
 * honest scripted sequence preserves the canonical narrative function and
 * can be replaced without changing mission progress.
 */
export function MemoryReconstructionOverlay() {
  const view = useGameStore((state) => state.archiveView)
  const missionId = useGameStore((state) => state.archiveMissionId)
  const closeArchive = useGameStore((state) => state.closeArchive)

  if (view !== 'reconstruction' || !missionId) return null
  const mission = findMission(missionId)
  if (!mission) return null
  return <MemoryReconstruction mission={mission} onClose={closeArchive} />
}

function MemoryReconstruction({
  mission,
  onClose,
}: {
  mission: NonNullable<ReturnType<typeof findMission>>
  onClose: () => void
}) {
  const save = useJourneyStore((state) => state.save)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const openArchive = useGameStore((state) => state.openArchive)
  const progress = save?.missions[mission.id] ?? null
  const unlocked = progress?.smartLetterCreatedAt != null
  const phase = useOnboardingStore((state) => state.phase)
  // Still on Mars with the letter unsent: after the story, walk to the ship
  // (the tablet would only offer the story again).
  const toShip = unlocked && progress?.transmittedAt == null && phase === 'playing'

  const [index, setIndex] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const returnRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const lines = mission.reconstruction.lines
  const video = unlocked ? mission.reconstruction.video : undefined
  const videoRef = useRef<HTMLVideoElement>(null)
  const masterVolume = useGameStore((state) => state.masterVolume)
  const muted = useGameStore((state) => state.muted)
  const current = lines[Math.min(index, lines.length - 1)]!

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    previousFocus.current = document.activeElement
    if (!dialog.open) dialog.showModal()
    const frame = window.requestAnimationFrame(() =>
      (videoRef.current ?? primaryRef.current)?.focus(),
    )
    return () => {
      window.cancelAnimationFrame(frame)
      if (dialog.open) dialog.close()
      const previous = previousFocus.current
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus()
      }
    }
  }, [])

  // The video follows the game's master volume and mute.
  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    element.volume = Math.min(1, Math.max(0, masterVolume))
    element.muted = muted
  }, [masterVolume, muted, video])

  // While the story video plays, game music and wind go quiet.
  useEffect(() => {
    if (!video) return
    stopPipVoice()
    return () => audioManager.setVideoActive(false)
  }, [video])

  useEffect(() => {
    if (!unlocked || video) return
    speakPip(current, voiceName, voiceEnabled)
    return () => stopPipVoice()
  }, [current, unlocked, video, voiceName, voiceEnabled])

  useEffect(() => {
    if (unlocked && index > 0) emitAudio('reconstructionLine')
  }, [index, unlocked])

  return (
    <dialog
      ref={dialogRef}
      className="smart-letter-dialog"
      aria-labelledby="reconstruction-title"
      aria-describedby="reconstruction-disclaimer"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <article className={`smart-letter${video ? ' smart-letter--video' : ''}`}>
        <header className="smart-letter__header">
          <div className="smart-letter__heading">
            <p className="smart-letter__eyebrow">
              {video ? 'Cosmic Archive · Story video' : 'Cosmic Archive · Memory reconstruction'}
            </p>
            <h2 id="reconstruction-title">
              {video ? `${mission.machineName}'s story` : mission.reconstruction.title}
            </h2>
            <p className="smart-letter__meta">
              {mission.missionName} · {mission.yearLabel}
            </p>
          </div>
          <button
            type="button"
            className="settings-close smart-letter__close-x"
            aria-label="Close historical reconstruction"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <p id="reconstruction-disclaimer" className="reconstruction__label">
          {video
            ? 'Archive story · NASA images and simplified drawings'
            : 'Historical reconstruction · not an original recording'}
        </p>

        {!unlocked ? (
          <div className="smart-letter__locked" role="status">
            <p>This recreation is still locked.</p>
            <p>
              Recover the memory and prepare the smart letter before viewing
              the reconstruction.
            </p>
          </div>
        ) : video ? (
          <div className="reconstruction__video">
            <video
              ref={videoRef}
              src={`${import.meta.env.BASE_URL}${video}`}
              controls
              autoPlay
              playsInline
              preload="auto"
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              onPlay={() => audioManager.setVideoActive(true)}
              onPause={() => audioManager.setVideoActive(false)}
              onEnded={() => {
                audioManager.setVideoActive(false)
                returnRef.current?.focus()
              }}
            />
          </div>
        ) : (
          <>
            <div className="reconstruction__lines">
              {lines.map((line, lineIndex) => (
                <p
                  key={line}
                  className={`reconstruction__line${
                    lineIndex === index ? ' is-active' : ''
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
            <div className="reconstruction__nav">
              <button
                ref={primaryRef}
                type="button"
                className="archive-action"
                disabled={index === 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                ← Previous
              </button>
              {index < lines.length - 1 ? (
                <button
                  type="button"
                  className="archive-action archive-action--primary"
                  onClick={() => setIndex((value) => value + 1)}
                >
                  Next ▸
                </button>
              ) : (
                <button
                  type="button"
                  className="archive-action archive-action--primary"
                  onClick={() => setIndex(0)}
                >
                  ↻ Replay
                </button>
              )}
              <span className="reconstruction__count">
                {index + 1}/{lines.length}
              </span>
            </div>
            <p className="smart-letter__status">
              Scripted reconstruction. The final audiovisual production remains
              pending approval; this sequence preserves the recovered memory
              without pretending the machine is speaking.
            </p>
          </>
        )}

        <footer className="smart-letter__footer">
          <span className="smart-letter__barcode" aria-hidden="true" />
          <button
            ref={returnRef}
            type="button"
            className="smart-letter__return"
            onClick={() => {
              emitAudio('reconstructionClosed')
              if (toShip) onClose()
              else openArchive('smart-letter', mission.id)
            }}
          >
            {toShip ? 'Back to the ship' : 'Back to smart letter'}
          </button>
        </footer>
      </article>
    </dialog>
  )
}
