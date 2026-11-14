import { useEffect, useState } from 'react'
import { getMission } from '../data/missions'
import { getRadarTarget, getRadarTargetKind } from '../data/arrivalProtocol'
import { SPIRIT_SITE } from '../data/spiritSite'
import { useProtocol } from './useProtocol'
import { playerPosition } from '../game/playerPosition'
import {
  getRadarSnapshot,
  radarDirectionLabel,
  SPIRIT_RADAR_RANGE,
  type RadarSnapshot,
} from '../game/radar'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { requestMissionHint } from '../game/missionNarrative'
import { stopPipVoice } from '../game/pipVoice'
import { getArchiveCtaLabel, getMissionStage } from './missionStage'

const RADAR_UPDATE_MS = 120

export function CosmicRadar() {
  const nearbySpirit = useGameStore((state) => state.nearbySpirit)
  const nearbySiteId = useGameStore((state) => state.nearbySiteId)
  const radarUnlocked = useGameStore((state) => state.radarUnlocked)
  const scannerLocked = useGameStore((state) => state.scannerLocked)
  const cinematicFocus = useGameStore((state) => state.cinematicFocus)
  const activeSiteId = useGameStore((state) => state.activeSiteId)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const pipMessage = useGameStore((state) => state.pipMessage)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const archiveView = useGameStore((state) => state.archiveView)
  const equipScanner = useGameStore((state) => state.equipScanner)
  const openScannerRecords = useGameStore(
    (state) => state.openScannerRecords,
  )
  const openArchive = useGameStore((state) => state.openArchive)
  const save = useJourneyStore((state) => state.save)
  const loadStatus = useJourneyStore((state) => state.loadStatus)
  const startJourney = useJourneyStore((state) => state.startJourney)
  const setDestination = useJourneyStore((state) => state.setDestination)
  const resetMission = useJourneyStore((state) => state.resetMission)

  const { step } = useProtocol()
  const radarTarget = getRadarTarget(step, SPIRIT_SITE.position)
  const targetKind = getRadarTargetKind(step)
  const targetX = radarTarget.x
  const targetZ = radarTarget.z

  const [snapshot, setSnapshot] = useState<RadarSnapshot>(() =>
    getRadarSnapshot(
      playerPosition,
      { x: targetX, z: targetZ },
      SPIRIT_RADAR_RANGE,
    ),
  )

  useEffect(() => {
    const update = () => {
      setSnapshot(
        getRadarSnapshot(
          playerPosition,
          { x: targetX, z: targetZ },
          SPIRIT_RADAR_RANGE,
        ),
      )
    }
    update()
    const timer = window.setInterval(update, RADAR_UPDATE_MS)
    return () => window.clearInterval(timer)
  }, [targetX, targetZ])

  if (
    settingsOpen ||
    activeSiteId ||
    nearbySiteId ||
    scannerEquipped ||
    scannerOpen ||
    scannerRecordsOpen ||
    archiveView !== 'none' ||
    cinematicFocus !== null
  ) {
    return null
  }

  const mission = getMission(SPIRIT_SITE.missionId)
  const progress = save?.missions[SPIRIT_SITE.missionId] ?? null
  const stage = getMissionStage(progress)
  const archiveCta = getArchiveCtaLabel(stage)
  const discovered = Boolean(progress?.discovered)

  // The landing step (M0) shows no radar: it appears, animated, in M1.
  if (save && !radarUnlocked && !discovered) return null

  const signalLabel = discovered
    ? mission.machineName
    : targetKind === 'station'
      ? 'Calibration station'
      : 'Unknown signal'
  const blipX = 50 + snapshot.x * 42
  const blipY = 50 + snapshot.y * 42

  const startPilot = () => {
    if (loadStatus === 'corrupt') return
    if (!startJourney('Pilot')) return
    setDestination('mars')
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
  const openRecords = () =>
    openScannerRecords(SPIRIT_SITE.missionId, lastScannedId)
  const askPip = () => requestMissionHint(SPIRIT_SITE.missionId)

  return (
    <aside
      className={`cosmic-radar${nearbySpirit ? ' is-near' : ''}${
        step === 'M1' || step === 'M3' ? ' is-guided' : ''
      }${
        pipMessage ? ' is-pip-speaking' : ''
      }`}
      aria-label={`Cosmic radar: ${signalLabel}`}
    >
      <header className="cosmic-radar__header">
        <p className="settings-eyebrow">Cosmic radar</p>
        <h2 className="cosmic-radar__title">{signalLabel}</h2>
        <p className="cosmic-radar__distance">
          {Math.round(snapshot.distance)} m{' '}
          {radarDirectionLabel(snapshot.bearing)}
        </p>
      </header>

      {!nearbySpirit && (
        <div className="cosmic-radar__scope" aria-hidden="true">
          <div className="cosmic-radar__sweep" />
          <svg viewBox="0 0 100 100" className="cosmic-radar__map">
            <circle cx="50" cy="50" r="46" className="cosmic-radar__ring" />
            <circle
              cx="50"
              cy="50"
              r="31"
              className="cosmic-radar__ring cosmic-radar__ring--faint"
            />
            <line
              x1="50"
              y1="50"
              x2={blipX}
              y2={blipY}
              className="cosmic-radar__line"
            />
            <circle
              cx={blipX}
              cy={blipY}
              r="3.2"
              className="cosmic-radar__blip"
            />
            <circle cx="50" cy="50" r="2" className="cosmic-radar__player" />
          </svg>
        </div>
      )}

      {archiveCta && (
        <button
          type="button"
          className="site-action cosmic-radar__archive"
          onClick={() =>
            openArchive(
              stage === 'ready_for_full_scan' ? 'full-scan' : 'smart-letter',
              SPIRIT_SITE.missionId,
            )
          }
        >
          {archiveCta}
        </button>
      )}
      {stage === 'smart_letter_ready' && (
        <button
          type="button"
          className="site-action cosmic-radar__archive"
          onClick={() => useOnboardingStore.getState().returnToShip()}
        >
          Return to Mailwing
        </button>
      )}

      {save && (
        <div className="cosmic-radar__actions">
          {(discovered ||
            (save?.environmentalDiscoveries.length ?? 0) > 0) && (
            <button
              type="button"
              className="cosmic-radar__action"
              data-records-trigger
              onClick={openRecords}
            >
              {discovered ? 'Mission records' : 'Field notes'}
            </button>
          )}
          {stage !== 'transmitted' && (
            <button
              type="button"
              className="cosmic-radar__action"
              onClick={askPip}
            >
              Ask PIP
            </button>
          )}
        </div>
      )}

      {nearbySpirit && (
        <p className="cosmic-radar__near-line">
          {discovered
            ? `${mission.machineName} is within scanner range.`
            : 'The unidentified signal is within scanner range.'}
        </p>
      )}

      {nearbySpirit && save && !scannerLocked && (
        <button
          type="button"
          className="site-action cosmic-radar__scan"
          onClick={() => equipScanner(SPIRIT_SITE.missionId)}
        >
          <span className="desktop-interact">
            Press Q or click to equip scanner
          </span>
          <span className="touch-interact">Tap to equip scanner</span>
        </button>
      )}
      {!nearbySpirit && save && step !== 'M1' && step !== 'M3' && (
        <p className="cosmic-radar__note">
          Press Q to equip the Cosmic Scanner. Move the mouse to aim and hold
          left click to scan.
        </p>
      )}

      {import.meta.env.DEV && save && (
        <button
          type="button"
          className="site-action cosmic-radar__dev cosmic-radar__dev--reset"
          onClick={resetSpiritPilot}
        >
          Reset Mars pilot
        </button>
      )}

      {import.meta.env.DEV && !save && loadStatus !== 'corrupt' && (
        <>
          <button
            type="button"
            className="site-action cosmic-radar__dev"
            onClick={startPilot}
          >
            Start Mars pilot · dev save
          </button>
          <p className="cosmic-radar__note">
            {loadStatus === 'unavailable'
              ? 'Storage is unavailable. Creates an in-memory journey for this session only.'
              : 'Development only. Creates a new journey save for testing.'}
          </p>
        </>
      )}
      {!save && loadStatus === 'corrupt' && (
        <p className="cosmic-radar__note" role="status">
          The journey save could not be read. It was left untouched; clear it
          manually before starting a new journey.
        </p>
      )}
    </aside>
  )
}
