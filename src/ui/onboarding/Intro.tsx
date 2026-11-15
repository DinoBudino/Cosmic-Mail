import { useCallback, useEffect, useState } from 'react'
import {
  ARCHIVE_LABELS,
  INTRO_BEATS,
  INTRO_HOLOGRAM_LABELS,
  introBeatForLine,
  introMomentForLine,
  type IntroMoment,
} from '../../data/onboardingNarrative'
import { emitAudio } from '../../game/audio/audioEvents'
import { speakPip, stopPipVoice } from '../../game/pipVoice'
import { useGameStore } from '../../store/gameStore'
import { useOnboardingStore } from '../../store/onboardingStore'

const SCENE_ORDER: readonly IntroMoment[] = [
  'arrival',
  'archive',
  'fault',
  'hope',
  'invitation',
]

const SCENE_LABEL: Record<IntroMoment, string> = {
  arrival: 'Welcome aboard',
  archive: 'Cosmic Archive',
  fault: 'Solar storm',
  hope: 'A clue',
  invitation: 'The invitation',
}

/** Typewriter pace for the subtitle (ms per character). */
const TYPE_MS = 28

/**
 * Cinematic introduction over the existing cabin. It never reveals the
 * names of the historical machines. Every line is player-paced: PIP speaks,
 * and the dialogue only moves on when the player presses Continue (or the
 * bubble's keyboard focus). Replay and Skip stay available.
 *
 * When a line starts: PIP's expression and the hologram animation come
 * from the beat (3D scene), then the line's sound and voice play and the
 * subtitle types itself out. Continue during typing reveals the whole
 * line first; a second press moves on.
 */
export function Intro() {
  const finishIntro = useOnboardingStore((state) => state.finishIntro)
  const goBack = useOnboardingStore((state) => state.goBack)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const setDialogueIndex = useOnboardingStore((state) => state.setDialogueIndex)
  const setPipTalking = useOnboardingStore((state) => state.setPipTalking)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  const replayNonce = useOnboardingStore((state) => state.introReplay)
  const replayIntroLine = useOnboardingStore((state) => state.replayIntroLine)
  const lineKey = `${dialogueIndex}:${replayNonce}`
  const [typedState, setTypedState] = useState({ key: lineKey, count: 0 })
  const lastLine = INTRO_BEATS.length - 1
  const lineIndex = Math.min(Math.max(0, dialogueIndex), lastLine)
  const beat = introBeatForLine(lineIndex)
  const moment = introMomentForLine(lineIndex)
  const isFinalLine = lineIndex === lastLine
  const scenePosition = SCENE_ORDER.indexOf(moment) + 1
  // Show first, explain after: the label only says "Solar storm" once
  // Mailwing has detected it; before that it is just an Archive fault.
  const sceneLabel =
    moment === 'fault' && (beat.subphase === 'first-anomaly' || beat.subphase === 'fault-spreads')
      ? 'Archive fault'
      : SCENE_LABEL[moment]

  const lineLength = beat.line.length
  // A new line or Replay starts typing from zero (derived, no reset effect).
  const typed = reducedMotion
    ? lineLength
    : typedState.key === lineKey
      ? typedState.count
      : 0
  const typing = typed < lineLength

  const advance = useCallback(() => {
    if (typing) {
      // First press finishes the line instead of skipping it.
      setTypedState({ key: lineKey, count: lineLength })
      return
    }
    if (lineIndex < lastLine) {
      setDialogueIndex(lineIndex + 1)
      return
    }
    stopPipVoice()
    finishIntro()
  }, [typing, lineKey, lineLength, lineIndex, lastLine, setDialogueIndex, finishIntro])

  const skip = () => {
    emitAudio('introSkipped')
    stopPipVoice()
    setPipTalking(false)
    // Leaving the intro unmounts the projection, PIP's panels and the
    // emergency light, and the cabin camera returns to its frontal frame.
    finishIntro()
  }

  // Progressive subtitle text, restarted by every new line and Replay.
  useEffect(() => {
    if (reducedMotion) return
    const id = window.setInterval(() => {
      setTypedState((previous) => {
        const count = (previous.key === lineKey ? previous.count : 0) + 1
        if (count >= lineLength) window.clearInterval(id)
        return { key: lineKey, count: Math.min(count, lineLength) }
      })
    }, TYPE_MS)
    return () => window.clearInterval(id)
  }, [lineKey, lineLength, reducedMotion])

  useEffect(() => {
    // The line's own effect sound (disconnection, alert, storm swell...).
    // The fault and hope cue changes stay with AudioDirector.
    if (beat.sound) emitAudio(beat.sound)
    speakPip(beat.line, voiceEnabled, beat.emotion)
    setPipTalking(true)
    const talkMs = Math.min(7200, 1200 + beat.line.length * 42)
    const mouthTimer = window.setTimeout(() => setPipTalking(false), talkMs)

    return () => {
      window.clearTimeout(mouthTimer)
      setPipTalking(false)
    }
  }, [beat.line, beat.sound, beat.emotion, replayNonce, voiceEnabled, setPipTalking])

  useEffect(() => () => stopPipVoice(), [])

  return (
    <section
      className="cine"
      aria-labelledby="intro-title"
      data-scene={moment}
    >
      <h1 id="intro-title" className="sr-only">
        Cosmic Mail — introduction
      </h1>
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      <p className="sr-only">{ARCHIVE_LABELS[moment]}</p>
      {/* Announces each new projection and alert in the Memory Window. */}
      <p className="sr-only" aria-live="polite">
        {INTRO_HOLOGRAM_LABELS[beat.hologram]}
      </p>

      <div
        className="cine__progress"
        role="progressbar"
        aria-label={`Intro scene ${scenePosition} of ${SCENE_ORDER.length}: ${sceneLabel}`}
        aria-valuemin={1}
        aria-valuemax={SCENE_ORDER.length}
        aria-valuenow={scenePosition}
      >
        {SCENE_ORDER.map((scene) => (
          <span
            key={scene}
            className={`cine__progress-dot${
              scene === moment ? ' is-current' : ''
            }${
              SCENE_ORDER.indexOf(scene) < SCENE_ORDER.indexOf(moment)
                ? ' is-past'
                : ''
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      <div
        className="cine__subtitle"
        role="group"
        aria-label="PIP is telling you what happened to the Cosmic Archive"
      >
        <div className="cine__subtitle-head">
          <span className="cine__subtitle-name">PIP</span>
          <span className="cine__scene-label">{sceneLabel}</span>
          <button
            type="button"
            className="cine__replay"
            onClick={replayIntroLine}
            aria-label="Replay this line"
          >
            ↻ Replay
          </button>
          <button type="button" className="cine__skip" onClick={skip}>
            Skip intro ▸
          </button>
        </div>

        <p className="cine__subtitle-text">
          {/* Screen readers get the whole line at once; the typed text is visual. */}
          <span className="sr-only" aria-live="polite">
            {beat.line}
          </span>
          <span aria-hidden="true">
            {beat.line.slice(0, typed)}
            <span className="cine__subtitle-rest">{beat.line.slice(typed)}</span>
          </span>
        </p>

        <div className="cine__actions">
          <button
            type="button"
            className="menu__option cine__action"
            onClick={advance}
            autoFocus
          >
            {isFinalLine ? 'Count me in!' : 'Continue ▸'}
          </button>
        </div>

      </div>

      <span className="sr-only" aria-live="polite">
        {reducedMotion
          ? 'Reduced motion is on. Camera moves are simplified; use Continue to move through the story at your own pace.'
          : ''}
      </span>
    </section>
  )
}
