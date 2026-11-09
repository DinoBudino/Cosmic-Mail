import { useEffect, useRef, useState } from 'react'
import { useOnboardingStore } from '../../store/onboardingStore'
import { Passport } from './Passport'
import { RouteSelect } from './RouteSelect'

/**
 * Control center: the cabin hub the pilot returns to between missions.
 * The passport card and the navigation panel live IN the 3D cabin
 * (see MenuScene); the DOM copies below are their accessible mirrors
 * for keyboard / screen-reader users, revealed on focus.
 */
export function Hub() {
  const goBack = useOnboardingStore((state) => state.goBack)
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const setRouteOpen = useOnboardingStore((state) => state.setRouteOpen)
  const passportDetailOpen = useOnboardingStore((state) => state.passportDetailOpen)
  const setPassportDetailOpen = useOnboardingStore((state) => state.setPassportDetailOpen)
  const [closing, setClosing] = useState(false)
  const openedAtRef = useRef(0)

  // Clicking outside the card dismisses it; it shrinks back toward the
  // 3D card on the console before unmounting. The opening click must
  // not leak into the dismiss handler, so closes are ignored briefly
  // after opening.
  const requestClose = () => {
    if (closing) return
    // The opening gesture (3D card tap) must never leak into a close:
    // ignore dismissals for a beat after opening.
    if (performance.now() - openedAtRef.current < 600) return
    setClosing(true)
  }

  const finishClose = () => {
    setClosing(false)
    setPassportDetailOpen(false)
  }

  useEffect(() => {
    if (passportDetailOpen) openedAtRef.current = performance.now()
  }, [passportDetailOpen])

  // Escape closes the navigation close-up, back to the cabin view.
  useEffect(() => {
    if (!routeOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRouteOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [routeOpen, setRouteOpen])

  return (
    <section className="hub" aria-label="Control center">
      {routeOpen ? (
        <button
          type="button"
          className="identity__back"
          onClick={() => setRouteOpen(false)}
        >
          ← Back to cabin
        </button>
      ) : (
        <button type="button" className="identity__back" onClick={goBack}>
          ← Back
        </button>
      )}

      <div className="mirror" aria-label="Navigation choices (keyboard)">
        <RouteSelect />
      </div>

      <div className="mirror">
        <button
          type="button"
          className="mirror-controls"
          onClick={() => setPassportDetailOpen(true)}
        >
          View my passport
        </button>
      </div>

      {passportDetailOpen && (
        <div
          className="passport-detail"
          onClick={(event) => {
            if (event.target === event.currentTarget) requestClose()
          }}
        >
          <div
            className={`passport-detail__card${closing ? ' is-closing' : ''}`}
            // Only the EXIT animation should unmount — the entrance
            // zoom-in must not trigger finishClose (that closed the
            // detail right after opening).
            onAnimationEnd={closing ? finishClose : undefined}
          >
            <Passport pinned />
          </div>
        </div>
      )}
    </section>
  )
}
