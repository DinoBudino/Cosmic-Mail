import { useState } from 'react'
import { getMission } from '../data/missions'
import { MARS_OBJECTS, REGION_INFO, type MarsObjectId } from '../data/marsObjects'
import { SPIRIT_SITE } from '../data/spiritSite'
import { requestMissionHint } from '../game/missionNarrative'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import {
  getArchiveCtaLabel,
  getMissionStage,
  scannedComponentCount,
} from './missionStage'

const STATE_DOT_CLASS: Record<string, string> = {
  landmark: 'mission-dot--available',
  'coming-soon': 'mission-dot--soon',
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

/** Mission briefing (top-right): objective + mission list, separate from PIP. */
export function MissionPanel() {
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const activeId = useGameStore((state) => state.activeSiteId)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const archiveView = useGameStore((state) => state.archiveView)
  const radarUnlocked = useGameStore((state) => state.radarUnlocked)
  const cinematicFocus = useGameStore((state) => state.cinematicFocus)
  const save = useJourneyStore((state) => state.save)
  if (
    !radarUnlocked ||
    cinematicFocus !== null ||
    settingsOpen ||
    activeId ||
    scannerOpen ||
    scannerEquipped ||
    scannerRecordsOpen ||
    archiveView !== 'none'
  ) {
    return null
  }

  const spiritMission = getMission(SPIRIT_SITE.missionId)
  const spiritProgress = save?.missions[SPIRIT_SITE.missionId] ?? null
  const stage = getMissionStage(spiritProgress)
  const spiritScanned = scannedComponentCount(spiritProgress)
  const discovered = Boolean(spiritProgress?.discovered)
  const signalLabel = discovered
    ? spiritMission.machineName
    : 'the silent signal'
  const archiveCta = getArchiveCtaLabel(stage)
  const spiritStatus =
    stage === 'transmitted'
      ? 'History restored'
      : stage === 'smart_letter_ready'
        ? 'Smart letter ready'
        : stage === 'memory_recovered'
          ? 'Memory recovered'
          : stage === 'ready_for_full_scan'
            ? 'Full recognition scan ready'
            : spiritScanned === 0
              ? discovered
                ? 'Explorer identified'
                : 'Follow the signal to begin'
              : 'Recognition in progress'

  return (
    <aside className="mission-panel" aria-label="Mission briefing">
      <p className="settings-eyebrow">Mission 01 · Mars</p>
      <h2 className="mission-objective">
        {stage === 'transmitted'
          ? 'History restored'
          : discovered
            ? `Recognize ${signalLabel}`
            : 'Follow the silent signal'}
      </h2>

      <div
        className={`mission-pilot${
          stage === 'transmitted' ? ' is-sealed' : ''
        }`}
        aria-label={`${signalLabel} pilot mission`}
      >
        <span
          className={`mission-dot ${
            stage === 'transmitted'
              ? 'mission-dot--restored'
              : 'mission-dot--progress'
          }`}
          aria-hidden="true"
        />
        <span className="mission-site">
          <strong>
            {discovered ? `${spiritMission.machineName} · pilot` : 'Unknown signal · pilot'}
          </strong>
          <small>{spiritStatus}</small>
        </span>
        {stage === 'transmitted' && (
          <span
            className="mission-stamp"
            title={spiritMission.stampLabel}
            aria-label={`Stamp obtained: ${spiritMission.stampLabel}`}
          >
            ✦
          </span>
        )}
      </div>
      {save && stage !== 'transmitted' && (
        <button
          type="button"
          className="site-action mission-pilot__ask"
          onClick={() => requestMissionHint(SPIRIT_SITE.missionId)}
        >
          Ask PIP for a hint
        </button>
      )}
      {archiveCta && (
        <button
          type="button"
          className="site-action mission-pilot__archive"
          onClick={() =>
            useGameStore
              .getState()
              .openArchive(
                stage === 'ready_for_full_scan' ? 'full-scan' : 'smart-letter',
                SPIRIT_SITE.missionId,
              )
          }
        >
          {archiveCta}
        </button>
      )}

      <details className="mission-other">
        <summary className="settings-eyebrow mission-subhead">
          Other Mars sites
        </summary>
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
      </details>
    </aside>
  )
}
