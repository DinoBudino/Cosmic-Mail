import { useEffect } from 'react'
import { INTRO_LINES, introMomentForLine } from '../../data/personalization'
import { speakPip, stopPipVoice } from '../../game/pipVoice'
import { useGameStore } from '../../store/gameStore'
import { useOnboardingStore } from '../../store/onboardingStore'

const MOMENT_LABELS: Record<string, string> = {
  explorers: 'Moon, Mars and Deep Space float as holograms in the window.',
  forgotten: 'A quiet rover hologram fades its status light. The words read: abandoned, but not forgotten.',
  invitation: 'A holographic letter floats in the window, offered to the player.',
  reflection: 'Five stars form a constellation of explorer spirits: brave, observant, methodical, careful and reflective.',
}

function momentLabel(moment: string): string {
  return MOMENT_LABELS[moment] ?? ''
}

/**
 * Cinematic introduction (five moments, one visual idea each) over
 * the existing 3D cabin: PIP stays visible up top, a single hologram
 * set floats mid-frame, and a bottom subtitle bar carries the
 * dialogue (independent of PIP's 3D position). No tablet, no cards:
 * the child discovers the premise instead of reading a summary.
 *
 * Subtitle lines are user-paced (Continue advances), because the new
 * lines have no recordings yet — PIP must never speak a stale line.
 * Moment 4 waits for the explicit "I'm ready!" choice; moment 5 ends
 * with the single "Discover my explorer spirit" button.
 */
export function Intro() {
  const continueFromIntro = useOnboardingStore((state) => state.continueFromIntro)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const setDialogueIndex = useOnboardingStore((state) => state.setDialogueIndex)
  const goBack = useOnboardingStore((state) => state.goBack)
  const setPipTalking = useOnboardingStore((state) => state.setPipTalking)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)

  const lastLine = INTRO_LINES.length - 1
  const lineIndex = Math.min(dialogueIndex, lastLine)
  const line = INTRO_LINES[lineIndex] ?? ''

  // PIP speaks each subtitle line (recorded Kokoro takes). speakPip
  // stops the previous line first, so advancing never overlaps;
  // leaving the intro (Skip/Back/Discover) stops the voice. His
  // mouth follows the line for roughly its spoken length.
  useEffect(() => {
    speakPip(line, voiceName, voiceEnabled)
    setPipTalking(true)
    const talkMs = 1200 + line.length * 42
    const timer = window.setTimeout(() => setPipTalking(false), talkMs)
    return () => {
      window.clearTimeout(timer)
      setPipTalking(false)
    }
  }, [line, voiceName, voiceEnabled, setPipTalking])

  useEffect(() => () => stopPipVoice(), [])
  const moment = introMomentForLine(lineIndex)
  // The merged delivery + question line is the invitation decision.
  const isInvitationQuestion = lineIndex === 6
  const isFinalLine = lineIndex === lastLine

  const advance = () => {
    if (lineIndex < lastLine) setDialogueIndex(lineIndex + 1)
  }

  return (
    <section className="cine" aria-labelledby="intro-title">
      <h1 id="intro-title" className="sr-only">
        Cosmic Mail — introduction
      </h1>
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      {/* The hologram itself is projected in 3D inside the Cosmic
          Memory Window (see MenuScene MemoryWindowHolograms), so PIP
          passes in front of it and the round window clips it. Screen
          readers get the scene described here instead. */}
      {moment !== 'welcome' && <p className="sr-only">{momentLabel(moment)}</p>}

      {/* Subtitle bar: bottom, independent of PIP's 3D position. */}
      <div className="cine__subtitle" role="group" aria-label="PIP is telling you a story">
        <div className="cine__subtitle-head">
          <span className="cine__subtitle-name">PIP</span>
          <button
            type="button"
            className="cine__replay"
            onClick={() => speakPip(line, voiceName, voiceEnabled)}
            aria-label="Replay this moment"
          >
            ↻ Replay
          </button>
          <button type="button" className="cine__skip" onClick={continueFromIntro}>
            Skip intro ▸
          </button>
        </div>
        <p className="cine__subtitle-text" aria-live="polite">
          {line}
        </p>

        <div className="cine__actions">
          {isInvitationQuestion ? (
            <button type="button" className="menu__option cine__action" onClick={advance} autoFocus>
              I'm ready!
            </button>
          ) : isFinalLine ? (
            <button type="button" className="menu__option cine__action" onClick={continueFromIntro} autoFocus>
              Discover my explorer spirit
            </button>
          ) : (
            <button type="button" className="menu__option cine__action" onClick={advance}>
              Continue ▸
            </button>
          )}
        </div>
      </div>

      {/* Reduced motion stays user-paced too: nothing auto-advances. */}
      <span className="sr-only" aria-live="polite">
        {reducedMotion ? 'Reduced motion is on. Use Continue to move through the story at your own pace.' : ''}
      </span>
    </section>
  )
}
