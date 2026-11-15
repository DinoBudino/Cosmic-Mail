import { useEffect, useRef } from 'react'
import { getRadarTarget, getRadarTargetKind } from '../data/arrivalProtocol'
import { MAILWING_LANDING, SPIRIT_SITE } from '../data/spiritSite'
import { useProtocol } from './useProtocol'
import { getOrbit } from '../game/cameraRig'
import { playerPosition } from '../game/playerPosition'
import { getMinimapPoint, SPIRIT_RADAR_RANGE } from '../game/radar'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { canBoardShip } from '../game/landedShip'
import { getArchiveCtaLabel, getMissionStage } from './missionStage'

/** Disc radius (SVG units) where the star sits when it is out of range. */
const MAP_RADIUS = 40

/**
 * The minimap: a small round map at the side of the screen, nothing else.
 * It turns with the camera, so the top is always where the child is
 * looking: the arrow in the middle is the child, the star is where to go.
 * Out of range, the star waits on the rim pointing the way.
 *
 * The few actions that matter at a given moment (scan, archive, return)
 * float above the map as big buttons, outside the map itself.
 */
export function CosmicRadar() {
  const nearbySpirit = useGameStore((state) => state.nearbySpirit)
  const nearbyShip = useGameStore((state) => state.nearbyShip)
  const nearbySiteId = useGameStore((state) => state.nearbySiteId)
  const radarUnlocked = useGameStore((state) => state.radarUnlocked)
  const scannerLocked = useGameStore((state) => state.scannerLocked)
  const cinematicFocus = useGameStore((state) => state.cinematicFocus)
  const briefingStep = useGameStore((state) => state.marsBriefingStep)
  const activeSiteId = useGameStore((state) => state.activeSiteId)
  const arriving = useGameStore((state) => state.arrivalStage !== 'done')
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const pipMessage = useGameStore((state) => state.pipMessage)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerRecordsOpen = useGameStore((state) => state.scannerRecordsOpen)
  const archiveView = useGameStore((state) => state.archiveView)
  const equipScanner = useGameStore((state) => state.equipScanner)
  const openScannerRecords = useGameStore((state) => state.openScannerRecords)
  const openArchive = useGameStore((state) => state.openArchive)
  const save = useJourneyStore((state) => state.save)
  const loadStatus = useJourneyStore((state) => state.loadStatus)
  const startJourney = useJourneyStore((state) => state.startJourney)
  const setDestination = useJourneyStore((state) => state.setDestination)

  const { step } = useProtocol()
  // Letter sealed (or story already sent): the star points back to Mailwing.
  const toShip = canBoardShip(save, SPIRIT_SITE.missionId)
  const radarTarget = toShip
    ? MAILWING_LANDING.position
    : getRadarTarget(step, SPIRIT_SITE.position)
  const targetKind = getRadarTargetKind(step)
  const targetX = radarTarget.x
  const targetZ = radarTarget.z

  const hidden =
    arriving ||
    settingsOpen ||
    activeSiteId !== null ||
    nearbySiteId !== null ||
    scannerEquipped ||
    scannerOpen ||
    scannerRecordsOpen ||
    archiveView !== 'none' ||
    cinematicFocus !== null

  // Moves the star every frame without re-rendering React: the map turns
  // with the camera, so it has to follow the mouse smoothly.
  const starRef = useRef<SVGGElement>(null)
  const rimRef = useRef<SVGGElement>(null)
  useEffect(() => {
    if (hidden) return
    let frame = 0
    const update = () => {
      const point = getMinimapPoint(
        playerPosition,
        { x: targetX, z: targetZ },
        getOrbit().yaw,
        SPIRIT_RADAR_RANGE,
      )
      const x = 50 + point.x * MAP_RADIUS
      const y = 50 + point.y * MAP_RADIUS
      starRef.current?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`)
      // Out of range: the star turns into a pointer on the rim.
      const angle = (Math.atan2(point.x, -point.y) * 180) / Math.PI
      rimRef.current?.setAttribute('transform', `rotate(${angle.toFixed(1)} 50 50)`)
      rimRef.current?.setAttribute('opacity', point.inRange ? '0' : '1')
      frame = window.requestAnimationFrame(update)
    }
    update()
    return () => window.cancelAnimationFrame(frame)
  }, [hidden, targetX, targetZ])

  if (hidden) return null

  const progress = save?.missions[SPIRIT_SITE.missionId] ?? null
  const stage = getMissionStage(progress)
  const archiveCta = getArchiveCtaLabel(stage)
  const discovered = Boolean(progress?.discovered)

  // The landing step (M0) shows no radar: PIP presents it first.
  if (save && !radarUnlocked && !discovered) return null

  const label = toShip
    ? nearbyShip
      ? 'Board the ship!'
      : 'Back to the ship'
    : nearbySpirit
    ? discovered
      ? 'You found it!'
      : 'Something is here!'
    : targetKind === 'station'
      ? 'Go to the glowing rock'
      : 'Follow the star'

  const startPilot = () => {
    if (loadStatus === 'corrupt') return
    if (!startJourney('Pilot')) return
    setDestination('mars')
  }

  const lastScannedId =
    progress && progress.scannedComponentIds.length > 0
      ? progress.scannedComponentIds[progress.scannedComponentIds.length - 1]
      : null
  const showRecords =
    discovered || (save?.environmentalDiscoveries.length ?? 0) > 0

  return (
    <aside
      className={`cosmic-radar${nearbySpirit ? ' is-near' : ''}${
        step === 'M1' || step === 'M3' ? ' is-guided' : ''
      }${pipMessage ? ' is-pip-speaking' : ''}${
        briefingStep === 'radar' || briefingStep === 'radar-detail'
          ? ' is-briefing-focus'
          : ''
      }`}
      // PIP is presenting it: on screen, but not usable yet.
      inert={briefingStep !== null}
      aria-label={`Map: ${label}`}
    >
      <div className="cosmic-radar__stack">
        {/* Only after "press E" is done: one action at a time near the rover. */}
        {nearbySpirit && save && discovered && !scannerLocked && step === 'M4' && (
          <button
            type="button"
            className="site-action cosmic-radar__scan"
            onClick={() => equipScanner(SPIRIT_SITE.missionId)}
          >
            <span className="desktop-interact">Take out scanner (Q)</span>
            <span className="touch-interact">Take out scanner</span>
          </button>
        )}
        {archiveCta && (
          <button
            type="button"
            className="site-action cosmic-radar__archive"
            onClick={() =>
              openArchive('smart-letter', SPIRIT_SITE.missionId)
            }
          >
            {archiveCta}
          </button>
        )}
        {save && showRecords && (
          <button
            type="button"
            className="cosmic-radar__action"
            data-records-trigger
            onClick={() => openScannerRecords(SPIRIT_SITE.missionId, lastScannedId)}
          >
            {discovered ? 'Mission records' : 'Field notes'}
          </button>
        )}
        {import.meta.env.DEV && !save && loadStatus !== 'corrupt' && (
          <button type="button" className="site-action cosmic-radar__dev" onClick={startPilot}>
            Start Mars pilot · dev save
          </button>
        )}
        {!save && loadStatus === 'corrupt' && (
          <p className="cosmic-radar__note" role="status">
            The journey save could not be read. It was left untouched.
          </p>
        )}
      </div>

      <div className="cosmic-radar__map-wrap">
        <svg viewBox="0 0 100 100" className="cosmic-radar__map" aria-hidden="true">
          <defs>
            <radialGradient id="minimap-ground" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7d6158" />
              <stop offset="100%" stopColor="#4a3934" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#minimap-ground)" className="cosmic-radar__disc" />
          <circle cx="50" cy="50" r="27" className="cosmic-radar__ring" />
          {/* What the camera sees: a soft cone pointing up. */}
          <path d="M50 50 L33 12 A40 40 0 0 1 67 12 Z" className="cosmic-radar__view" />
          <g ref={rimRef} opacity="0">
            <path d="M50 3.5 L45.5 10 L54.5 10 Z" className="cosmic-radar__pointer" />
          </g>
          <g ref={starRef} transform="translate(50 50)">
            <circle r="8" className="cosmic-radar__halo" />
            <path
              d="M0 -6.4 L1.9 -2 L6.6 -2 L2.8 1 L4.1 5.6 L0 2.9 L-4.1 5.6 L-2.8 1 L-6.6 -2 L-1.9 -2 Z"
              className="cosmic-radar__star"
            />
          </g>
          <path d="M50 43.5 L55.2 55 L50 52.2 L44.8 55 Z" className="cosmic-radar__player" />
        </svg>
      </div>
      <p className="cosmic-radar__label">{label}</p>
    </aside>
  )
}
