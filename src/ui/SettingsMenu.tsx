import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AUDIO_ASSETS } from '../game/audio/audioManifest'
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

  const [activeTab, setActiveTab] = useState<SettingsTab>('game')

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

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'game', label: 'Game' },
    { id: 'sound', label: 'Sound' },
    { id: 'pip', label: 'PIP' },
    { id: 'credits', label: 'Credits' },
  ]

  return (
    <div
      className="settings-scrim"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeSettings()
      }}
    >
      <div
        ref={panelRef}
        className="settings-panel settings-panel--tabs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
      >
        <div className="settings-header">
          <div>
            <p className="settings-eyebrow">Cosmic Mail · game paused</p>
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

        <div className="set-body">
          <div className="set-tabs" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                className={activeTab === tab.id ? 'is-active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="set-pages">
            {activeTab === 'game' && (
              <div role="tabpanel" id="panel-game" aria-labelledby="tab-game" className="set-page">
                <SettingRow label="Graphics" hint="Low runs better on slower computers.">
                  <Segmented
                    value={quality}
                    options={[
                      { value: 'high', label: 'High' },
                      { value: 'low', label: 'Low' },
                    ]}
                    onChange={setQuality}
                  />
                </SettingRow>
                <SettingRow label="Scanner view" hint="How you see while holding the scanner.">
                  <Segmented
                    value={scannerCamera}
                    options={[
                      { value: 'first-person', label: 'My eyes' },
                      { value: 'third-person', label: 'Behind me' },
                    ]}
                    onChange={setScannerCamera}
                  />
                </SettingRow>
                <SettingRow label="Less motion" hint="Calmer camera, fewer pulses and dust.">
                  <Switch
                    checked={reducedMotion}
                    onChange={setReducedMotion}
                    label="Less motion"
                  />
                </SettingRow>
                <SettingRow label="Scan from a list" hint="Accessibility: review found parts without aiming.">
                  <Switch
                    checked={assistedScanEnabled}
                    onChange={setAssistedScanEnabled}
                    label="Scan from a list"
                  />
                </SettingRow>
              </div>
            )}

            {activeTab === 'sound' && (
              <div role="tabpanel" id="panel-sound" aria-labelledby="tab-sound" className="set-page">
                <SettingRow label="Sound on" hint="Subtitles always stay on.">
                  <Switch checked={!muted} onChange={(on) => setMuted(!on)} label="Sound on" />
                </SettingRow>
                <div className="set-sliders" data-muted={muted}>
                  <VolumeControl id="master-volume" label="Master" value={masterVolume} onChange={setMasterVolume} />
                  <VolumeControl id="music-volume" label="Music" value={musicVolume} onChange={setMusicVolume} />
                  <VolumeControl id="ambience-volume" label="Ambience" value={ambienceVolume} onChange={setAmbienceVolume} />
                  <VolumeControl id="sfx-volume" label="Effects" value={sfxVolume} onChange={setSfxVolume} />
                  <VolumeControl id="voice-volume" label="PIP voice" value={voiceVolume} onChange={setVoiceVolume} />
                </div>
              </div>
            )}

            {activeTab === 'pip' && (
              <div role="tabpanel" id="panel-pip" aria-labelledby="tab-pip" className="set-page">
                <SettingRow label="PIP talks" hint="PIP reads its lines out loud.">
                  <Switch checked={voiceEnabled} onChange={setVoiceEnabled} label="PIP talks" />
                </SettingRow>
              </div>
            )}

            {activeTab === 'credits' && (
              <div role="tabpanel" id="panel-credits" aria-labelledby="tab-credits" className="set-page set-credits">
                <p>
                  Music by Pixabay creators (
                  <a href="https://pixabay.com/service/license-summary/" target="_blank" rel="noopener noreferrer">
                    Pixabay Content License
                  </a>
                  ). Sound effects from{' '}
                  <a href="https://kenney.nl/assets" target="_blank" rel="noopener noreferrer">
                    Kenney
                  </a>{' '}
                  (CC0). PIP chirps and ambience beds are original project audio.
                </p>
                <ul>
                  {MUSIC_CREDITS.map((asset) => (
                    <li key={asset.id}>
                      <strong>{asset.source.title}</strong> · {asset.source.author}
                      {asset.source.contentIdRisk === 'registered' && (
                        <span className="settings-credits__warning">
                          {' '}· Content ID registered on Pixabay; verify before publishing video.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p>
                  <a href="audio/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer">
                    Full attribution file
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>

        <button type="button" className="settings-resume" onClick={closeSettings}>
          Done
        </button>
      </div>
    </div>
  )
}

type SettingsTab = 'game' | 'sound' | 'pip' | 'credits'

/** One compact line: what it is (and a short hint) on the left, control on the right. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="set-row">
      <div className="set-row__text">
        <span className="set-row__label">{label}</span>
        {hint && <span className="set-row__hint">{hint}</span>}
      </div>
      <div className="set-row__control">{children}</div>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented set-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : ''}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="set-switch"
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden="true" />
    </button>
  )
}
