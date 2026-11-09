import { useEffect, useState } from 'react'
import { getTrait } from '../../data/personalization'
import { useOnboardingStore } from '../../store/onboardingStore'
import { useGameStore } from '../../store/gameStore'

type RevealStage = 'scan' | 'sigil' | 'named' | 'cta'

/**
 * Calibration readout: the routine check result materializes on the
 * holographic tablet — a scan sweep, the spirit sigil drawn inside a
 * glowing ring, the trait name, and a CALIBRATED stamp. PIP reacts in
 * his bubble; the tablet does the magic.
 */
export function TraitReveal() {
  const traitId = useOnboardingStore((state) => state.trait)
  const goBack = useOnboardingStore((state) => state.goBack)
  const continueFromReveal = useOnboardingStore((state) => state.continueFromReveal)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [stage, setStage] = useState<RevealStage>(reducedMotion ? 'cta' : 'scan')

  useEffect(() => {
    if (reducedMotion) return
    const timers = [
      window.setTimeout(() => setStage('sigil'), 800),
      window.setTimeout(() => setStage('named'), 1900),
      window.setTimeout(() => setStage('cta'), 2600),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [reducedMotion])

  if (!traitId) return null
  const trait = getTrait(traitId)
  const stageIndex = { scan: 0, sigil: 1, named: 2, cta: 3 }[stage]

  return (
    <section className="quest" aria-labelledby="reveal-title">
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      <div className="tablet reveal-tablet is-ready">
        <div className="tablet__header">
          <span>Routine check — complete</span>
          <span className="quest__progress" role="img" aria-label="All five questions answered">
            {[0, 1, 2, 3, 4].map((index) => (
              <span key={index} className="onboarding__progress-dot is-done" />
            ))}
          </span>
        </div>

        {/* Fixed-height stage area: every stage occupies the same box,
            so the tablet never resizes mid-sequence. */}
        <div className="reveal" aria-live="polite">
          {stage === 'scan' && (
            <div className="reveal-scan" aria-hidden="true">
              <span className="reveal-scan__line" />
            </div>
          )}

          <div className={`reveal-sigil-wrap${stageIndex >= 1 ? ' is-shown' : ''}`}>
            <svg className="reveal-ring" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="54" />
            </svg>
            <span className="reveal-sigil" aria-hidden="true">
              {trait.sigil}
            </span>
          </div>

          <div className={`reveal-copy${stageIndex >= 2 ? ' is-shown' : ''}`}>
            <h1 id="reveal-title" className="reveal__trait reveal-name">
              You are a {trait.name}
            </h1>
            <p className="reveal__description">{trait.description}</p>
          </div>

          <p className={`reveal-stamp${stageIndex >= 3 ? ' is-shown' : ''}`} aria-hidden="true">
            Calibrated
          </p>
        </div>

        <div className={`tablet__cta reveal-cta${stageIndex >= 3 ? ' is-shown' : ''}`}>
          <button
            type="button"
            className="menu__option"
            disabled={stageIndex < 3}
            onClick={continueFromReveal}
          >
            Meet your explorer
          </button>
        </div>
      </div>
    </section>
  )
}
