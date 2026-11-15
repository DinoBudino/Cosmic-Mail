import { useEffect } from 'react'
import { pipLine } from '../data/pipVoiceCatalog'
import { SPIRIT_SITE } from '../data/spiritSite'
import { boardShip, canBoardShip } from '../game/landedShip'
import { isCoarsePointer, requestProtocolLine } from '../game/missionNarrative'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'

/**
 * Next to Mailwing with the sealed letter: one button to climb aboard and
 * go back to Mars orbit. PIP says it once.
 */
export function ShipInteraction() {
  const nearbyShip = useGameStore((state) => state.nearbyShip)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const archiveView = useGameStore((state) => state.archiveView)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const save = useJourneyStore((state) => state.save)
  const ready = nearbyShip && canBoardShip(save, SPIRIT_SITE.missionId)

  useEffect(() => {
    if (!ready) return
    const touch = isCoarsePointer()
    requestProtocolLine(
      {
        id: 'protocol:ship-board',
        text: pipLine(touch ? 'mars-ship-board-touch' : 'mars-ship-board-desktop'),
      },
      60_000,
    )
  }, [ready])

  if (!ready || settingsOpen || scannerOpen || archiveView !== 'none') return null

  return (
    <div className="spirit-interaction" role="status">
      <p className="spirit-interaction__label">Mailwing</p>
      <button
        type="button"
        className="spirit-interaction__action"
        onClick={() => boardShip()}
      >
        <span className="desktop-interact">E · Board the ship</span>
        <span className="touch-interact">Board</span>
      </button>
    </div>
  )
}
