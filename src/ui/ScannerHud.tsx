import { isMouseLookFirstPerson } from '../game/cameraRig'
import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { getEnvironmentalSite } from '../data/environmentalSites'
import { RETICLE_STATUS_LABEL, getReticleStatus } from '../data/reticleStatus'
import { fragmentLabel, getNextMarkerNumber, isPartScannableNow } from '../data/scanMarkers'
import { getScanAnchors } from '../data/spiritSite'

const markerOrder = () => getScanAnchors().map((anchor) => anchor.componentId)
import { getMission } from '../data/missions'
import { resolveScanRelease } from '../game/scannerLatch'
import {
  scannerPointer,
  setScannerPointer,
} from '../game/scannerPointer'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'

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
  const distractorId = useGameStore((state) => state.scannerDistractorId)
  const scannerPhysicalState = useGameStore(
    (state) => state.scannerPhysicalState,
  )
  const scanStation = useGameStore((state) => state.scanStation)
  const assistedScanEnabled = useGameStore(
    (state) => state.assistedScanEnabled,
  )
  const scanProgress = useGameStore((state) => state.scannerScanProgress)
  const triggerHeld = useGameStore((state) => state.scannerTriggerHeld)
  const latched = useGameStore((state) => state.scannerLatched)
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

  const save = useJourneyStore((state) => state.save)
  const loadStatus = useJourneyStore((state) => state.loadStatus)
  const startJourney = useJourneyStore((state) => state.startJourney)
  const setDestination = useJourneyStore((state) => state.setDestination)
  const cursorRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef({ at: 0, startedLatched: false })

  // Keep the real mouse position ready even before the scanner is equipped,
  // so the reticle never starts pinned to the screen centre.
  useEffect(() => {
    const onPointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      if (!(event.target instanceof HTMLCanvasElement)) return
      const state = useGameStore.getState()
      if (isMouseLookFirstPerson(state)) {
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
  const discovered = Boolean(progress?.discovered)
  const target =
    mission.components.find((component) => component.id === selectedId) ??
    null
  const distractor = distractorId
    ? (mission.distractors?.find((entry) => entry.id === distractorId) ??
      null)
    : null
  const environmental = environmentalId
    ? getEnvironmentalSite(environmentalId)
    : null
  const environmentalDetailed = environmental
    ? (save?.environmentalDetailedDiscoveries.includes(environmental.id) ??
      false)
    : false
  const alreadyScanned = target
    ? (progress?.scannedComponentIds.includes(target.id) ?? false)
    : false
  // A part keeps a neutral "Fragment N" label until it is recorded.
  const partLabel = target
    ? alreadyScanned
      ? target.shortName
      : fragmentLabel(markerOrder(), target.id)
    : ''
  const obscured = Boolean(
    scannerOpen ||
      scannerCard ||
      scannerRecordsOpen ||
      archiveView !== 'none' ||
      settingsOpen ||
      activeSiteId,
  )
  // The hunt goes in order: a later part is named but not recorded yet.
  const scannedIds = progress?.scannedComponentIds ?? []
  const later = Boolean(
    target &&
      discovered &&
      !alreadyScanned &&
      !isPartScannableNow(markerOrder(), scannedIds, target.id),
  )
  const nextNumber = later ? getNextMarkerNumber(markerOrder(), scannedIds) : null
  // One status word under the label, consistent with the panel and bar.
  const reticleStatus = getReticleStatus({
    later,
    hasTarget: Boolean(target || environmental || distractor),
    physicalState: scannerPhysicalState,
    triggerHeld,
    recorded: alreadyScanned || environmentalDetailed,
  })
  const scanDisabled =
    !save ||
    (!target && !environmental && !distractor) ||
    (Boolean(target) &&
      (!discovered || alreadyScanned || later)) ||
    Boolean(environmental && environmentalDetailed)
  let reticleState:
    | 'idle'
    | 'valid'
    | 'out-of-range'
    | 'occluded'
    | 'scanning'
    | 'completed'
    | 'already-scanned'
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
  } else if (distractor) {
    reticleState = !discovered
      ? 'inspect'
      : triggerHeld
        ? 'scanning'
        : 'valid'
  } else if (target) {
    reticleState = !discovered
      ? 'inspect'
      : alreadyScanned
        ? 'already-scanned'
        : later
          ? 'inspect'
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

  // Touch ergonomics: a quick tap latches the scan on the current target so
  // the player can lift the finger; a long press is the classic hold.
  const hasAnyTarget = Boolean(
    target || environmental || distractor,
  )

  const pressScan = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const startedLatched = useGameStore.getState().scannerLatched
    pressRef.current = { at: performance.now(), startedLatched }
    // Pressing while latched cancels it; the release below is a no-op.
    setScannerTrigger(startedLatched ? false : true)
  }

  const releaseScan = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const { at, startedLatched } = pressRef.current
    const action = resolveScanRelease({
      pointerType: event.pointerType,
      durationMs: performance.now() - at,
      hasTarget: hasAnyTarget,
      startedLatched,
    })
    pressRef.current = { at: 0, startedLatched: false }
    if (action === 'latch') {
      useGameStore.getState().setScannerLatched()
    } else if (action === 'release') {
      setScannerTrigger(false)
    }
    // 'unlatch' already released the trigger on pointer down.
  }

  const releaseUnlessLatched = () => {
    if (!useGameStore.getState().scannerLatched) setScannerTrigger(false)
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
              target || environmental || distractor ? ' is-target' : ''
            }${
              triggerHeld &&
              (target
                ? !alreadyScanned
                : Boolean(environmental || distractor))
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
                ? `${environmental.shortName} · recorded`
                : environmental.shortName
              : distractor
                ? discovered
                  ? distractor.shortName
                  : 'Unidentified fragment'
              : target
                ? !discovered
                  ? 'Unidentified fragment'
                  : alreadyScanned
                    ? `${target.shortName} · recorded`
                    : partLabel
                : ''}
          </p>
          {reticleStatus && (
            <p
              className="scanner-reticle__status"
              data-status={reticleStatus}
            >
              {reticleStatus === 'later' && nextNumber
                ? `Find #${nextNumber} first`
                : RETICLE_STATUS_LABEL[reticleStatus]}
            </p>
          )}
        </div>
      )}

      {/* The device itself only shows what nothing else on screen says:
          how to put it away and, on touch screens, the scan button. The
          objective bar carries the goal, the count and Ask PIP; the reticle
          carries the target and "hold to scan". */}
      <aside
        className="scanner-hud scanner-hud--slim"
        data-scanner-hud
        tabIndex={-1}
        aria-label="Cosmic Scanner"
      >
        {!scanStation && (
          <button
            type="button"
            className="scanner-hud__put-away"
            onClick={unequipScanner}
          >
            <span className="desktop-interact">Q · Put away</span>
            <span className="touch-interact">Put away</span>
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
        <button
          type="button"
          className="scanner-hud__scan touch-interact"
          disabled={scanDisabled}
          onPointerDown={pressScan}
          onPointerUp={releaseScan}
          onPointerCancel={() => setScannerTrigger(false)}
          onLostPointerCapture={releaseUnlessLatched}
          onKeyDown={(event) => handleScanKey(event, true)}
          onKeyUp={(event) => handleScanKey(event, false)}
          onBlur={releaseUnlessLatched}
        >
          {triggerHeld
            ? latched
              ? 'Scanning… tap to cancel'
              : 'Scanning…'
            : 'Hold to scan'}
        </button>
        {import.meta.env.DEV && !save && loadStatus !== 'corrupt' && (
          <button
            type="button"
            className="scanner-hud__dev"
            onClick={startPilot}
          >
            Start Mars pilot · dev save
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
