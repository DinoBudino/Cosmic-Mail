import { useMemo } from 'react'
import {
  getObjective,
  getProtocolStep,
  isCalibrationSampleId,
  type Objective,
  type ProtocolStep,
} from '../data/arrivalProtocol'
import { SPIRIT_SITE } from '../data/spiritSite'
import { isCoarsePointer } from '../game/missionNarrative'
import { stageForProgress } from '../data/missionNarrative'
import { getNextMarkerNumber } from '../data/scanMarkers'
import { SPIRIT_SCAN_ANCHORS } from '../data/spiritSite'
import { scannedComponentCount } from './missionStage'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'

export interface ProtocolView {
  step: ProtocolStep
  objective: Objective
  hasSave: boolean
}

/** React view of the arrival protocol; every field is derived. */
export function useProtocol(): ProtocolView {
  const save = useJourneyStore((state) => state.save)
  const flags = useNarrativeStore((state) => state.protocol)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const lens = useGameStore((state) => state.scannerLens)
  const environmentalId = useGameStore((state) => state.scannerEnvironmentalId)
  const nearbySpirit = useGameStore((state) => state.nearbySpirit)
  const aimedPartId = useGameStore((state) => state.scannerSelectedComponentId)
  const lensTouched = useGameStore((state) => state.lensTouched)
  const sweepActive = useGameStore((state) => state.fullScanSweepActive)
  const tracesRevealed = useGameStore(
    (state) => state.fullScanRecon.revealed.length,
  )
  const aimingAtTrace = useGameStore((state) => state.scannerTraceKind !== null)

  return useMemo(() => {
    const progress = save?.missions[SPIRIT_SITE.missionId] ?? null
    const step = getProtocolStep({
      progress,
      flags,
      priorFieldWork: (save?.environmentalDiscoveries?.length ?? 0) > 0,
    })
    const objective = getObjective({
      step,
      coarsePointer: isCoarsePointer(),
      scannerEquipped,
      aimingAtSample: isCalibrationSampleId(environmentalId),
      lens,
      scannedCount: scannedComponentCount(progress),
      nearSignal: nearbySpirit,
      memoryRecovered: stageForProgress(progress) === 'memory_recovered',
      aimingAtPart: aimedPartId !== null,
      lensTouched,
      sweep: { active: sweepActive, revealed: tracesRevealed, aimingAtTrace },
      nextMarker: getNextMarkerNumber(
        SPIRIT_SCAN_ANCHORS.map((anchor) => anchor.componentId),
        progress?.scannedComponentIds ?? [],
      ),
    })
    return { step, objective, hasSave: save !== null }
  }, [
    save,
    flags,
    scannerEquipped,
    lens,
    environmentalId,
    nearbySpirit,
    aimedPartId,
    lensTouched,
    sweepActive,
    tracesRevealed,
    aimingAtTrace,
  ])
}
