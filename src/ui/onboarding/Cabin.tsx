import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  REGISTRATION_LINE,
  type HubAwait,
  type HubDialogueStep,
} from '../../data/onboardingNarrative'
import { speakPip, stopPipVoice } from '../../game/pipVoice'
import { useGameStore } from '../../store/gameStore'
import { tourIndexFor, useHubFocus } from '../../store/hubFocus'
import { useOnboardingStore } from '../../store/onboardingStore'
import { PipAvatar } from '../PipSpeech'
import { useAdvanceAnywhere } from '../useAdvanceAnywhere'
import { isCoarsePointer } from '../../game/missionNarrative'
import { useAlbumPipSlot } from './albumPipSlot'

/** PIP's dialogue steps for the current cabin step. */
function useDialogueSteps(): HubDialogueStep[] {
  const phase = useOnboardingStore((state) => state.phase)
  const focus = useHubFocus()
  if (phase === 'registration') {
    return [{ line: REGISTRATION_LINE, target: null, awaits: null, place: 'cabin' }]
  }
  return focus.steps
}

const AWAIT_HINT: Record<HubAwait, string> = {
  album: 'Tap the mission album',
  'tab-stamps': 'Tap Stamps',
  'tab-discoveries': 'Tap Discoveries',
  'album-close': 'Tap the X to close the album',
  nav: 'Tap the navigation screen',
  destination: 'Tap a place with a signal',
  confirm: 'Tap Confirm route',
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
    speakPip(line, voiceEnabled)
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
  }, [line, reducedMotion, voiceEnabled, setPipTalking, onDone])

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
  const steps = useDialogueSteps()
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
        '.tablet, .carrier-terminal, .onboarding__panel',
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

  const stepIndex = Math.min(dialogueIndex, Math.max(0, steps.length - 1))
  const step = steps[stepIndex] ?? null
  const line = step?.line ?? ''
  const awaits = step?.awaits ?? null
  const isLastLine = dialogueIndex >= steps.length - 1

  const albumTab = useOnboardingStore((state) => state.albumTab)
  const selectedDestination = useOnboardingStore(
    (state) => state.selectedDestination,
  )

  // Guided steps: doing what PIP asks (opening the album, a tab, the
  // navigation screen, picking a place) is what moves the tour on.
  useEffect(() => {
    if (phase !== 'hub' || steps.length === 0) return
    const next = tourIndexFor(steps, stepIndex, {
      albumOpen: passportDetailOpen,
      routeOpen,
      albumTab,
      selectedDestination,
    })
    if (next !== stepIndex) setDialogueIndex(next)
  }, [
    phase,
    steps,
    stepIndex,
    passportDetailOpen,
    routeOpen,
    albumTab,
    selectedDestination,
    setDialogueIndex,
  ])

  const handleDone = useCallback(() => setTypingDone(true), [])

  const [seenLine, setSeenLine] = useState(line)
  if (seenLine !== line) {
    setSeenLine(line)
    setTypingDone(false)
    setSkipNonce(0)
  }

  const handleBubbleClick = useCallback(() => {
    if (!typingDone) {
      setSkipNonce((nonce) => nonce + 1)
      return
    }
    // A guided step only advances when the child opens the element.
    if (awaits) return
    if (!isLastLine) {
      setTypingDone(false)
      setDialogueIndex(dialogueIndex + 1)
      return
    }
    if (phase === 'hub') markHubVisited()
  }, [typingDone, awaits, isLastLine, setDialogueIndex, dialogueIndex, phase, markHubVisited])

  // PIP speaks where the child is: in the cabin, over the open album or
  // over the navigation close-up (docked at the top so it never covers
  // what he is explaining).
  const place = passportDetailOpen ? 'album' : routeOpen ? 'nav' : 'cabin'
  const stepPlace = step?.place ?? 'cabin'
  const bubbleHidden =
    phase === 'intro' || (phase === 'hub' && stepPlace !== place)
  // In the album PIP talks from the tablet's own PIP corner.
  const albumSlot = useAlbumPipSlot((state) => state.slot)
  const inAlbum = phase === 'hub' && place === 'album' && albumSlot !== null
  const docked = phase === 'hub' && place !== 'cabin' && !inAlbum

  // A click anywhere (or Space / Enter) moves PIP's tour on, so the child
  // never has to aim at the bubble. Steps that wait for the child to open
  // something keep waiting for that.
  const canAdvanceAnywhere =
    phase === 'hub' && !bubbleHidden && steps.length > 0 && (!typingDone || !awaits)
  useAdvanceAnywhere(canAdvanceAnywhere, handleBubbleClick, `${dialogueIndex}-${line}`)
  const touch = isCoarsePointer()

  const bubble = (
    <div
      className={`pip-bubble-wrap pip-bubble-wrap--${phase}${
        docked ? ' pip-bubble-wrap--docked' : ''
      }${inAlbum ? ' pip-bubble-wrap--album' : ''}`}
      ref={bubbleRef}
      style={{
        transform:
          !docked && !inAlbum && liftPx > 0 ? `translateY(${-liftPx}px)` : undefined,
      }}
    >
      <button
        type="button"
        className={`pip-bubble${awaits ? ' pip-bubble--awaits' : ''}`}
        onClick={handleBubbleClick}
        aria-label={
          awaits && typingDone
            ? AWAIT_HINT[awaits]
            : typingDone && !isLastLine
              ? 'Continue'
              : 'PIP is speaking'
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
          {awaits ? (
            <span className="pip-bubble__task">
              <span className="pip-bubble__task-dot" aria-hidden="true" />
              {AWAIT_HINT[awaits]}
            </span>
          ) : (
            typingDone &&
            !isLastLine && (
              <span className="pip-bubble__next" aria-hidden="true">
                {touch ? 'Tap anywhere' : 'Click anywhere'} ▸
              </span>
            )
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
  )

  return (
    <div className="cabin">
      <div className="boarding__veil" aria-hidden="true" />

      {!bubbleHidden && steps.length > 0 &&
        (inAlbum ? createPortal(bubble, albumSlot) : bubble)}

      <div ref={contentRef} className="cabin__content">
        {children}
      </div>
    </div>
  )
}
