import { useEffect, useRef, useState } from 'react'
import { findMission } from '../data/missions'
import { lensMatchesComponent } from '../data/scannerLenses'
import { SPIRIT_SITE } from '../data/spiritSite'
import { emitAudio } from '../game/audio/audioEvents'
import { playerPosition } from '../game/playerPosition'
import { SCANNER } from '../game/worldConfig'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import {
  getArchiveCtaLabel,
  getMissionStage,
  scannedComponentCount,
} from './missionStage'
import { PipAvatar } from './PipSpeech'
import { ScannerLensPicker } from './ScannerLensPicker'

function SpiritSchematic() {
  return (
    <svg
      viewBox="0 0 320 200"
      className="scanner-schematic"
      role="presentation"
      focusable="false"
    >
      <rect
        x="74"
        y="112"
        width="172"
        height="36"
        rx="10"
        className="scanner-schematic__body"
      />
      <rect
        x="94"
        y="105"
        width="132"
        height="6"
        rx="3"
        className="scanner-schematic__deck"
      />
      {[92, 160, 228].map((x) => (
        <circle
          key={x}
          cx={x}
          cy="154"
          r="13"
          className="scanner-schematic__wheel"
        />
      ))}
      <line
        x1="202"
        y1="112"
        x2="202"
        y2="66"
        className="scanner-schematic__mast"
      />
      <rect
        x="184"
        y="54"
        width="36"
        height="14"
        rx="4"
        className="scanner-schematic__camera"
      />
      <rect
        x="226"
        y="82"
        width="22"
        height="18"
        rx="3"
        className="scanner-schematic__instrument"
      />
      <line
        x1="118"
        y1="142"
        x2="92"
        y2="174"
        className="scanner-schematic__arm"
      />
      <circle
        cx="88"
        cy="178"
        r="9"
        className="scanner-schematic__tool"
      />
    </svg>
  )
}

function GenericSchematic() {
  return (
    <svg
      viewBox="0 0 320 200"
      className="scanner-schematic"
      role="presentation"
      focusable="false"
    >
      <rect
        x="94"
        y="64"
        width="132"
        height="72"
        rx="18"
        className="scanner-schematic__body"
      />
      <circle cx="160" cy="100" r="22" className="scanner-schematic__instrument" />
      <line x1="160" y1="24" x2="160" y2="176" className="scanner-schematic__mast" />
      <line x1="84" y1="100" x2="236" y2="100" className="scanner-schematic__mast" />
    </svg>
  )
}

export function CosmicScanner() {
  const open = useGameStore((state) => state.scannerOpen)
  const missionId = useGameStore((state) => state.scannerMissionId)
  const selectedId = useGameStore((state) => state.scannerSelectedComponentId)
  const selectComponent = useGameStore((state) => state.selectScannerComponent)
  const closeScanner = useGameStore((state) => state.closeScanner)
  const openArchive = useGameStore((state) => state.openArchive)

  const save = useJourneyStore((state) => state.save)
  const loadStatus = useJourneyStore((state) => state.loadStatus)
  const scan = useJourneyStore((state) => state.scan)
  const startJourney = useJourneyStore((state) => state.startJourney)
  const setDestination = useJourneyStore((state) => state.setDestination)

  const [status, setStatus] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const firstHotspotRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)

  const mission = missionId ? findMission(missionId) : null
  const progress = mission && save ? save.missions[mission.id] : null
  const scanned = progress?.scannedComponentIds ?? []
  const scannedCount = scannedComponentCount(progress)
  const stage = getMissionStage(progress)
  const archiveCta = getArchiveCtaLabel(stage)
  const discovered = Boolean(progress?.discovered)
  const signalLabel = mission
    ? discovered
      ? mission.machineName
      : 'Unidentified signal'
    : 'Signal'
  const selected =
    mission?.components.find((component) => component.id === selectedId) ?? null

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    previousFocus.current = document.activeElement
    if (!dialog.open) dialog.showModal()
    const frame = window.requestAnimationFrame(() =>
      firstHotspotRef.current?.focus(),
    )
    return () => {
      window.cancelAnimationFrame(frame)
      if (dialog.open) dialog.close()
      const previous = previousFocus.current
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus()
      }
    }
  }, [open])

  const close = () => {
    setStatus(null)
    closeScanner()
  }

  const handleSelect = (componentId: string) => {
    if (!mission) return
    if (!discovered) {
      setStatus(
        'Identify the signal in the world first by walking to it. Assist mode cannot skip discovery.',
      )
      return
    }
    const distanceToExplorer = Math.hypot(
      playerPosition.x - SPIRIT_SITE.position.x,
      playerPosition.z - SPIRIT_SITE.position.z,
    )
    if (distanceToExplorer > SCANNER.range) {
      setStatus(
        'Move closer to the explorer before using assisted review. The physical scanner remains the primary tool.',
      )
      return
    }
    const alreadyRecorded = Boolean(
      useJourneyStore.getState().save?.missions[mission.id]?.scannedComponentIds.includes(componentId),
    )
    const component = mission.components.find((c) => c.id === componentId)
    const lens = useGameStore.getState().scannerLens
    if (
      !alreadyRecorded &&
      component &&
      !lensMatchesComponent(component, lens)
    ) {
      // Assisted review still teaches: the right lens is part of recognizing.
      selectComponent(componentId)
      setStatus(
        'This lens finds nothing on that part. Think about what the instrument does, pick another lens above and try again.',
      )
      return
    }
    selectComponent(componentId)
    if (!save) {
      setStatus('Start the journey to record this scan.')
      return
    }
    const result = scan(mission.id, componentId)
    if (!result) return
    if (result.status === 'scanned') {
      setStatus(`Recorded ${result.scannedCount} of 3 fragments.`)
    } else if (result.status === 'duplicate') {
      emitAudio('scanAlreadyRegistered')
      setStatus('This fragment is already recorded. No duplicate was added.')
    } else if (result.status === 'invalid-component') {
      emitAudio('uiError')
      setStatus('That component does not belong to this mission.')
    } else if (result.status === 'mission-transmitted') {
      emitAudio('scanAlreadyRegistered')
      setStatus('This history is already restored in the Archive.')
    } else if (result.status === 'unknown-mission') {
      emitAudio('uiError')
      setStatus('Unknown mission.')
    }
  }

  const startPilot = () => {
    if (!mission || loadStatus === 'corrupt') return
    if (!startJourney('Pilot')) {
      setStatus('Could not create the pilot save.')
      return
    }
    setDestination(mission.destination)
    setStatus('Pilot save created. Select a component to record it.')
  }

  if (!open || !mission) return null

  return (
    <dialog
      ref={dialogRef}
      className="cosmic-scanner"
      aria-labelledby="scanner-title"
      aria-describedby="scanner-description"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="cosmic-scanner__body">
        <header className="cosmic-scanner__header">
          <div>
            <p className="settings-eyebrow">
              Accessibility · assisted component review
            </p>
            <h2 id="scanner-title">{signalLabel}</h2>
            <p id="scanner-description" className="cosmic-scanner__intro">
              {discovered
                ? mission.pipBriefing
                : 'A signal is waiting near the red rocks. Find it in the world, then use the scanner to identify its parts.'}
            </p>
            <p className="scanner-status">
              {discovered
                ? 'Assist mode: choose a recognized component directly. The physical scanner remains the full aiming experience.'
                : 'Assist mode cannot identify the machine for you. Find the signal in the world first.'}
            </p>
          </div>
          <button
            type="button"
            className="settings-close"
            aria-label="Close assisted component review"
            onClick={close}
          >
            ×
          </button>
        </header>

        <div
          className="cosmic-scanner__progress"
          aria-label={`${scannedCount} of 3 components recorded`}
        >
          {mission.components.map((component) => (
            <span
              key={component.id}
              className={`cosmic-scanner__pip${
                scanned.includes(component.id) ? ' is-filled' : ''
              }`}
            />
          ))}
          <span className="cosmic-scanner__count">{scannedCount}/3</span>
        </div>

        {discovered && <ScannerLensPicker />}

        <div className="scanner-stage">
          <div className="scanner-stage__scanline" aria-hidden="true" />
          <div className="scanner-stage__target" aria-hidden="true">
            {discovered && mission.id === 'spirit' ? (
              <SpiritSchematic />
            ) : (
              <GenericSchematic />
            )}
          </div>
          {mission.components.map((component, index) => {
            const isSelected = selectedId === component.id
            const isScanned = scanned.includes(component.id)
            const hotspot = component.hotspot ?? {
              x: 24 + index * 26,
              y: 50,
            }
            return (
              <button
                key={component.id}
                ref={index === 0 ? firstHotspotRef : undefined}
                type="button"
                className={`scanner-hotspot${
                  isSelected ? ' is-selected' : ''
                }${isScanned ? ' is-scanned' : ''}`}
                style={{
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                }}
                aria-pressed={isSelected}
                disabled={!discovered}
                onClick={() => handleSelect(component.id)}
              >
                <span className="scanner-hotspot__dot" aria-hidden="true">
                  {isScanned ? '✓' : index + 1}
                </span>
                <span className="scanner-hotspot__name">
                  {discovered
                    ? component.shortName
                    : `Unidentified fragment ${String.fromCharCode(65 + index)}`}
                </span>
              </button>
            )
          })}
        </div>
        <p className="scanner-stage__hint">
          Select a glowing hotspot. The matching part lights up on the 3D
          model.
        </p>

        {status && (
          <p className="scanner-status" role="status" aria-live="polite">
            {status}
          </p>
        )}

        {import.meta.env.DEV && !save && loadStatus !== 'corrupt' && (
          <div className="scanner-dev">
            <p>
              No educational save is active. Development only: create a
              throwaway JourneySave to test this panel.
            </p>
            <button
              type="button"
              className="settings-resume"
              onClick={startPilot}
            >
              Start {mission.machineName} pilot · dev save
            </button>
          </div>
        )}
        {!save && loadStatus === 'corrupt' && (
          <p className="scanner-status" role="status">
            JourneySave could not be read. It was left untouched; clear it
            manually before starting a new pilot.
          </p>
        )}

        <section className="scanner-card" aria-live="polite">
          {selected ? (
            <>
              <p className="settings-eyebrow">
                {selected.validation === 'source-checked'
                  ? 'NASA source checked'
                  : 'Pending review'}
              </p>
              <h3>{selected.name}</h3>
              <p className="scanner-card__fact">
                {selected.historicalRecord}
              </p>
              <div className="scanner-pip">
                <PipAvatar />
                <div>
                  <p className="pip-name">PIP</p>
                  <p className="scanner-pip__line">{selected.pipLine}</p>
                </div>
              </div>
              <p className="scanner-card__hint">
                Scan hint: {selected.scanHint}
              </p>
              <nav className="site-sources" aria-label="NASA mission sources">
                {selected.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.label} ↗
                  </a>
                ))}
              </nav>
            </>
          ) : (
            <p className="scanner-card__empty">
              Choose one of the three components to reveal its story.
            </p>
          )}
        </section>

        {archiveCta && (
          <div className="scanner-archive-ready">
            <p role="status">
              {stage === 'transmitted'
                ? 'This history is restored in the Earth Cosmic Archive.'
                : stage === 'smart_letter_ready'
                  ? 'The smart letter is ready.'
                  : stage === 'memory_recovered'
                    ? 'Memory recovered. A smart letter can be prepared.'
                    : 'All 3 fragments recognized. The full recognition scan is ready.'}
            </p>
            <button
              type="button"
              className="settings-resume scanner-archive-cta"
              onClick={() =>
                openArchive(
                  stage === 'ready_for_full_scan'
                    ? 'full-scan'
                    : 'smart-letter',
                  mission.id,
                )
              }
            >
              {archiveCta}
            </button>
          </div>
        )}

        {import.meta.env.DEV &&
          discovered &&
          mission.id === SPIRIT_SITE.missionId && (
            <p className="scanner-placeholder-note">
              {SPIRIT_SITE.placeholderNote}
            </p>
          )}

        <button
          type="button"
          className="settings-resume"
          onClick={close}
        >
          Back to 3D scanner
        </button>
      </div>
    </dialog>
  )
}
