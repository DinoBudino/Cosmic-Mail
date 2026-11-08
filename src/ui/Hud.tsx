import { useGameStore } from '../store/gameStore'

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

export function Hud() {
  const openSettings = useGameStore((state) => state.openSettings)
  const quality = useGameStore((state) => state.quality)

  return (
    <>
      <header className="hud-card" aria-label="Mission status">
        <p className="hud-eyebrow">Mars Delivery Zone</p>
        <h1 className="hud-title">Letters to the Forgotten Explorers</h1>
        <p className="hud-objective">Mission 01 — Find Opportunity</p>
      </header>

      <div className="hud-legend" aria-hidden="true">
        <span className="hud-legend-item">
          <span className="hud-dot hud-dot--available" />
          Mission site
        </span>
        <span className="hud-legend-item">
          <span className="hud-dot hud-dot--soon" />
          Coming soon
        </span>
      </div>

      <div className="hud-controls">
        <span className="hud-control">
          <span className="hud-key">WASD</span>
          <span className="hud-label">move</span>
        </span>
        <span className="hud-sep" aria-hidden="true">
          ·
        </span>
        <span className="hud-control">
          <span className="hud-key">Drag</span>
          <span className="hud-label">look</span>
        </span>
        <span className="hud-sep" aria-hidden="true">
          ·
        </span>
        <span className="hud-control">
          <span className="hud-key">Scroll</span>
          <span className="hud-label">zoom</span>
        </span>
        <span className="hud-sep" aria-hidden="true">
          ·
        </span>
        <span className="hud-control">
          <span className="hud-key">C</span>
          <span className="hud-label">recenter</span>
        </span>
        <span className="hud-sep" aria-hidden="true">
          ·
        </span>
        <span className="hud-control">
          <span className="hud-key">Esc</span>
          <span className="hud-label">settings</span>
        </span>
      </div>

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
