import {
  getProtocolStep,
  type ProtocolStep,
  hasPriorFieldWork,
} from '../data/arrivalProtocol'
import type { JourneySave } from '../store/journeySchema'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { SPIRIT_SITE } from '../data/spiritSite'

/**
 * Current arrival-protocol step, derived on demand from the journey save
 * (the only progress source) plus the ephemeral protocol flags. Saves that
 * already show field work skip the opening steps.
 */
export function getCurrentProtocolStep(
  save: JourneySave | null = useJourneyStore.getState().save,
): ProtocolStep {
  const progress = save?.missions[SPIRIT_SITE.missionId] ?? null
  return getProtocolStep({
    progress,
    flags: useNarrativeStore.getState().protocol,
    priorFieldWork: hasPriorFieldWork(save, SPIRIT_SITE.missionId),
  })
}
