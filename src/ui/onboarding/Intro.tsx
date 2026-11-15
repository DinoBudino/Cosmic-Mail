import { useCallback, useEffect, useState } from 'react'
import {
  ARCHIVE_LABELS,
  INTRO_BEATS,
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
  fault: 'Archive fault',
  hope: 'A clue',
  invitation: 'The invitation',
}

/**
 * Cinematic introduction over the existing cabin. It never reveals the
 * names of the historical machines. Every line is player-paced: PIP speaks,
 * and the dialogue only moves on when the player presses Continue (or the
 * bubble's keyboard focus). Replay and Skip stay available.
 */
export function Intro() {
  const finishIntro = useOnboardingStore((state) => state.finishIntro)
  const goBack = useOnboardingStore((state) => state.goBack)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const setDialogueIndex = useOnboardingStore((state) => state.setDialogueIndex)
  const setPipTalking = useOnboardingStore((state) => state.setPipTalking)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  const [replayNonce, setReplayNonce] = useState(0)
  const lastLine = INTRO_BEATS.length - 1
  const lineIndex = Math.min(Math.max(0, dialogueIndex), lastLine)
  const beat = introBeatForLine(lineIndex)
  const moment = introMomentForLine(lineIndex)
  const isFinalLine = lineIndex === lastLine
  const scenePosition = SCENE_ORDER.indexOf(moment) + 1

  const advance = useCallback(() => {
    if (lineIndex < lastLine) {
      setDialogueIndex(lineIndex + 1)
      return
    }
    stopPipVoice()
    finishIntro()
  }, [lineIndex, lastLine, setDialogueIndex, finishIntro])

  const skip = () => {
    emitAudio('introSkipped')
    stopPipVoice()
    setPipTalking(false)
    finishIntro()
  }

  useEffect(() => {
    speakPip(beat.line, voiceEnabled)
    setPipTalking(true)
    const talkMs = Math.min(7200, 1200 + beat.line.length * 42)
    const mouthTimer = window.setTimeout(() => setPipTalking(false), talkMs)

    return () => {
      window.clearTimeout(mouthTimer)
      setPipTalking(false)
    }
  }, [beat.line, replayNonce, voiceEnabled, setPipTalking])

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

      <div
        className="cine__progress"
        role="progressbar"
        aria-label={`Intro scene ${scenePosition} of ${SCENE_ORDER.length}: ${SCENE_LABEL[moment]}`}
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
          <span className="cine__scene-label">{SCENE_LABEL[moment]}</span>
          <button
            type="button"
            className="cine__replay"
            onClick={() => setReplayNonce((nonce) => nonce + 1)}
            aria-label="Replay this line"
          >
            ↻ Replay
          </button>
          <button type="button" className="cine__skip" onClick={skip}>
            Skip intro ▸
          </button>
        </div>

        <p className="cine__subtitle-text" aria-live="polite">
          {beat.line}
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
