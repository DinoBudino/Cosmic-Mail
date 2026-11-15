import { useEffect, useRef, useState } from 'react'
import {
  onPipVoiceEnded,
  speakPip,
  stopPipVoice,
} from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { isPipSpeechHidden } from './pipSpeechVisibility'

const LEGACY_MESSAGE_LIFETIME_MS = 6000
const TYPE_INTERVAL_MS = 18

/**
 * Fallback lifetime for the rare case where the voice cannot report its end
 * (muted voice, blocked audio, missing recording). With voice enabled the
 * box advances on the real audio end instead.
 */
function narrativeDuration(text: string): number {
  return Math.min(18000, Math.max(6000, 1800 + text.length * 70))
}

/** Faster pacing when voice output is disabled and only reading remains. */
function readingDuration(text: string): number {
  return Math.min(9000, Math.max(4200, 1400 + text.length * 52))
}

export function PipAvatar() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="pip-avatar">
      <circle cx="24" cy="24" r="22" fill="#2A1D3B" />
      <circle cx="24" cy="24" r="19" fill="#F2EAE5" />
      <ellipse cx="24" cy="26" rx="14" ry="12" fill="#17172E" />
      <rect x="15" y="28" width="18" height="2.4" rx="1.2" fill="#F2B5E2" />
      <circle cx="19.5" cy="23.5" r="2.4" fill="#F2B5E2" />
      <circle cx="28.5" cy="23.5" r="2.4" fill="#F2B5E2" />
      <path d="M34 8c2.4 1.2 4 3.4 4.3 6" fill="none" stroke="#F2B5E2" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="38.6" cy="15.6" r="2" fill="#F2B5E2" />
    </svg>
  )
}

/**
 * One typewritten line, remounted per message so its state starts clean.
 * `forceFull` shows the complete subtitle immediately (first press of the
 * skip button); the voice keeps playing until the next press dismisses it.
 */
export function PipLine({
  message,
  forceFull,
  onFullyTyped,
}: {
  message: string
  forceFull: boolean
  onFullyTyped: () => void
}) {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [typed, setTyped] = useState(reducedMotion ? message : '')
  const onFullyTypedRef = useRef(onFullyTyped)

  useEffect(() => {
    onFullyTypedRef.current = onFullyTyped
  }, [onFullyTyped])

  useEffect(() => {
    if (reducedMotion || forceFull) return
    const interval = window.setInterval(() => {
      setTyped((current) =>
        current.length >= message.length
          ? current
          : message.slice(0, current.length + 1),
      )
    }, TYPE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [message, reducedMotion, forceFull])

  // Notify the parent from an effect, never from a state updater (which
  // runs during render and would update PipSpeech mid-render).
  const fullyTyped = typed.length >= message.length
  useEffect(() => {
    if (fullyTyped && !reducedMotion && !forceFull) {
      onFullyTypedRef.current()
    }
  }, [fullyTyped, reducedMotion, forceFull])

  const shown = reducedMotion || forceFull ? message : typed
  const typing = !reducedMotion && !forceFull && typed.length < message.length

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="pip-text">
        {shown}
        {typing && <span className="pip-caret" aria-hidden="true" />}
      </p>
    </div>
  )
}

/**
 * PIP's dialogue box. New mission lines come from the narrative queue;
 * legacy region/site messages still use gameStore.pipMessage. The box is
 * available while the scanner is equipped, but yields to reading modals.
 */
export function PipSpeech() {
  const current = useNarrativeStore((state) => state.current)
  const queueLength = useNarrativeStore((state) => state.queue.length)
  const completeNarrative = useNarrativeStore((state) => state.complete)

  const pipMessage = useGameStore((state) => state.pipMessage)
  const pipMessageKey = useGameStore((state) => state.pipMessageKey)
  const clearPipMessage = useGameStore((state) => state.clearPipMessage)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerCard = useGameStore((state) => state.scannerCardComponentId)
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const activeSiteId = useGameStore((state) => state.activeSiteId)

  const hidden = isPipSpeechHidden({
    scannerEquipped,
    scannerOpen,
    scannerCardComponentId: scannerCard,
    scannerRecordsOpen,
    archiveOpen,
    settingsOpen,
    activeSiteId,
  })
  const activeKey = current
    ? `narrative-${current.nonce}`
    : pipMessage
      ? `legacy-${pipMessageKey}`
      : null
  const activeText = current?.text ?? pipMessage ?? null
  const activeNarrative = Boolean(current)
  const [forcedKey, setForcedKey] = useState<string | null>(null)
  const [typedKey, setTypedKey] = useState<string | null>(null)
  const lineFullyShown =
    reducedMotion || (activeKey !== null && (forcedKey === activeKey || typedKey === activeKey))
  const activeEmotion = current?.expression ?? null

  useEffect(() => {
    if (!activeText || hidden) {
      stopPipVoice()
      return
    }
    speakPip(activeText, voiceEnabled, activeEmotion)
    return () => stopPipVoice()
  }, [
    activeKey,
    activeText,
    hidden,
    voiceEnabled,
    activeEmotion,
  ])

  useEffect(() => {
    // Mission dialogue owns the box while it is active; do not surface a
    // stale region message afterwards.
    if (current && pipMessage) clearPipMessage()
  }, [current, pipMessage, clearPipMessage])

  // Keep the latest "subtitle is complete" fact for the voice-end handler.
  const fullyShownRef = useRef(false)
  useEffect(() => {
    fullyShownRef.current = lineFullyShown
  }, [lineFullyShown])

  // The player may move past a line while it plays (a step changed, the
  // explorer was identified): such lines are cancelled, not finished.
  const dropStaleCurrent = useNarrativeStore((state) => state.dropStaleCurrent)
  useEffect(() => {
    if (!activeNarrative || hidden) return
    dropStaleCurrent()
    const timer = window.setInterval(dropStaleCurrent, 400)
    return () => window.clearInterval(timer)
  }, [activeKey, activeNarrative, hidden, dropStaleCurrent])

  useEffect(() => {
    if (!activeText || hidden) return
    let finished = false
    const pending: number[] = []
    const finish = () => {
      if (finished) return
      finished = true
      if (activeNarrative) completeNarrative()
      else clearPipMessage()
    }
    // With voice enabled, the next line waits for the real recording. If the
    // voice ends before the typewriter does, the full subtitle is shown and
    // held briefly so the last word is never cut off.
    const unsubscribe = voiceEnabled
      ? onPipVoiceEnded(() => {
          if (fullyShownRef.current) {
            pending.push(window.setTimeout(finish, 500))
          } else {
            setForcedKey(activeKey)
            pending.push(window.setTimeout(finish, 1300))
          }
        })
      : () => undefined
    const lifetime = activeNarrative
      ? voiceEnabled
        ? narrativeDuration(activeText)
        : readingDuration(activeText)
      : LEGACY_MESSAGE_LIFETIME_MS
    const timer = window.setTimeout(finish, lifetime)
    return () => {
      finished = true
      window.clearTimeout(timer)
      for (const id of pending) window.clearTimeout(id)
      unsubscribe()
    }
  }, [
    activeKey,
    activeText,
    activeNarrative,
    hidden,
    completeNarrative,
    clearPipMessage,
    voiceEnabled,
  ])

  const showing = Boolean(activeText) && !hidden
  // Action tips are shown (and typed) by the tip card; the voice and the
  // timing above still run from here.
  if (!showing || current?.tip) return null

  const skip = () => {
    // First press completes the subtitle; the next press moves on.
    if (!lineFullyShown) {
      setForcedKey(activeKey)
      return
    }
    if (activeNarrative) completeNarrative()
    else clearPipMessage()
  }

  return (
    <aside
      className="pip-speech"
      data-emotion={activeEmotion ?? 'neutral'}
      aria-label="PIP is speaking"
      onClick={(event) => {
        // The Skip button handles itself; a click anywhere else on the box
        // does the same. Enter works on the focused button.
        if ((event.target as HTMLElement).closest('button')) return
        skip()
      }}
    >
      <PipAvatar />
      <div className="pip-speech__copy">
        <div className="pip-speech__head">
          <p className="pip-name">PIP</p>
          <button
            type="button"
            className="pip-speech__skip"
            onClick={skip}
            aria-label={
              lineFullyShown
                ? "Dismiss PIP's message"
                : "Show PIP's full message"
            }
          >
            {!lineFullyShown
              ? 'Show all'
              : activeNarrative && queueLength > 0
                ? 'Next'
                : reducedMotion
                  ? 'Close'
                  : 'Skip'}
          </button>
        </div>
        <PipLine
          key={activeKey ?? 'pip'}
          message={activeText ?? ""}
          forceFull={forcedKey === activeKey}
          onFullyTyped={() => setTypedKey(activeKey)}
        />
      </div>
    </aside>
  )
}
