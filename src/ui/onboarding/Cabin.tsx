import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DISCOVERY_QUESTIONS,
  getTrait,
} from '../../data/personalization'
import { speakPip, stopPipVoice } from '../../game/pipVoice'
import { useGameStore } from '../../store/gameStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { PipAvatar } from '../PipSpeech'

/** PIP's dialogue lines for the current ritual step (written only, no voice). */
function useDialogueLines(): string[] {
  const phase = useOnboardingStore((state) => state.phase)
  const questionIndex = useOnboardingStore((state) => state.questionIndex)
  const traitId = useOnboardingStore((state) => state.trait)
  const tutorialDone = useOnboardingStore((state) => state.tutorialDone)
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)

  switch (phase) {
    case 'questions': {
      // PIP asks the question himself: lead-in line, then the question.
      const question = DISCOVERY_QUESTIONS[questionIndex]
      if (!question) return []
      return [question.pipIntro, question.question]
    }
    case 'reveal':
      return ['The stars have spoken...']
    case 'explorer':
      return [
        traitId
          ? `You and these explorers share the same ${getTrait(traitId).name} spirit. Which one's story feels most like yours?`
          : 'Which one feels most like you?',
      ]
    case 'module':
      return ['Pick one special module. The others will wait for future missions!']
    case 'name':
      return ["Everything is ready, but wait! Don't forget: without your name, this letter can't take off. Sign it, carrier!"]
    case 'hub':
      // Route confirmed: PIP's one-line all-set cue pointing at the
      // big red button (“Press the red button”) — the tutorial itself
      // only ends when that first take-off happens.
      if (routeConfirmed) {
        return ['All set, carrier! Press the red button to take off!']
      }
      // First visit only: PIP tours the passport and the navigation
      // screen. Returning carriers get no bubble at all — the hub opens
      // on the initial cabin view and the close-up only happens when
      // the pilot taps the navigation panel.
      if (!tutorialDone) {
        return [
          'This is your passport, carrier — your name, your spirit, your stamps.',
          'And this green screen is navigation. Moon and Deep Space are still sleeping — Mars is ready.',
          'When you are ready, tap the radar screen and choose.',
        ]
      }
      return []
    default:
      return []
  }
}

/**
 * Typewriter line for PIP. While it runs, PIP "speaks" (his mouth moves
 * in the 3D scene). A skip nonce completes the line instantly, like a
 * visual novel.
 */
function PipLine({
  line,
  skipNonce,
  onDone,
}: {
  line: string
  skipNonce: number
  onDone: () => void
}) {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const setPipTalking = useOnboardingStore((state) => state.setPipTalking)
  // Remounted per line (via key in the parent), so state starts clean.
  const [typed, setTyped] = useState(reducedMotion ? line : '')
  const intervalRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  const typedRef = useRef('')

  useEffect(() => {
    if (reducedMotion || line.length === 0) {
      onDone()
      return
    }
    doneRef.current = false
    typedRef.current = ''
    setPipTalking(true)
    // PIP says the line out loud while the subtitle types (recorded
    // voice when available, browser TTS otherwise). The mouth gestures
    // stay synced to the typewriter, subtitles always stay on.
    speakPip(line, voiceName, voiceEnabled)
    intervalRef.current = window.setInterval(() => {
      // Completion is tracked in a ref, never inside a state updater
      // (updaters may run during render — side effects there are a bug).
      const next = line.slice(0, typedRef.current.length + 1)
      typedRef.current = next
      setTyped(next)
      if (next.length >= line.length && intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
        if (!doneRef.current) {
          doneRef.current = true
          setPipTalking(false)
          onDone()
        }
      }
    }, 22)
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
      setPipTalking(false)
      stopPipVoice()
    }
  }, [line, reducedMotion, voiceEnabled, voiceName, setPipTalking, onDone])

  // Skip: a click while typing completes the line immediately.
  useEffect(() => {
    if (skipNonce === 0 || reducedMotion) return
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    stopPipVoice()
    setTyped(line)
    if (!doneRef.current) {
      doneRef.current = true
      setPipTalking(false)
      onDone()
    }
  }, [skipNonce, line, reducedMotion, setPipTalking, onDone])

  return (
    <span className="pip-bubble__text" aria-live="polite">
      {typed}
    </span>
  )
}

/**
 * The cockpit wrapper shared by every ritual step: soft veil over the 3D
 * cabin, and PIP floating by with a clickable dialogue bubble. Clicking
 * the bubble completes the typewriter or advances to the next line —
 * answers appear only once PIP has finished asking.
 */
export function Cabin({ children }: { children: ReactNode }) {
  const lines = useDialogueLines()
  const phase = useOnboardingStore((state) => state.phase)
  const isHub = phase === 'hub'
  const signing = useOnboardingStore((state) => state.signing)
  const setSigning = useOnboardingStore((state) => state.setSigning)
  const passportDetailOpen = useOnboardingStore((state) => state.passportDetailOpen)
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const setDialogueIndex = useOnboardingStore((state) => state.setDialogueIndex)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const setVoiceEnabled = useGameStore((state) => state.setVoiceEnabled)
  const [typingDone, setTypingDone] = useState(false)
  const [skipNonce, setSkipNonce] = useState(0)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [liftPx, setLiftPx] = useState(0)

  // If the step panel (tablet, label, passport) would collide with the
  // bubble, the bubble rises smoothly to clear it — never abruptly.
  useEffect(() => {
    const bubble = bubbleRef.current
    const content = contentRef.current
    if (!bubble || !content) return
    const adjust = () => {
      // Measure against the actual panel (tablet / label / passport),
      // whose rendered top is what the bubble must clear. The bubble's
      // current lift is compensated so re-measuring stays stable.
      const panel = content.querySelector<HTMLElement>(
        '.tablet, .shipping-label, .onboarding__panel',
      )
      if (!panel) {
        setLiftPx(0)
        return
      }
      const bubbleBottom = bubble.getBoundingClientRect().bottom
      const overlap = bubbleBottom - (panel.getBoundingClientRect().top - 14)
      setLiftPx((current) => {
        const desired = Math.max(0, current + overlap)
        return Math.abs(desired - current) < 1 ? current : desired
      })
    }
    adjust()
    const observer = new ResizeObserver(adjust)
    observer.observe(bubble)
    observer.observe(content)
    window.addEventListener('resize', adjust)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', adjust)
    }
  }, [children, isHub])

  const line = lines[Math.min(dialogueIndex, Math.max(0, lines.length - 1))] ?? ''
  const isLastLine = dialogueIndex >= lines.length - 1
  const handleDone = useCallback(() => setTypingDone(true), [])

  // A new line (next question included) starts untyped. Adjusting state
  // during render is the React-endorsed pattern for derived resets.
  // The skip nonce resets too: a stale skip would make the next line
  // auto-complete (and mute PIP) the instant it mounts.
  const [seenLine, setSeenLine] = useState(line)
  if (seenLine !== line) {
    setSeenLine(line)
    setTypingDone(false)
    setSkipNonce(0)
  }

  const handleBubbleClick = () => {
    if (!typingDone) {
      setSkipNonce((nonce) => nonce + 1)
      return
    }
    if (!isLastLine) {
      setTypingDone(false)
      setDialogueIndex(dialogueIndex + 1)
      return
    }
    // Name phase: after PIP's warning, clicking opens the signing
    // window and the bubble itself disappears. (The hub tutorial
    // ends at the first take-off, not at the end of these lines.)
    if (phase === 'name') setSigning(true)
  }

  return (
    <div className="cabin">
      <div className="boarding__veil" aria-hidden="true" />

      {!signing && lines.length > 0 && (
      <div
        className={`pip-bubble-wrap${phase === 'hub' && (passportDetailOpen || routeOpen) ? ' is-hidden' : ''}`}
        ref={bubbleRef}
        style={{ transform: liftPx > 0 ? `translateY(${-liftPx}px)` : undefined }}
      >
        <button
          type="button"
          className="pip-bubble"
          onClick={handleBubbleClick}
          aria-label={typingDone && !isLastLine ? 'Continue' : 'PIP is speaking'}
        >
          <PipAvatar />
          <span className="pip-bubble__body">
            <span className="pip-bubble__name">PIP</span>
            <PipLine
              key={`${line}-${dialogueIndex}`}
              line={line}
              skipNonce={skipNonce}
              onDone={handleDone}
            />
            {typingDone && !isLastLine && (
              <span className="pip-bubble__next" aria-hidden="true">
                ▸
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          className="pip-bubble__voice"
          aria-pressed={voiceEnabled}
          aria-label={voiceEnabled ? 'Turn PIP voice off' : 'Turn PIP voice on'}
          onClick={() => {
            if (voiceEnabled) stopPipVoice()
            setVoiceEnabled(!voiceEnabled)
          }}
        >
          <span aria-hidden="true">{voiceEnabled ? '🔊' : '🔇'}</span>
        </button>
      </div>
      )}

      <div ref={contentRef} className="cabin__content">
        {children}
      </div>
    </div>
  )
}
