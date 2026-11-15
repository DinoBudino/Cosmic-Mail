import { useEffect, useRef } from 'react'

/** Elements with their own action: a click there never advances PIP. */
const OWN_ACTION_SELECTOR =
  'button, a, input, select, textarea, label, [role="button"], [role="tab"], [role="switch"], [data-no-advance]'

/** Ignore input this long after a new line appears (no double skips). */
export const ADVANCE_GUARD_MS = 300

interface Closest {
  closest: (selector: string) => unknown
}

function ownActionOf(target: unknown): unknown {
  const candidate = target as Partial<Closest> | null
  if (!candidate || typeof candidate.closest !== 'function') return null
  return candidate.closest(OWN_ACTION_SELECTOR)
}

/** True when a pointer press on this target may advance the dialogue. */
export function isAdvanceClickTarget(target: unknown): boolean {
  return ownActionOf(target) == null
}

/** True when this key press may advance the dialogue. */
export function isAdvanceKey(
  key: string,
  repeat: boolean,
  focused: unknown,
): boolean {
  if (repeat) return false
  if (key !== ' ' && key !== 'Enter') return false
  // A focused control answers Space/Enter itself.
  return ownActionOf(focused) == null
}

/**
 * PIP's dialogue moves on with a click anywhere on screen (or Space /
 * Enter), so a child never has to aim at the speech bubble. Clicks on
 * buttons and other controls keep their own action.
 *
 * `lineKey` changes with every new line: input right after a change is
 * ignored for a moment, so a quick double click advances only once.
 */
export function useAdvanceAnywhere(
  enabled: boolean,
  onAdvance: () => void,
  lineKey: string | number,
): void {
  const advanceRef = useRef(onAdvance)
  useEffect(() => {
    advanceRef.current = onAdvance
  }, [onAdvance])

  const readyAt = useRef(0)
  useEffect(() => {
    readyAt.current = performance.now() + ADVANCE_GUARD_MS
  }, [lineKey])

  useEffect(() => {
    if (!enabled) return
    const fire = () => {
      if (performance.now() < readyAt.current) return
      readyAt.current = performance.now() + ADVANCE_GUARD_MS
      advanceRef.current()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return
      if (!isAdvanceClickTarget(event.target)) return
      fire()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isAdvanceKey(event.key, event.repeat, document.activeElement)) return
      event.preventDefault()
      fire()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled])
}
