import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * Cinema bars for the sighting and the identification film (close shots
 * of the explorer, see explorerShots.ts). The label sits in the top bar and
 * Skip in the bottom one, so the picture stays clear. It never blocks
 * movement: walking, equipping the scanner or Skip ends it at once. PIP's
 * line stays in PipSpeech.
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
      <div className="cinematic-focus__bar cinematic-focus__bar--top">
        <div className="cinematic-focus__label">
          <p className="settings-eyebrow">
            {cinematic.kind === 'sighting'
              ? 'Unknown signal'
              : 'Archive association recovered'}
          </p>
          <p>
            {cinematic.kind === 'sighting'
              ? 'Something is resting on the horizon.'
              : 'Take a good look while PIP remembers.'}
          </p>
        </div>
      </div>
      <div className="cinematic-focus__bar cinematic-focus__bar--bottom">
        <button
          type="button"
          className="cinematic-focus__skip"
          onClick={endCinematic}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
