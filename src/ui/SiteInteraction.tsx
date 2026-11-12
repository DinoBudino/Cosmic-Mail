import { useEffect, useRef } from 'react'
import { MARS_OBJECTS, REGION_INFO, type ObjectState } from '../data/marsObjects'
import { useGameStore } from '../store/gameStore'

const STATE_LABELS: Record<ObjectState, string> = {
  landmark: 'Historic landmark',
  'coming-soon': 'Memorial in preparation',
}

/**
 * Informational Mars landmarks. They are stylized memorial scenes, not
 * playable missions in the new Cosmic Mail route, and the machines never
 * speak or receive letters in the fiction.
 */
export function SiteInteraction() {
  const nearbyId = useGameStore((state) => state.nearbySiteId)
  const activeId = useGameStore((state) => state.activeSiteId)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerCard = useGameStore(
    (state) => state.scannerCardComponentId,
  )
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const travelTargetId = useGameStore((state) => state.travelTargetId)
  const openSite = useGameStore((state) => state.openNearbySite)
  const closeSite = useGameStore((state) => state.closeSite)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const active = MARS_OBJECTS.find((site) => site.id === activeId)
  const nearby = MARS_OBJECTS.find((site) => site.id === nearbyId)

  useEffect(() => {
    if (!activeId) return
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus()
      }
    }
  }, [activeId])

  return (
    <>
      {!active &&
        !settingsOpen &&
        !scannerOpen &&
        !scannerEquipped &&
        !scannerCard &&
        !scannerRecordsOpen &&
        !archiveOpen &&
        nearby && (
          <aside className="site-prompt" aria-label="Mars landmark information">
            <p className="settings-eyebrow">Mars landmark</p>
            <div role="status" aria-live="polite" aria-atomic="true">
              <h2>{nearby.name}</h2>
              <p className="site-region">
                {REGION_INFO[nearby.id].regionName}
              </p>
              <p>{STATE_LABELS[nearby.state]}</p>
              <p>{nearby.description}</p>
            </div>
            <button type="button" className="site-action" onClick={openSite}>
              <span className="desktop-interact">
                Press E or click to inspect
              </span>
              <span className="touch-interact">Tap to inspect</span>
              <span className="sr-only"> {nearby.name}</span>
            </button>
            {travelTargetId && (
              <p className="site-travel">
                Travelling to{' '}
                {
                  MARS_OBJECTS.find((site) => site.id === travelTargetId)
                    ?.name
                }
                …
              </p>
            )}
          </aside>
        )}
      {active && (
        <dialog
          ref={dialogRef}
          className="settings-panel site-dialog"
          aria-labelledby="site-title"
          aria-describedby="site-description"
          onCancel={(event) => {
            event.preventDefault()
            closeSite()
          }}
        >
          <div className="settings-header">
            <div>
              <p className="settings-eyebrow">
                Mars landmark · {STATE_LABELS[active.state]}
              </p>
              <h2 id="site-title">{active.name}</h2>
            </div>
            <button
              type="button"
              className="settings-close"
              aria-label="Close landmark information"
              onClick={closeSite}
            >
              ×
            </button>
          </div>
          <p id="site-description" className="settings-description">
            {active.description}
          </p>
          <p className="settings-hint">
            A stylized memorial scene. This machine is no longer operating and
            does not speak or respond; it is not part of the mission
            progression.
          </p>
          <nav aria-label="NASA mission sources" className="site-sources">
            {active.sources.map((source, index) => (
              <a
                key={source}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
              >
                NASA mission source
                {active.sources.length > 1 ? ` ${index + 1}` : ''} ↗
              </a>
            ))}
          </nav>
          <button
            type="button"
            className="settings-resume"
            onClick={closeSite}
          >
            Return to exploring
          </button>
        </dialog>
      )}
    </>
  )
}
