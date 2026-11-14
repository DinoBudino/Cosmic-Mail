import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  REGISTRATION_LINE,
  hubDialogueLines,
} from '../../data/onboardingNarrative'
import { speakPip, stopPipVoice } from '../../game/pipVoice'
import { getSliceClosure } from '../../data/sliceClosure'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { PipAvatar } from '../PipSpeech'

/** PIP's dialogue lines for the current cabin step (written only, no voice). */
function useDialogueLines(): string[] {
  const phase = useOnboardingStore((state) => state.phase)
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)
  const hubVisited = useOnboardingStore((state) => state.hubVisited)
  const hubTourDone = useOnboardingStore((state) => state.hubTourDone)
  const save = useJourneyStore((state) => state.save)
  // PIP stays quiet while an archive dialog (letter, delivery) is open, so
  // the slice-closing lines never talk over the delivery ceremony.
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const closure = getSliceClosure(save)
  if (phase === 'hub' && archiveOpen) return []
  if (phase === 'registration') return [REGISTRATION_LINE]
  if (phase === 'hub') {
    return hubDialogueLines({
      routeConfirmed,
      hubVisited,
      hubTourDone,
      restoredCount: closure.restored,
      totalStories: closure.total,
    })
  }
  return []
}

/**
 * Typewriter line for PIP. While it runs, PIP "speaks" (his mouth moves
 * in the 3D scene). A skip nonce completes the line instantly.
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
    speakPip(line, voiceName, voiceEnabled)
    intervalRef.current = window.setInterval(() => {
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

  // Complete the visible line during render when a skip arrives (React's
  // "adjust state while rendering" pattern) instead of inside an effect.
  const [seenSkip, setSeenSkip] = useState(skipNonce)
  if (seenSkip !== skipNonce) {
    setSeenSkip(skipNonce)
    if (skipNonce !== 0 && !reducedMotion) setTyped(line)
  }

  useEffect(() => {
    if (skipNonce === 0 || reducedMotion) return
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    stopPipVoice()
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
 * Cockpit wrapper shared by registration and hub. The cinematic intro
 * owns its own subtitle bar; the cabin bubble is used after it.
 */
export function Cabin({ children }: { children: ReactNode }) {
  const lines = useDialogueLines()
  const phase = useOnboardingStore((state) => state.phase)
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const passportDetailOpen = useOnboardingStore(
    (state) => state.passportDetailOpen,
  )
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const setDialogueIndex = useOnboardingStore((state) => state.setDialogueIndex)
  const markHubVisited = useOnboardingStore((state) => state.markHubVisited)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const setVoiceEnabled = useGameStore((state) => state.setVoiceEnabled)
  const [typingDone, setTypingDone] = useState(false)
  const [skipNonce, setSkipNonce] = useState(0)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [liftPx, setLiftPx] = useState(0)

  useEffect(() => {
    const bubble = bubbleRef.current
    const content = contentRef.current
    if (!bubble || !content) return
    const adjust = () => {
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
        const desired = Math.min(120, Math.max(0, current + overlap))
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
  }, [children, phase])

  const line = lines[Math.min(dialogueIndex, Math.max(0, lines.length - 1))] ?? ''
  const isLastLine = dialogueIndex >= lines.length - 1
  const handleDone = useCallback(() => setTypingDone(true), [])

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
    if (phase === 'hub') markHubVisited()
  }

  const bubbleHidden =
    phase === 'intro' ||
    (phase === 'hub' && (passportDetailOpen || routeOpen))

  return (
    <div className="cabin">
      <div className="boarding__veil" aria-hidden="true" />

      {!bubbleHidden && lines.length > 0 && (
        <div
          className={`pip-bubble-wrap pip-bubble-wrap--${phase}`}
          ref={bubbleRef}
          style={{
            transform: liftPx > 0 ? `translateY(${-liftPx}px)` : undefined,
          }}
        >
          <button
            type="button"
            className="pip-bubble"
            onClick={handleBubbleClick}
            aria-label={
              typingDone && !isLastLine ? 'Continue' : 'PIP is speaking'
            }
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
            aria-label={
              voiceEnabled ? 'Turn PIP voice off' : 'Turn PIP voice on'
            }
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
