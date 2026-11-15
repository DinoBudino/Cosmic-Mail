import { getActiveWorld } from '../data/spiritSite'
import { getMission } from '../data/missions'
import { isStepAtLeast } from '../data/arrivalProtocol'
import { SPIRIT_SITE } from '../data/spiritSite'
import { useProtocol } from './useProtocol'
import { requestMissionHint } from '../game/missionNarrative'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import {
  getArchiveCtaLabel,
  getMissionStage,
  scannedComponentCount,
} from './missionStage'

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
  const { step } = useProtocol()
  // The objective bar carries the objective; this is optional detail that
  // joins once the explorer is identified.
  if (
    !isStepAtLeast(step, 'M4') ||
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
     <details className="mission-panel__details">
      <summary className="mission-panel__summary">
        <span className="settings-eyebrow">{getActiveWorld() === 'moon' ? 'Mission · Moon' : 'Mission · Mars'}</span>
        <span className="mission-panel__state">{spiritStatus}</span>
      </summary>

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
              .openArchive('smart-letter', SPIRIT_SITE.missionId)
          }
        >
          {archiveCta}
        </button>
      )}

     </details>
    </aside>
  )
}
