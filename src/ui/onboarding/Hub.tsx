import { useCallback, useEffect, useRef, useState } from 'react'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { hubElementEnabled, useHubFocus } from '../../store/hubFocus'
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
  const focus = useHubFocus()
  const navEnabled = hubElementEnabled(focus, 'nav')
  const albumEnabled = hubElementEnabled(focus, 'album')
  // During the guided tour the album and the navigation close-up stay
  // open until PIP has explained them.
  const albumCloseEnabled = hubElementEnabled(focus, 'album-close')
  const navBackEnabled = hubElementEnabled(focus, 'nav-back')
  const [closing, setClosing] = useState(false)
  const openedAtRef = useRef(0)
  const save = useJourneyStore((state) => state.save)
  const showFinalQuote = useJourneyStore((state) => state.showFinalQuote)
  const finaleOpen = Boolean(
    save && !save.finalQuoteShown && areAllMissionsComplete(save),
  )

  const requestClose = () => {
    if (closing || !albumCloseEnabled) return
    if (performance.now() - openedAtRef.current < 600) return
    setClosing(true)
  }

  const closeDetail = useCallback(() => {
    if (!closing && albumCloseEnabled) setClosing(true)
  }, [closing, albumCloseEnabled])

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
      if (event.key === 'Escape' && navBackEnabled) setRouteOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [routeOpen, setRouteOpen, navBackEnabled])

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
          disabled={!navBackEnabled}
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
            disabled={!navEnabled}
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
          disabled={!albumEnabled}
          onClick={() => setPassportDetailOpen(true)}
        >
          Open mission album
        </button>
      </div>

      {finaleOpen && <ArchiveFinale onClose={() => showFinalQuote()} />}

      {passportDetailOpen && (
        <div
          className={`passport-detail${focus.tourActive ? ' passport-detail--tour' : ''}`}
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
              className={`settings-resume passport-detail__close${
                focus.tourActive && focus.target === 'album-close'
                  ? ' is-tour-target'
                  : ''
              }`}
              disabled={!albumCloseEnabled}
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
