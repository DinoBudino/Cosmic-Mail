import { useEffect } from 'react'
import { getMission } from '../data/missions'
import { SPIRIT_SITE } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'

/**
 * Cinema bars for the sighting, the identification film (close shots of
 * the explorer, see explorerShots.ts) and the close-up of each part found,
 * where PIP flies in beside it. The label sits in the top bar and
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

  const part =
    cinematic.kind === 'part' && cinematic.componentId
      ? getMission(SPIRIT_SITE.missionId).components.find(
          (component) => component.id === cinematic.componentId,
        )
      : null
  const eyebrow =
    cinematic.kind === 'sighting'
      ? 'Unknown signal'
      : cinematic.kind === 'part'
        ? 'Part recovered'
        : cinematic.kind === 'send'
          ? 'Message ready'
          : 'Archive association recovered'
  const line =
    cinematic.kind === 'sighting'
      ? 'Something is resting on the horizon.'
      : cinematic.kind === 'part'
        ? partTitle(part)
        : cinematic.kind === 'send'
          ? 'Next stop: Earth'
          : 'Take a good look while PIP remembers.'

  return (
    <div className="cinematic-focus" aria-live="polite">
      <div className="cinematic-focus__bar cinematic-focus__bar--top">
        <div className="cinematic-focus__label">
          <p className="settings-eyebrow">{eyebrow}</p>
          <p
            className={
              cinematic.kind === 'part' || cinematic.kind === 'send'
                ? 'cinematic-focus__part'
                : undefined
            }
          >
            {line}
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

/** "Rock tool · RAT": the child's word first, the real name after it. */
function partTitle(
  part: { shortName: string; huntClue?: { label: string } } | null | undefined,
): string {
  if (!part) return 'A piece of its story'
  const label = part.huntClue?.label
  if (!label || part.shortName.toLowerCase().includes(label.toLowerCase())) {
    return part.shortName
  }
  return `${label} · ${part.shortName}`
}
