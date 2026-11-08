import { useEffect, useRef, useState } from 'react'
import { MARS_OBJECTS, type MarsObjectId, type ObjectState } from '../data/marsObjects'
import { useGameStore } from '../store/gameStore'

const STATE_LABELS: Record<ObjectState, string> = {
  available: 'Available to explore',
  'coming-soon': 'Coming soon',
  'in-progress': 'In progress',
  rescued: 'Rescued',
}

function TravelControls() {
  const [destination, setDestination] = useState<MarsObjectId>('opportunity')
  const targetId = useGameStore((state) => state.travelTargetId)
  const startTravel = useGameStore((state) => state.startTravel)
  const cancelTravel = useGameStore((state) => state.cancelTravel)
  const target = MARS_OBJECTS.find((site) => site.id === targetId)

  return (
    <details className="travel-controls">
      <summary>Travel assistance</summary>
      <p id="travel-help">Choose a site to walk there automatically. Manual movement, settings or leaving the window stops the trip.</p>
      <label htmlFor="travel-destination">Destination</label>
      <select id="travel-destination" value={destination} onChange={(event) => {
        const site = MARS_OBJECTS.find((item) => item.id === event.target.value)
        if (site) setDestination(site.id)
      }} aria-describedby="travel-help">
        {MARS_OBJECTS.map((site) => <option key={site.id} value={site.id}>{site.name}{site.state === 'coming-soon' ? ' — Coming soon' : ''}</option>)}
      </select>
      <button type="button" className="site-action" onClick={() => startTravel(destination)}>Travel to selected site</button>
      {target && <button type="button" className="site-action" onClick={cancelTravel}>Stop travel to {target.name}</button>}
    </details>
  )
}

export function SiteInteraction() {
  const nearbyId = useGameStore((state) => state.nearbySiteId)
  const activeId = useGameStore((state) => state.activeSiteId)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const preview = useGameStore((state) => state.challengePreview)
  const travelTargetId = useGameStore((state) => state.travelTargetId)
  const openSite = useGameStore((state) => state.openNearbySite)
  const closeSite = useGameStore((state) => state.closeSite)
  const startChallenge = useGameStore((state) => state.startChallenge)
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
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [activeId])

  return (
    <>
      {!active && !settingsOpen && (
        <aside className="site-prompt" aria-label="Companion guidance">
          <p className="settings-eyebrow">Mail companion</p>
          <div role="status" aria-live="polite" aria-atomic="true">
            {nearby ? (
              <>
                <h2>{nearby.name}</h2>
                <p>{STATE_LABELS[nearby.state]}</p>
                <p>{nearby.description}</p>
              </>
            ) : <p>{travelTargetId ? `Walking to ${MARS_OBJECTS.find((site) => site.id === travelTargetId)?.name}.` : 'Step inside a glowing ring to inspect an explorer.'}</p>}
          </div>
          {nearby && (
            <button type="button" className="site-action" onClick={openSite}>
              <span className="desktop-interact">Press E or click to inspect</span>
              <span className="touch-interact">Tap to inspect</span>
              <span className="sr-only"> {nearby.name}</span>
            </button>
          )}
          <TravelControls />
        </aside>
      )}
      {active && (
        <dialog
          ref={dialogRef}
          className="settings-panel site-dialog"
          aria-labelledby="site-title"
          aria-describedby="site-description"
          onCancel={(event) => { event.preventDefault(); closeSite() }}
        >
          <div className="settings-header">
            <div>
              <p className="settings-eyebrow">Mars explorer · {STATE_LABELS[active.state]}</p>
              <h2 id="site-title">{active.name}</h2>
            </div>
            <button type="button" className="settings-close" aria-label="Close explorer information" onClick={closeSite}>×</button>
          </div>
          <p id="site-description" className="settings-description">{active.description}</p>
          <p className="settings-hint">This is a stylized memorial scene. These missions are no longer operating. Letters and rescues in the game are fictional, not real transmissions.</p>
          <nav aria-label="NASA mission sources" className="site-sources">
            {active.sources.map((source, index) => <a key={source} href={source} target="_blank" rel="noopener noreferrer">NASA mission source{active.sources.length > 1 ? ` ${index + 1}` : ''} ↗</a>)}
          </nav>
          {active.state === 'coming-soon' ? (
            <p className="site-preview">Coming soon — this explorer’s activity is not available yet.</p>
          ) : (
            <>
              <button type="button" className="site-action" onClick={() => startChallenge(active.id)} disabled={preview}>Preview future challenge</button>
              {preview && <p className="site-preview" role="status">Challenge not available yet. This preview awards no rescue, letter delivery or stamp. You can keep exploring.</p>}
            </>
          )}
          <button type="button" className="settings-resume" onClick={closeSite}>Return to exploring</button>
        </dialog>
      )}
    </>
  )
}
