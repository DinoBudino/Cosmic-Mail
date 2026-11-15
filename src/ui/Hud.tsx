import { useGameStore } from '../store/gameStore'
import { isStepAtLeast } from '../data/arrivalProtocol'
import { useProtocol } from './useProtocol'

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.7-1.3-1.8-3.1-2 .8a7.5 7.5 0 0 0-2.6-1.5L14.4 3h-3.6l-.3 2.4a7.5 7.5 0 0 0-2.6 1.5l-2-.8-1.8 3.1 1.7 1.3a7.6 7.6 0 0 0 0 3l-1.7 1.3 1.8 3.1 2-.8a7.5 7.5 0 0 0 2.6 1.5l.3 2.4h3.6l.3-2.4a7.5 7.5 0 0 0 2.6-1.5l2 .8 1.8-3.1-1.7-1.3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AlbumIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="7" y="6" width="10" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 16.5h8M10.5 19h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function Hud() {
  const openSettings = useGameStore((state) => state.openSettings)
  const openAlbum = useGameStore((state) => state.openAlbum)
  const quality = useGameStore((state) => state.quality)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const cinematicFocus = useGameStore((state) => state.cinematicFocus)
  const { step } = useProtocol()
  // Show only the keys the current step needs: movement first, then the
  // scanner, then inspect.
  const showScanner = isStepAtLeast(step, 'M2')
  const showInspect = isStepAtLeast(step, 'M3')

  return (
    <>
      {!scannerEquipped && cinematicFocus === null && (
        <details className="hud-controls" open={step === 'M0' || undefined}>
          <summary>Controls</summary>
          <div className="hud-controls__row">
            <span className="hud-control">
              <span className="hud-key">WASD</span>
              <span className="hud-label">move</span>
            </span>
            <span className="hud-control">
              <span className="hud-key">Drag</span>
              <span className="hud-label">look</span>
            </span>
            <span className="hud-control">
              <span className="hud-key">Shift</span>
              <span className="hud-label">run</span>
            </span>
            {showScanner && (
              <span className="hud-control">
                <span className="hud-key">Q</span>
                <span className="hud-label">scanner</span>
              </span>
            )}
            {showInspect && (
              <span className="hud-control">
                <span className="hud-key">E</span>
                <span className="hud-label">interact</span>
              </span>
            )}
          </div>
        </details>
      )}

      <button
        type="button"
        className="hud-album"
        onClick={openAlbum}
        aria-label="Open the Cosmic Album"
        aria-haspopup="dialog"
      >
        <AlbumIcon />
        <span>Album</span>
      </button>

      <button
        type="button"
        className="hud-settings"
        onClick={openSettings}
        aria-label="Open settings"
        aria-haspopup="dialog"
      >
        <GearIcon />
        <span className="hud-quality">
          {quality === 'high' ? 'High' : 'Low'}
        </span>
      </button>
    </>
  )
}
