import { useEffect, useState } from 'react'
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

/** One typewritten line, remounted per message so its state starts clean. */
function PipLine({ message }: { message: string }) {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [typed, setTyped] = useState(reducedMotion ? message : '')

  useEffect(() => {
    if (reducedMotion) return
    const interval = window.setInterval(() => {
      setTyped((current) => {
        const next = message.slice(0, current.length + 1)
        if (next.length >= message.length) window.clearInterval(interval)
        return next
      })
    }, TYPE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [message, reducedMotion])

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="pip-text">
        {typed}
        <span className="pip-caret" aria-hidden="true" />
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
  const voiceName = useGameStore((state) => state.voiceName)
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
  const activeEmotion = current?.expression ?? null

  useEffect(() => {
    if (!activeText || hidden) {
      stopPipVoice()
      return
    }
    speakPip(activeText, voiceName, voiceEnabled, activeEmotion)
    return () => stopPipVoice()
  }, [
    activeKey,
    activeText,
    hidden,
    voiceName,
    voiceEnabled,
    activeEmotion,
  ])

  useEffect(() => {
    // Mission dialogue owns the box while it is active; do not surface a
    // stale region message afterwards.
    if (current && pipMessage) clearPipMessage()
  }, [current, pipMessage, clearPipMessage])

  useEffect(() => {
    if (!activeText || hidden) return
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      if (activeNarrative) completeNarrative()
      else clearPipMessage()
    }
    // With voice enabled, the next line waits for the real recording. The
    // timer is only a fallback for muted/blocked/missing audio.
    const unsubscribe = voiceEnabled
      ? onPipVoiceEnded(finish)
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

  if (!activeText || hidden) return null

  const skip = () => {
    if (activeNarrative) completeNarrative()
    else clearPipMessage()
  }

  return (
    <aside
      className="pip-speech"
      data-emotion={activeEmotion ?? 'neutral'}
      aria-label="PIP is speaking"
    >
      <PipAvatar />
      <div className="pip-speech__copy">
        <div className="pip-speech__head">
          <p className="pip-name">PIP</p>
          <button
            type="button"
            className="pip-speech__skip"
            onClick={skip}
            aria-label="Dismiss PIP's message"
          >
            {activeNarrative && queueLength > 0
              ? 'Next'
              : reducedMotion
                ? 'Close'
                : 'Skip'}
          </button>
        </div>
        <PipLine key={activeKey ?? 'pip'} message={activeText} />
      </div>
    </aside>
  )
}
