import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * Lightweight in-engine emphasis for sighting and identification. It never
 * blocks movement: walking, equipping the scanner or pressing Skip ends the
 * camera focus immediately. The narrative line remains in PipSpeech.
 */
export function CinematicOverlay() {
  const cinematic = useGameStore((state) => state.cinematicFocus)
  const endCinematic = useGameStore((state) => state.endCinematic)

  useEffect(() => {
    if (!cinematic) return
    const remaining = cinematic.until - Date.now()
    if (remaining <= 0) {
      endCinematic()
      return
    }
    const timer = window.setTimeout(endCinematic, remaining)
    return () => window.clearTimeout(timer)
  }, [cinematic, endCinematic])

  if (!cinematic) return null

  return (
    <div className="cinematic-focus" aria-live="polite">
      <div className="cinematic-focus__bar cinematic-focus__bar--top" />
      <div className="cinematic-focus__label">
        <p className="settings-eyebrow">
          {cinematic.kind === 'sighting'
            ? 'Unknown signal'
            : 'Archive association recovered'}
        </p>
        <p>
          {cinematic.kind === 'sighting'
            ? 'Something is resting on the horizon.'
            : 'PIP is reconnecting a historical record.'}
        </p>
        <button
          type="button"
          className="cinematic-focus__skip"
          onClick={endCinematic}
        >
          Skip focus
        </button>
      </div>
      <div className="cinematic-focus__bar cinematic-focus__bar--bottom" />
    </div>
  )
}
