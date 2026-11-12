import { useCallback, useEffect, useRef, useState } from 'react'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { areAllMissionsComplete } from '../../store/journeyLogic'
import { ArchiveFinale } from './ArchiveFinale'
import { DestinationNavigation } from './DestinationNavigation'
import { Passport } from './Passport'

/**
 * Cabin hub. The passport card and navigation screen live in the 3D
 * cabin (MenuScene); the DOM mirrors below keep keyboard and screen
 * reader access without duplicating the visual layer.
 */
export function Hub() {
  const goBack = useOnboardingStore((state) => state.goBack)
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const setRouteOpen = useOnboardingStore((state) => state.setRouteOpen)
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)
  const takeOff = useOnboardingStore((state) => state.takeOff)
  const passportDetailOpen = useOnboardingStore(
    (state) => state.passportDetailOpen,
  )
  const setPassportDetailOpen = useOnboardingStore(
    (state) => state.setPassportDetailOpen,
  )
  const [closing, setClosing] = useState(false)
  const openedAtRef = useRef(0)
  const save = useJourneyStore((state) => state.save)
  const showFinalQuote = useJourneyStore((state) => state.showFinalQuote)
  const finaleOpen = Boolean(
    save && !save.finalQuoteShown && areAllMissionsComplete(save),
  )

  const requestClose = () => {
    if (closing) return
    if (performance.now() - openedAtRef.current < 600) return
    setClosing(true)
  }

  const closeDetail = useCallback(() => {
    if (!closing) setClosing(true)
  }, [closing])

  const finishClose = () => {
    setClosing(false)
    setPassportDetailOpen(false)
  }

  useEffect(() => {
    if (passportDetailOpen) openedAtRef.current = performance.now()
  }, [passportDetailOpen])

  useEffect(() => {
    if (!routeOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRouteOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [routeOpen, setRouteOpen])

  useEffect(() => {
    if (!passportDetailOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDetail()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [passportDetailOpen, closeDetail])

  return (
    <section className="hub" aria-label="Cosmic Mail control center">
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

      {routeOpen && (
        <div className="mirror" aria-label="Navigation choices (keyboard)">
          <DestinationNavigation />
        </div>
      )}

      {!routeOpen && (
        <div className="mirror">
          <button
            type="button"
            className="mirror-controls"
            onClick={() => setRouteOpen(true)}
          >
            Open navigation (keyboard)
          </button>
          {routeConfirmed && (
            <button
              type="button"
              className="mirror-controls"
              onClick={takeOff}
            >
              Take off (keyboard)
            </button>
          )}
        </div>
      )}

      <div className="mirror">
        <button
          type="button"
          className="mirror-controls"
          onClick={() => setPassportDetailOpen(true)}
        >
          View my passport
        </button>
      </div>

      {finaleOpen && <ArchiveFinale onClose={() => showFinalQuote()} />}

      {passportDetailOpen && (
        <div
          className="passport-detail"
          onClick={(event) => {
            if (event.target === event.currentTarget) requestClose()
          }}
        >
          <div
            className={`passport-detail__card${
              closing ? ' is-closing' : ''
            }`}
            onAnimationEnd={closing ? finishClose : undefined}
          >
            <Passport pinned />
            <button
              type="button"
              className="settings-resume passport-detail__close"
              onClick={closeDetail}
            >
              Back to cabin
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
