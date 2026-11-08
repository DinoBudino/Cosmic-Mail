import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

export function SettingsMenu() {
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const closeSettings = useGameStore((state) => state.closeSettings)
  const quality = useGameStore((state) => state.quality)
  const setQuality = useGameStore((state) => state.setQuality)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const setReducedMotion = useGameStore(
    (state) => state.setReducedMotion,
  )

  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!settingsOpen) return

    previousFocus.current = document.activeElement
    const panel = panelRef.current
    panel?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSettings()
        return
      }

      if (event.key !== 'Tab' || !panel) return

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus()
      }
    }
  }, [settingsOpen, closeSettings])

  if (!settingsOpen) return null

  return (
    <div
      className="settings-scrim"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeSettings()
      }}
    >
      <div
        ref={panelRef}
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby="settings-description"
        tabIndex={-1}
      >
        <div className="settings-header">
          <div>
            <p className="settings-eyebrow">Cosmic Mail</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button
            type="button"
            className="settings-close"
            onClick={closeSettings}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <p id="settings-description" className="settings-description">
          The simulation is paused while this menu is open.
        </p>

        <fieldset className="settings-group">
          <legend>Graphics quality</legend>
          <div className="segmented">
            <button
              type="button"
              className={quality === 'high' ? 'is-active' : ''}
              aria-pressed={quality === 'high'}
              onClick={() => setQuality('high')}
            >
              High
            </button>
            <button
              type="button"
              className={quality === 'low' ? 'is-active' : ''}
              aria-pressed={quality === 'low'}
              onClick={() => setQuality('low')}
            >
              Low
            </button>
          </div>
          <p className="settings-hint">
            Low disables shadows and post-processing and reduces detail for
            slower devices.
          </p>
        </fieldset>

        <fieldset className="settings-group">
          <legend>Accessibility</legend>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) =>
                setReducedMotion(event.target.checked)
              }
            />
            <span>
              <strong>Reduced motion</strong>
              <small>
                Disables walking bob, guide pulses and floating dust.
              </small>
            </span>
          </label>
        </fieldset>

        <button
          type="button"
          className="settings-resume"
          onClick={closeSettings}
        >
          Resume exploring
        </button>
      </div>
    </div>
  )
}
