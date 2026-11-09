import { useEffect, useState } from 'react'
import { speakPip, stopPipVoice } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'

const PIP_MESSAGE_LIFETIME_MS = 6000
const TYPE_INTERVAL_MS = 18

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
 * PIP's dialogue box (bottom-left, separate from mission/site info):
 * subtitles with a typewriter effect, spoken with Samantha (or the
 * selected system voice) when voice output is enabled.
 */
export function PipSpeech() {
  const pipMessage = useGameStore((state) => state.pipMessage)
  const pipMessageKey = useGameStore((state) => state.pipMessageKey)
  const clearPipMessage = useGameStore((state) => state.clearPipMessage)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)

  useEffect(() => {
    if (!pipMessage) {
      stopPipVoice()
      return
    }
    speakPip(pipMessage, voiceName, voiceEnabled)
  }, [pipMessage, pipMessageKey, voiceName, voiceEnabled])

  useEffect(() => {
    if (!pipMessage) return
    const timer = window.setTimeout(clearPipMessage, PIP_MESSAGE_LIFETIME_MS)
    return () => window.clearTimeout(timer)
  }, [pipMessage, pipMessageKey, clearPipMessage])

  if (!pipMessage) return null

  return (
    <aside className="pip-speech" aria-label="PIP is speaking">
      <PipAvatar />
      <div>
        <p className="pip-name">PIP</p>
        <PipLine key={pipMessageKey} message={pipMessage} />
      </div>
    </aside>
  )
}
