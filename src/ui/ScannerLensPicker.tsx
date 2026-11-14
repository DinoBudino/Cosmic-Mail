import {
  SCANNER_LENS_IDS,
  SCANNER_LENSES,
  cycleScannerLens,
} from '../data/scannerLenses'
import { CALIBRATION_SAMPLE } from '../data/arrivalProtocol'
import { useGameStore } from '../store/gameStore'
import { shouldPulseCorrectLens } from '../data/lensFeedback'
import { getMission } from '../data/missions'
import { lensMatchesComponent } from '../data/scannerLenses'
import { useProtocol } from './useProtocol'

/**
 * Accessible lens selector shared by the HUD and the assisted review.
 * Radio semantics: arrows cycle, 1/2/3 select in the 3D world, and touch
 * users tap. The lens is ephemeral state and never progress.
 */
export function ScannerLensPicker() {
  const scannerLens = useGameStore((state) => state.scannerLens)
  const setScannerLens = useGameStore((state) => state.setScannerLens)
  const { objective } = useProtocol()
  // Only the calibration sample teaches a lens out loud; real parts never do.
  const aimedId = useGameStore((state) => state.scannerSelectedComponentId)
  const missionId = useGameStore((state) => state.scannerMissionId)
  const attempts = useGameStore((state) =>
    aimedId ? (state.wrongLensAttempts[aimedId] ?? 0) : 0,
  )
  // After three missed presses on one part, its correct lens pulses softly.
  const aimedComponent =
    aimedId && missionId
      ? (getMission(missionId).components.find((c) => c.id === aimedId) ??
        null)
      : null
  const pulseLens =
    aimedComponent &&
    shouldPulseCorrectLens(attempts) &&
    !lensMatchesComponent(aimedComponent, scannerLens)
      ? aimedComponent.lens
      : null
  const guidedLens =
    objective.highlight === 'lens' ? CALIBRATION_SAMPLE.lens : pulseLens
  // First recognition: the whole selector pulses once, naming no lens.
  const intro = objective.highlight === 'lens-picker'

  return (
    <div
      className={`scanner-hud__lenses${intro ? ' is-intro' : ''}`}
      role="radiogroup"
      aria-label="Scanner lens"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          setScannerLens(cycleScannerLens(scannerLens, 1))
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          setScannerLens(cycleScannerLens(scannerLens, -1))
        }
      }}
    >
      {SCANNER_LENS_IDS.map((lensId) => {
        const lens = SCANNER_LENSES[lensId]
        const active = lensId === scannerLens
        return (
          <button
            key={lensId}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={lens.description}
            className={`scanner-hud__lens${active ? ' is-active' : ''}${
              lensId === guidedLens ? ' is-guided' : ''
            }`}
            onClick={() => setScannerLens(lensId)}
          >
            <span className="desktop-interact">{lens.key} · </span>
            {lens.shortLabel}
          </button>
        )
      })}
    </div>
  )
}
