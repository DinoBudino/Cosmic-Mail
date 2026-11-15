import { useMemo } from 'react'
import {
  getObjective,
  getProtocolStep,
  isCalibrationSampleId,
  type Objective,
  type ProtocolStep,
  hasPriorFieldWork,
} from '../data/arrivalProtocol'
import { SPIRIT_SITE } from '../data/spiritSite'
import { isCoarsePointer } from '../game/missionNarrative'
import { getHuntTarget, stageForProgress } from '../data/missionNarrative'
import { getMission } from '../data/missions'
import { getNextMarkerNumber } from '../data/scanMarkers'
import { getScanAnchors } from '../data/spiritSite'
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
  const environmentalId = useGameStore((state) => state.scannerEnvironmentalId)
  const nearbySpirit = useGameStore((state) => state.nearbySpirit)
  const aimedPartId = useGameStore((state) => state.scannerSelectedComponentId)

  return useMemo(() => {
    const progress = save?.missions[SPIRIT_SITE.missionId] ?? null
    const step = getProtocolStep({
      progress,
      flags,
      priorFieldWork: hasPriorFieldWork(save, SPIRIT_SITE.missionId),
    })
    const objective = getObjective({
      step,
      coarsePointer: isCoarsePointer(),
      scannerEquipped,
      aimingAtSample: isCalibrationSampleId(environmentalId),
      scannedCount: scannedComponentCount(progress),
      nearSignal: nearbySpirit,
      memoryRecovered: stageForProgress(progress) === 'memory_recovered',
      aimingAtPart: aimedPartId !== null,
      huntClue:
        getHuntTarget(getMission(SPIRIT_SITE.missionId), progress)?.huntClue
          ?.short ?? null,
      nextMarker: getNextMarkerNumber(
        getScanAnchors().map((anchor) => anchor.componentId),
        progress?.scannedComponentIds ?? [],
      ),
    })
    return { step, objective, hasSave: save !== null }
  }, [
    save,
    flags,
    scannerEquipped,
    environmentalId,
    nearbySpirit,
    aimedPartId,
  ])
}
