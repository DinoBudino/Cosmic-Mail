import { isStepAtLeast } from '../data/arrivalProtocol'
import { getMission } from '../data/missions'
import { HuntTracker } from './HuntTracker'
import { SPIRIT_SITE } from '../data/spiritSite'
import { requestMissionHint } from '../game/missionNarrative'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useProtocol } from './useProtocol'

/**
 * The single place that says what to do now. It is derived from journey
 * progress (via useProtocol) and shows one line. "Ask PIP" is offered
 * while the player is still learning (M0–M4). The album has a single
 * button, the HUD tablet, which glows when the explorer's letter waits.
 */
export function ObjectiveBar() {
  const { step, objective, hasSave } = useProtocol()
  const progress = useJourneyStore(
    (state) => state.save?.missions[SPIRIT_SITE.missionId] ?? null,
  )
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const activeSiteId = useGameStore((state) => state.activeSiteId)
  const cinematicFocus = useGameStore((state) => state.cinematicFocus)

  if (
    !hasSave ||
    settingsOpen ||
    scannerOpen ||
    scannerRecordsOpen ||
    archiveOpen ||
    activeSiteId ||
    cinematicFocus !== null
  ) {
    return null
  }

  const learning = !isStepAtLeast(step, 'M6')

  return (
    <aside
      className="objective-bar"
      data-step={step}
      data-highlight={objective.highlight ?? undefined}
      aria-label="Current objective"
    >
      {step === 'M4' && progress?.discovered && (
        <HuntTracker
          mission={getMission(SPIRIT_SITE.missionId)}
          scannedIds={progress.scannedComponentIds}
        />
      )}
      <p className="objective-bar__text" role="status" aria-live="polite">
        {objective.text}
      </p>
      {learning && (
        <button
          type="button"
          className="objective-bar__ask"
          onClick={() => requestMissionHint()}
        >
          Ask PIP
        </button>
      )}
    </aside>
  )
}
