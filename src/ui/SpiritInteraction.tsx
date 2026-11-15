import { inspectSpirit } from '../game/missionNarrative'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { canInspectSignal } from '../data/arrivalProtocol'
import { useProtocol } from './useProtocol'
import { SPIRIT_SITE } from '../data/spiritSite'

/**
 * Explicit discovery interaction. Walking close to the rover and pressing E
 * is the valid identification event; proximity alone never reveals Spirit.
 */
export function SpiritInteraction() {
  const nearbySpirit = useGameStore((state) => state.nearbySpirit)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const archiveView = useGameStore((state) => state.archiveView)
  const activeSiteId = useGameStore((state) => state.activeSiteId)
  const cinematicFocus = useGameStore((state) => state.cinematicFocus)
  const { step } = useProtocol()
  const progress = useJourneyStore(
    (state) => state.save?.missions[SPIRIT_SITE.missionId] ?? null,
  )

  if (
    !nearbySpirit ||
    !canInspectSignal(step) ||
    progress?.discovered ||
    scannerOpen ||
    settingsOpen ||
    activeSiteId ||
    cinematicFocus !== null ||
    archiveView !== 'none'
  ) {
    return null
  }

  return (
    <div className="spirit-interaction" role="status">
      <p className="spirit-interaction__label">Something is here!</p>
      <button
        type="button"
        className="spirit-interaction__action"
        onClick={() => inspectSpirit()}
      >
        <span className="desktop-interact">E · Take a closer look</span>
        <span className="touch-interact">Inspect</span>
      </button>
    </div>
  )
}
