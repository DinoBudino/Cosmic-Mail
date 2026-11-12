import { inspectSpirit } from '../game/missionNarrative'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { SPIRIT_SITE } from '../data/spiritSite'

/**
 * Explicit discovery interaction. Walking close to the rover and pressing E
 * is the valid identification event; proximity alone never reveals Spirit.
 */
export function SpiritInteraction() {
  const nearbySpirit = useGameStore((state) => state.nearbySpirit)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const archiveView = useGameStore((state) => state.archiveView)
  const activeSiteId = useGameStore((state) => state.activeSiteId)
  const cinematicFocus = useGameStore((state) => state.cinematicFocus)
  const progress = useJourneyStore(
    (state) => state.save?.missions[SPIRIT_SITE.missionId] ?? null,
  )

  if (
    !nearbySpirit ||
    progress?.discovered ||
    scannerEquipped ||
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
      <p className="spirit-interaction__label">Unidentified explorer</p>
      <button
        type="button"
        className="spirit-interaction__action"
        onClick={() => inspectSpirit()}
      >
        <span className="desktop-interact">E — Inspect</span>
        <span className="touch-interact">Tap to inspect</span>
      </button>
      <p className="spirit-interaction__hint">
        Take a close look before using the scanner.
      </p>
    </div>
  )
}
