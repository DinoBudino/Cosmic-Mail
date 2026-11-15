import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getActiveExplorer, getActiveWorld } from '../data/spiritSite'
import { getSiteTitle } from '../data/siteTitle'
import { emitAudio } from '../game/audio/audioEvents'
import { useGameStore } from '../store/gameStore'

/** How long the name stays on screen before it leaves (ms). */
const HOLD_MS = 3700
const HOLD_REDUCED_MS = 2600
/** The leaving fade (matches the CSS). */
const LEAVE_MS = 700
/** A tap or key skips the card, but not in the first instant. */
const SKIP_AFTER_MS = 900

/**
 * Opens every landing, before PIP or the HUD: the name of the place in big
 * letters ("GUSEV CRATER"), like the first shot of a documentary. It starts
 * as the arrival veil lifts, with its own sound (a wind swell and bells on
 * Mars; no wind on the Moon), then hands over to the arrival briefing.
 * A tap, click or key press skips it.
 */
export function SiteTitle() {
  const stage = useGameStore((state) => state.arrivalStage)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const world = getActiveWorld()
  const title = useMemo(() => getSiteTitle(world, getActiveExplorer()), [world])
  const [leaving, setLeaving] = useState(false)
  const [startedAt, setStartedAt] = useState(0)

  const showing = stage === 'title'

  // No place to present (should not happen): hand over right away.
  useEffect(() => {
    if (showing && !title) useGameStore.getState().setArrivalStage('done')
  }, [showing, title])

  useEffect(() => {
    if (!showing || !title) return
    setLeaving(false)
    setStartedAt(performance.now())
    emitAudio(world === 'moon' ? 'siteRevealMoon' : 'siteRevealMars')
    const hold = window.setTimeout(
      () => setLeaving(true),
      reducedMotion ? HOLD_REDUCED_MS : HOLD_MS,
    )
    return () => window.clearTimeout(hold)
  }, [showing, title, world, reducedMotion])

  useEffect(() => {
    if (!leaving) return
    const done = window.setTimeout(
      () => useGameStore.getState().setArrivalStage('done'),
      LEAVE_MS,
    )
    return () => window.clearTimeout(done)
  }, [leaving])

  const skip = useCallback(() => {
    if (performance.now() - startedAt < SKIP_AFTER_MS) return
    setLeaving(true)
  }, [startedAt])

  useEffect(() => {
    if (!showing) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
        // Escape here only skips the title; it must not also open settings.
        if (event.key === 'Escape') event.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [showing, skip])

  if (!showing || !title) return null

  // Letters animate one by one; words stay whole when the name wraps.
  let letterIndex = 0
  const words = title.place
    .toUpperCase()
    .split(' ')
    .map((word) => Array.from(word).map((letter) => ({ letter, index: letterIndex++ })))
  return (
    <section
      className={`site-title${leaving ? ' is-leaving' : ''}`}
      data-world={world}
      aria-label={`${title.eyebrow}: ${title.place}`}
      onPointerDown={skip}
    >
      <p className="site-title__eyebrow">{title.eyebrow}</p>
      <h1 className="site-title__place">
        <span className="sr-only">{title.place}</span>
        <span aria-hidden="true">
          {words.map((word, wordIndex) => (
            <span key={wordIndex} className="site-title__word">
              {word.map(({ letter, index }) => (
                <span
                  key={index}
                  className="site-title__letter"
                  style={{ '--i': index } as CSSProperties}
                >
                  {letter}
                </span>
              ))}
            </span>
          ))}
        </span>
      </h1>
      <span className="site-title__rule" aria-hidden="true" />
      <p className="site-title__coords">{title.coordinates}</p>
    </section>
  )
}
