import { useEffect, useRef, useState } from 'react'
import { AUDIO_ASSETS } from '../game/audio/audioManifest'
import { PIP_VOICES, resolveVoiceId, speakPip } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'

const MUSIC_CREDITS = Object.values(AUDIO_ASSETS).filter(
  (asset) => asset.category === 'music',
)

function VolumeControl({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="volume-row">
      <label htmlFor={id} className="voice-label">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="music-volume volume-slider"
      />
      <span className="volume-value" aria-hidden="true">
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

export function SettingsMenu() {
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const closeSettings = useGameStore((state) => state.closeSettings)
  const quality = useGameStore((state) => state.quality)
  const setQuality = useGameStore((state) => state.setQuality)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const setReducedMotion = useGameStore(
    (state) => state.setReducedMotion,
  )
  const scannerCamera = useGameStore((state) => state.scannerCamera)
  const setScannerCamera = useGameStore((state) => state.setScannerCamera)
  const assistedScanEnabled = useGameStore(
    (state) => state.assistedScanEnabled,
  )
  const setAssistedScanEnabled = useGameStore(
    (state) => state.setAssistedScanEnabled,
  )
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const setVoiceEnabled = useGameStore((state) => state.setVoiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const setVoiceName = useGameStore((state) => state.setVoiceName)
  const masterVolume = useGameStore((state) => state.masterVolume)
  const setMasterVolume = useGameStore((state) => state.setMasterVolume)
  const musicVolume = useGameStore((state) => state.musicVolume)
  const setMusicVolume = useGameStore((state) => state.setMusicVolume)
  const ambienceVolume = useGameStore((state) => state.ambienceVolume)
  const setAmbienceVolume = useGameStore((state) => state.setAmbienceVolume)
  const sfxVolume = useGameStore((state) => state.sfxVolume)
  const setSfxVolume = useGameStore((state) => state.setSfxVolume)
  const voiceVolume = useGameStore((state) => state.voiceVolume)
  const setVoiceVolume = useGameStore((state) => state.setVoiceVolume)
  const muted = useGameStore((state) => state.muted)
  const setMuted = useGameStore((state) => state.setMuted)

  const effectiveVoice = resolveVoiceId(voiceName)
  const [activeTab, setActiveTab] = useState<'graphics' | 'sounds'>('graphics')

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

        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            role="tab"
            id="tab-graphics"
            aria-selected={activeTab === 'graphics'}
            aria-controls="panel-graphics"
            className={activeTab === 'graphics' ? 'is-active' : ''}
            onClick={() => setActiveTab('graphics')}
          >
            Graphics
          </button>
          <button
            type="button"
            role="tab"
            id="tab-sounds"
            aria-selected={activeTab === 'sounds'}
            aria-controls="panel-sounds"
            className={activeTab === 'sounds' ? 'is-active' : ''}
            onClick={() => setActiveTab('sounds')}
          >
            Sounds
          </button>
        </div>

        <div
          role="tabpanel"
          id="panel-graphics"
          aria-labelledby="tab-graphics"
          hidden={activeTab !== 'graphics'}
        >
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
          <legend>Scanner camera</legend>
          <div className="segmented">
            <button
              type="button"
              className={scannerCamera === 'first-person' ? 'is-active' : ''}
              aria-pressed={scannerCamera === 'first-person'}
              onClick={() => setScannerCamera('first-person')}
            >
              First person
            </button>
            <button
              type="button"
              className={scannerCamera === 'third-person' ? 'is-active' : ''}
              aria-pressed={scannerCamera === 'third-person'}
              onClick={() => setScannerCamera('third-person')}
            >
              Third person
            </button>
          </div>
          <p className="settings-hint">
            First person gives precise aiming. Click the world to capture the
            mouse; if capture is unavailable, right-drag to look. Third person
            keeps the astronaut visible while the scanner is held.
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
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={assistedScanEnabled}
              onChange={(event) =>
                setAssistedScanEnabled(event.target.checked)
              }
            />
            <span>
              <strong>Assisted component review</strong>
              <small>
                Accessibility option. Lets you review discovered components
                from a list instead of aiming the physical scanner. It never
                replaces the physical scan in normal play.
              </small>
            </span>
          </label>
        </fieldset>
        </div>

        <div
          role="tabpanel"
          id="panel-sounds"
          aria-labelledby="tab-sounds"
          hidden={activeTab !== 'sounds'}
        >
        <fieldset className="settings-group">
          <legend>PIP voice</legend>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(event) => setVoiceEnabled(event.target.checked)}
            />
            <span>
              <strong>PIP talks</strong>
              <small>Spoken subtitles. Subtitles always stay on.</small>
            </span>
          </label>
          <label htmlFor="voice-select" className="voice-label">PIP voice</label>
          <select
            id="voice-select"
            className="voice-select"
            value={effectiveVoice}
            disabled={!voiceEnabled}
            onChange={(event) => setVoiceName(event.target.value)}
          >
            {PIP_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="site-action"
            disabled={!voiceEnabled}
            onClick={() => speakPip('Hi! I am PIP, your mail companion.', effectiveVoice, true)}
          >
            Hear PIP
          </button>
        </fieldset>

        <fieldset className="settings-group">
          <legend>Audio mix</legend>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={muted}
              onChange={(event) => setMuted(event.target.checked)}
            />
            <span>
              <strong>Mute all audio</strong>
              <small>
                Keeps subtitles on. Your individual channel levels are
                remembered.
              </small>
            </span>
          </label>

          <div className="volume-grid">
            <VolumeControl
              id="master-volume"
              label="Master"
              value={masterVolume}
              onChange={setMasterVolume}
            />
            <VolumeControl
              id="music-volume"
              label="Music"
              value={musicVolume}
              onChange={setMusicVolume}
            />
            <VolumeControl
              id="ambience-volume"
              label="Ambience"
              value={ambienceVolume}
              onChange={setAmbienceVolume}
            />
            <VolumeControl
              id="sfx-volume"
              label="Effects"
              value={sfxVolume}
              onChange={setSfxVolume}
            />
            <VolumeControl
              id="voice-volume"
              label="PIP voice"
              value={voiceVolume}
              onChange={setVoiceVolume}
            />
          </div>
          <p className="settings-hint">
            Music and ambience duck automatically while PIP speaks. The
            scanner, footsteps and critical cues stay audible.
          </p>
        </fieldset>

        <details className="settings-credits">
          <summary>Music and sound credits</summary>
          <p>
            Music by Pixabay creators under the{' '}
            <a
              href="https://pixabay.com/service/license-summary/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Pixabay Content License
            </a>
            . Sound effects from{' '}
            <a
              href="https://kenney.nl/assets"
              target="_blank"
              rel="noopener noreferrer"
            >
              Kenney
            </a>{' '}
            (CC0). PIP chirps and ambience beds are original project audio.
          </p>
          <ul className="settings-credits__list">
            {MUSIC_CREDITS.map((asset) => (
              <li key={asset.id}>
                <strong>{asset.source.title}</strong> · {asset.source.author}
                {asset.source.contentIdRisk === 'registered' && (
                  <span className="settings-credits__warning">
                    {' '}
                    · Content ID registered on Pixabay; verify before
                    publishing video.
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="settings-hint">
            <a
              href="audio/ATTRIBUTION.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Full attribution file
            </a>{' '}
            · repository notes in AUDIO_CREDITS.md.
          </p>
        </details>
        </div>

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
