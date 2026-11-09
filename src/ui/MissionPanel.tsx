import { useState } from 'react'
import { MARS_OBJECTS, REGION_INFO, type MarsObjectId } from '../data/marsObjects'
import { useGameStore } from '../store/gameStore'

const STATE_DOT_CLASS: Record<string, string> = {
  available: 'mission-dot--available',
  'coming-soon': 'mission-dot--soon',
  'in-progress': 'mission-dot--progress',
  rescued: 'mission-dot--rescued',
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

/** Mission briefing (top-right): objective + explorer list, separate from PIP. */
export function MissionPanel() {
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const activeId = useGameStore((state) => state.activeSiteId)
  if (settingsOpen || activeId) return null

  return (
    <aside className="mission-panel" aria-label="Mission briefing">
      <p className="settings-eyebrow">Mission 01</p>
      <h2 className="mission-objective">Find Opportunity</h2>
      <ul className="mission-list">
        {MARS_OBJECTS.map((site) => (
          <li key={site.id} className="mission-item">
            <span className={`mission-dot ${STATE_DOT_CLASS[site.state]}`} aria-hidden="true" />
            <span className="mission-site">
              <strong>{site.name}</strong>
              <small>{REGION_INFO[site.id].regionName}</small>
            </span>
          </li>
        ))}
      </ul>
      <TravelControls />
    </aside>
  )
}
