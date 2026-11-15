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

/**
 * A small Cosmic Album tablet (same look as the album: navy bezel,
 * orange corner bumpers, cream screen) with a ringed planet photo on it.
 */
function AlbumTablet() {
  return (
    <svg className="hud-album__tablet" viewBox="0 0 88 64" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="82" height="58" rx="11" fill="#2b2063" stroke="#1a1340" strokeWidth="2" />
      {/* Orange corner bumpers */}
      <path d="M3 17V14A11 11 0 0 1 14 3h4M70 3h4a11 11 0 0 1 11 11v3M85 47v3a11 11 0 0 1-11 11h-4M18 61h-4A11 11 0 0 1 3 50v-3" fill="none" stroke="#ff8a3d" strokeWidth="5" strokeLinecap="round" />
      <circle cx="44" cy="8" r="1.8" fill="#8f86c9" />
      <rect x="11" y="12" width="66" height="42" rx="6" fill="#fff1e2" />
      {/* The photo on screen: a ringed planet and two sparkles */}
      <circle cx="40" cy="33" r="10" fill="#ff9a52" />
      <path d="M33 37c4-1 11-4 15-8" stroke="#e2622b" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="40" cy="33" rx="17" ry="5" fill="none" stroke="#2b2063" strokeWidth="2.2" transform="rotate(-18 40 33)" />
      <path d="M61 19l1.4 3 3 1.4-3 1.4L61 28l-1.4-3-3-1.4 3-1.4z" fill="#ff8a3d" />
      <circle cx="64" cy="43" r="1.6" fill="#8f86c9" />
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
        onClick={() => openAlbum()}
        aria-label="Open the Cosmic Album"
        aria-haspopup="dialog"
      >
        <AlbumTablet />
        <span className="hud-album__label">Album</span>
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
