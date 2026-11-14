import { isStepAtLeast, type ProtocolStep } from '../data/arrivalProtocol'
import { SPIRIT_SITE } from '../data/spiritSite'
import { requestMissionHint } from '../game/missionNarrative'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { getMissionStage } from './missionStage'
import { useProtocol } from './useProtocol'

interface BarAction {
  label: string
  run: () => void
}

/** The one primary action that moves the current step forward, if any. */
function getPrimaryAction(
  step: ProtocolStep,
  stage: ReturnType<typeof getMissionStage>,
): BarAction | null {
  const missionId = SPIRIT_SITE.missionId
  if (step === 'M5') {
    const game = useGameStore.getState()
    if (game.fullScanSweepActive) {
      return {
        label: 'Scan panel',
        run: () => game.openArchive('full-scan', missionId),
      }
    }
    return {
      label: game.fullScanRecon.revealed.length >= 4 ? 'Rebuild core' : 'Start scan',
      run: () => game.startFullScanSweep(missionId),
    }
  }
  if (step === 'M6' && stage === 'memory_recovered') {
    return {
      label: 'Prepare letter',
      run: () => useGameStore.getState().openArchive('smart-letter', missionId),
    }
  }
  if (step === 'M6' && stage === 'smart_letter_ready') {
    return {
      label: 'Return to Mailwing',
      run: () => useOnboardingStore.getState().returnToShip(),
    }
  }
  return null
}

/**
 * The single place that says what to do now. It is derived from journey
 * progress (via useProtocol), shows one line, and carries the one action
 * that moves the current step forward. "Ask PIP" is offered while the
 * player is still learning (M0–M4).
 */
export function ObjectiveBar() {
  const { step, objective, hasSave } = useProtocol()
  const progress = useJourneyStore(
    (state) => state.save?.missions[SPIRIT_SITE.missionId] ?? null,
  )
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  // Subscribed so the primary action label follows the sweep.
  useGameStore((state) => state.fullScanSweepActive)
  useGameStore((state) => state.fullScanRecon.revealed.length)
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const activeSiteId = useGameStore((state) => state.activeSiteId)
  const cinematicFocus = useGameStore((state) => state.cinematicFocus)

  if (
    !hasSave ||
    settingsOpen ||
    scannerOpen ||
    scannerRecordsOpen ||
    archiveOpen ||
    activeSiteId ||
    cinematicFocus !== null
  ) {
    return null
  }

  const action = getPrimaryAction(step, getMissionStage(progress))
  const learning = !isStepAtLeast(step, 'M5')

  return (
    <aside
      className="objective-bar"
      data-step={step}
      data-highlight={objective.highlight ?? undefined}
      aria-label="Current objective"
    >
      <p className="objective-bar__text" role="status" aria-live="polite">
        {objective.text}
      </p>
      {action && (
        <button
          type="button"
          className="objective-bar__action"
          onClick={action.run}
        >
          {action.label}
        </button>
      )}
      {learning && (
        <button
          type="button"
          className="objective-bar__ask"
          onClick={() => requestMissionHint()}
        >
          Ask PIP
        </button>
      )}
    </aside>
  )
}
