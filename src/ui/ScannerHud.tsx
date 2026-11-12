import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { getEnvironmentalSite } from '../data/environmentalSites'
import { getMission } from '../data/missions'
import { requestMissionHint } from '../game/missionNarrative'
import { stopPipVoice } from '../game/pipVoice'
import {
  scannerPointer,
  setScannerPointer,
} from '../game/scannerPointer'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import {
  getArchiveCtaLabel,
  getMissionStage,
  scannedComponentCount,
} from './missionStage'

/**
 * Small HUD for the physical scanner. The reticle follows the real mouse
 * position and mirrors the raycast target; the panel provides accessible
 * buttons and progress without replacing the 3D interaction.
 */
export function ScannerHud() {
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const missionId = useGameStore((state) => state.scannerMissionId)
  const selectedId = useGameStore(
    (state) => state.scannerSelectedComponentId,
  )
  const environmentalId = useGameStore(
    (state) => state.scannerEnvironmentalId,
  )
  const scannerAnalysis = useGameStore((state) => state.scannerAnalysis)
  const scannerPhysicalState = useGameStore(
    (state) => state.scannerPhysicalState,
  )
  const historicalExplanationId = useGameStore(
    (state) => state.historicalExplanationId,
  )
  const scannerCamera = useGameStore((state) => state.scannerCamera)
  const assistedScanEnabled = useGameStore(
    (state) => state.assistedScanEnabled,
  )
  const scanProgress = useGameStore((state) => state.scannerScanProgress)
  const triggerHeld = useGameStore((state) => state.scannerTriggerHeld)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerCard = useGameStore(
    (state) => state.scannerCardComponentId,
  )
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const archiveView = useGameStore((state) => state.archiveView)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const activeSiteId = useGameStore((state) => state.activeSiteId)
  const unequipScanner = useGameStore((state) => state.unequipScanner)
  const setScannerTrigger = useGameStore(
    (state) => state.setScannerTrigger,
  )
  const openScanner = useGameStore((state) => state.openScanner)
  const openArchive = useGameStore((state) => state.openArchive)
  const openScannerRecords = useGameStore(
    (state) => state.openScannerRecords,
  )

  const save = useJourneyStore((state) => state.save)
  const loadStatus = useJourneyStore((state) => state.loadStatus)
  const startJourney = useJourneyStore((state) => state.startJourney)
  const setDestination = useJourneyStore((state) => state.setDestination)
  const resetMission = useJourneyStore((state) => state.resetMission)
  const cursorRef = useRef<HTMLDivElement>(null)

  // Keep the real mouse position ready even before the scanner is equipped,
  // so the reticle never starts pinned to the screen centre.
  useEffect(() => {
    const onPointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      if (!(event.target instanceof HTMLCanvasElement)) return
      const state = useGameStore.getState()
      if (
        state.scannerEquipped &&
        state.scannerCamera === 'first-person'
      ) {
        // First person uses a fixed central reticle; mouse movement is look.
        return
      }
      setScannerPointer(event.clientX, event.clientY)
    }
    window.addEventListener('pointermove', onPointerMove)
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  useEffect(() => {
    if (!scannerEquipped) return
    const setHeld = (held: boolean) =>
      useGameStore.getState().setScannerTrigger(held)
    const onPointerDown = (event: globalThis.PointerEvent) => {
      // Touch dragging aims the reticle and must never start a scan.
      if (event.pointerType !== 'mouse') return
      if (event.button !== 0) return
      if (!(event.target instanceof HTMLCanvasElement)) return
      const state = useGameStore.getState()
      if (!state.scannerEquipped || isWorldPaused()) return
      setHeld(true)
    }
    const onPointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button === 0) {
        setHeld(false)
      }
    }
    const release = () => setHeld(false)
    const onVisibility = () => {
      if (document.hidden) release()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    }
  }, [scannerEquipped])

  // The reticle is positioned imperatively: mouse movement must never
  // trigger React renders while the pointer raycast runs every frame.
  useEffect(() => {
    if (!scannerEquipped) return
    let frame = 0
    const update = () => {
      const cursor = cursorRef.current
      if (cursor) {
        if (scannerPointer.mode === 'pointer') {
          const parent = cursor.offsetParent as HTMLElement | null
          const rect = parent?.getBoundingClientRect()
          cursor.style.left = `${
            scannerPointer.clientX - (rect?.left ?? 0)
          }px`
          cursor.style.top = `${
            scannerPointer.clientY - (rect?.top ?? 0)
          }px`
        } else {
          cursor.style.left = '50%'
          cursor.style.top = '50%'
        }
      }
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [scannerEquipped])

  if (!scannerEquipped || !missionId) return null

  const mission = getMission(missionId)
  const progress = save?.missions[mission.id] ?? null
  const scannedCount = scannedComponentCount(progress)
  const discovered = Boolean(progress?.discovered)
  const signalLabel = discovered ? mission.machineName : 'Mars signal'
  const target =
    mission.components.find((component) => component.id === selectedId) ??
    null
  const environmental = environmentalId
    ? getEnvironmentalSite(environmentalId)
    : null
  const environmentalQuick = environmental
    ? (save?.environmentalDiscoveries.includes(environmental.id) ?? false)
    : false
  const environmentalDetailed = environmental
    ? (save?.environmentalDetailedDiscoveries.includes(environmental.id) ??
      false)
    : false
  const environmentalCount = save?.environmentalDiscoveries.length ?? 0
  const alreadyScanned = target
    ? (progress?.scannedComponentIds.includes(target.id) ?? false)
    : false
  const stage = getMissionStage(progress)
  const archiveCta = getArchiveCtaLabel(stage)
  const historicalLocked = Boolean(historicalExplanationId)
  const obscured = Boolean(
    scannerOpen ||
      scannerCard ||
      scannerRecordsOpen ||
      archiveView !== 'none' ||
      settingsOpen ||
      activeSiteId,
  )
  const targetStatus = !save
    ? 'Start the pilot save to record scans.'
    : environmental
      ? environmentalDetailed
        ? `${environmental.name} · detailed comparison saved`
        : scannerAnalysis === 'quick' || environmentalQuick
          ? `${environmental.name} · quick reading saved. Keep holding for a detailed comparison.`
          : triggerHeld
            ? `Scanning ${environmental.name}…`
            : `${environmental.name} · Hold to scan, keep holding for detail`
      : scannerPhysicalState === 'occluded'
        ? 'The target is blocked. Change position for a clear line of sight.'
        : scannerPhysicalState === 'out-of-range'
          ? 'Move closer to read this target.'
          : !target
            ? discovered
              ? `Aim at a ${mission.machineName} component or a landscape feature.`
              : 'Aim at a rock, soil patch or formation — or follow the signal.'
        : historicalLocked
          ? 'PIP is explaining the recovered fragment. Walk and look while listening.'
          : !discovered
            ? 'Inspect the explorer first: press E near it before recording its parts.'
            : alreadyScanned
              ? `${target.shortName} · already recorded`
              : triggerHeld
                ? `Scanning ${target.shortName}…`
                : `${target.shortName} · Hold left click to scan`
  const scanDisabled =
    !save ||
    (!target && !environmental) ||
    (Boolean(target) &&
      (!discovered || alreadyScanned || historicalLocked)) ||
    Boolean(environmental && environmentalDetailed)
  let reticleState:
    | 'idle'
    | 'valid'
    | 'out-of-range'
    | 'occluded'
    | 'scanning'
    | 'completed'
    | 'already-scanned'
    | 'narrative-locked'
    | 'inspect'
  if (scannerPhysicalState === 'out-of-range') {
    reticleState = 'out-of-range'
  } else if (scannerPhysicalState === 'occluded') {
    reticleState = 'occluded'
  } else if (environmental) {
    reticleState = environmentalDetailed
      ? 'completed'
      : triggerHeld
        ? 'scanning'
        : 'valid'
  } else if (target) {
    reticleState = historicalLocked
      ? 'narrative-locked'
      : !discovered
        ? 'inspect'
        : alreadyScanned
          ? 'already-scanned'
          : triggerHeld
            ? 'scanning'
            : 'valid'
  } else {
    reticleState = 'idle'
  }
  const progressStyle = {
    '--scan-progress': `${scanProgress}`,
  } as CSSProperties

  const startPilot = () => {
    if (loadStatus === 'corrupt') return
    if (!startJourney('Pilot')) return
    setDestination(mission.destination)
  }

  const resetSpiritPilot = () => {
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(
        'Reset Mars pilot progress to 0/3? Other missions, your name and settings are preserved.',
      )
    if (!confirmed) return
    resetMission('spirit')
    useNarrativeStore.getState().reset()
    stopPipVoice()
    useGameStore.getState().unequipScanner()
  }

  const lastScannedId =
    progress && progress.scannedComponentIds.length > 0
      ? progress.scannedComponentIds[
          progress.scannedComponentIds.length - 1
        ]
      : null
  const openRecords = (componentId?: string | null) =>
    openScannerRecords(mission.id, componentId ?? lastScannedId)
  const askPip = () => {
    if (!save) return
    requestMissionHint(mission.id)
  }

  const holdScan = (
    event: ReactPointerEvent<HTMLButtonElement>,
    held: boolean,
  ) => {
    if (held) event.currentTarget.setPointerCapture(event.pointerId)
    setScannerTrigger(held)
  }

  const handleScanKey = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    held: boolean,
  ) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    setScannerTrigger(held)
  }

  if (obscured) return null

  return (
    <>
      {!obscured && (
        <div
          ref={cursorRef}
          className="scanner-cursor"
          aria-hidden="true"
          style={progressStyle}
        >
          <div
            data-state={reticleState}
            className={`scanner-reticle${
              target || environmental ? ' is-target' : ''
            }${
              triggerHeld &&
              (target ? !alreadyScanned : Boolean(environmental))
                ? ' is-scanning'
                : ''
            }${
              alreadyScanned || environmentalDetailed
                ? ' is-recorded'
                : ''
            }`}
          >
            <span className="scanner-reticle__ring" />
            <span className="scanner-reticle__dot" />
            <span className="scanner-reticle__bracket scanner-reticle__bracket--tl" />
            <span className="scanner-reticle__bracket scanner-reticle__bracket--tr" />
            <span className="scanner-reticle__bracket scanner-reticle__bracket--bl" />
            <span className="scanner-reticle__bracket scanner-reticle__bracket--br" />
          </div>
          <p className="scanner-reticle__label">
            {environmental
              ? environmentalDetailed
                ? `${environmental.shortName} · detailed`
                : environmentalQuick
                  ? `${environmental.shortName} · quick`
                  : environmental.shortName
              : target
                ? !discovered
                  ? 'Unidentified fragment'
                  : alreadyScanned
                    ? `${target.shortName} · recorded`
                    : target.shortName
                : discovered
                  ? `Aim at a ${mission.machineName} component`
                  : 'Aim at a landscape feature'}
          </p>
        </div>
      )}

      <aside
        className="scanner-hud"
        data-scanner-hud
        tabIndex={-1}
        aria-label="Cosmic Scanner"
      >
        <div className="scanner-hud__top">
          <div className="scanner-hud__title">
            <p className="settings-eyebrow">
              Cosmic Scanner ·{' '}
              {environmental ? 'Mars field survey' : signalLabel}
            </p>
            <span className="scanner-hud__prototype">Prototype device</span>
          </div>
          <button
            type="button"
            className="scanner-hud__put-away"
            onClick={unequipScanner}
          >
            <span className="desktop-interact">Q · Put away</span>
            <span className="touch-interact">Put away</span>
          </button>
        </div>

        <p className="scanner-hud__status" role="status" aria-live="polite">
          {targetStatus}
        </p>

        <div className="scanner-hud__row">
          <span className="scanner-hud__count">
            {scannedCount}/3
          </span>
          {environmentalCount > 0 && (
            <span
              className="scanner-hud__count scanner-hud__count--field"
              title="Optional environmental field readings"
            >
              {environmentalCount} field
            </span>
          )}
          {archiveCta && (
            <button
              type="button"
              className="scanner-hud__archive"
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
          )}
          <button
            type="button"
            className="scanner-hud__action"
            onClick={askPip}
            disabled={!save || stage === 'transmitted'}
          >
            Ask PIP
          </button>
          {target && alreadyScanned && (
            <button
              type="button"
              className="scanner-hud__action"
              onClick={() => openRecords(target.id)}
            >
              Learn more
            </button>
          )}
          {assistedScanEnabled && discovered && (
            <button
              type="button"
              className="scanner-hud__action scanner-hud__assist"
              onClick={() => openScanner(mission.id)}
            >
              Assisted review
            </button>
          )}
        </div>

        <button
          type="button"
          className="scanner-hud__scan"
          disabled={scanDisabled}
          onPointerDown={(event) => holdScan(event, true)}
          onPointerUp={() => setScannerTrigger(false)}
          onPointerCancel={() => setScannerTrigger(false)}
          onLostPointerCapture={() => setScannerTrigger(false)}
          onKeyDown={(event) => handleScanKey(event, true)}
          onKeyUp={(event) => handleScanKey(event, false)}
          onBlur={() => setScannerTrigger(false)}
        >
          {triggerHeld
            ? 'Scanning…'
            : target && !discovered
              ? 'Inspect first'
              : historicalLocked && target
                ? 'Listening to PIP…'
                : environmental && environmentalQuick && !environmentalDetailed
                ? 'Keep holding for detail'
                : 'Hold to scan'}
        </button>

        <p className="scanner-hud__hint">
          <span className="desktop-interact">
            {scannerCamera === 'first-person'
              ? 'Click to capture mouse · Esc releases · Hold left click to scan'
              : 'Aim with mouse · Hold left click to scan'}
          </span>
          <span className="touch-interact">
            {scannerCamera === 'first-person'
              ? 'Drag to look · Reticle centred · Hold Scan to record'
              : 'Drag to aim · Hold Scan to record'}
          </span>
        </p>

        {import.meta.env.DEV && !save && loadStatus !== 'corrupt' && (
          <button
            type="button"
            className="scanner-hud__dev"
            onClick={startPilot}
          >
            Start Mars pilot · dev save
          </button>
        )}
        {import.meta.env.DEV && save && (
          <button
            type="button"
            className="scanner-hud__dev scanner-hud__dev--reset"
            onClick={resetSpiritPilot}
          >
            Reset Mars pilot
          </button>
        )}
        {!save && loadStatus === 'corrupt' && (
          <p className="scanner-hud__hint" role="status">
            JourneySave could not be read. It was left untouched.
          </p>
        )}
      </aside>
    </>
  )
}
