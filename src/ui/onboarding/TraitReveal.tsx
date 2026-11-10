import { useEffect, useState } from 'react'
import { DISCOVERY_QUESTIONS, getTrait } from '../../data/personalization'
import { useOnboardingStore } from '../../store/onboardingStore'
import { useGameStore } from '../../store/gameStore'
import { TraitSigil } from './RoutineCheckVisuals'

type RevealStage = 'lights' | 'sigil' | 'named' | 'cta'

/**
 * The Routine Check reveal, inside the Cosmic Memory Window:
 * four lights (the child's four decisions) gather and form the
 * spirit's sigil, then the name is spoken. A playful interpretation,
 * never a diagnosis — no percentages, no statistics.
 */
export function TraitReveal() {
  const traitId = useOnboardingStore((state) => state.trait)
  const answers = useOnboardingStore((state) => state.answers)
  const goBack = useOnboardingStore((state) => state.goBack)
  const continueFromReveal = useOnboardingStore((state) => state.continueFromReveal)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [stage, setStage] = useState<RevealStage>(reducedMotion ? 'cta' : 'lights')
  const [showChoices, setShowChoices] = useState(false)

  useEffect(() => {
    if (reducedMotion) return
    const timers = [
      window.setTimeout(() => setStage('sigil'), 1100),
      window.setTimeout(() => setStage('named'), 2200),
      window.setTimeout(() => setStage('cta'), 3000),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [reducedMotion])

  if (!traitId) return null
  const trait = getTrait(traitId)
  const stageIndex = { lights: 0, sigil: 1, named: 2, cta: 3 }[stage]

  // The real decisions, kept for the optional "See my choices" review.
  const decisions = answers.map((answer, index) => {
    const choice = DISCOVERY_QUESTIONS[index]?.choices.find((entry) => entry.trait === answer)
    return { title: choice?.title ?? answer, sigilTrait: answer }
  })

  return (
    <section className="quest routine-reveal" aria-labelledby="reveal-title">
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      {/* Reveal stage inside the Cosmic Memory Window. */}
      <div className="routine__stage routine-reveal__stage" aria-live="polite">
        {/* The four decision lights, gathering toward the centre. */}
        <div className={`routine-reveal__lights${stageIndex >= 1 ? ' is-gathered' : ''}`} aria-hidden="true">
          {decisions.map((decision, index) => (
            <span
              key={index}
              className="routine-reveal__light"
              style={{ '--delay': `${index * 0.18}s` } as React.CSSProperties}
            >
              <TraitSigil trait={decision.sigilTrait} />
            </span>
          ))}
        </div>

        <div className={`routine-reveal__sigil${stageIndex >= 1 ? ' is-shown' : ''}`} aria-hidden="true">
          <TraitSigil trait={traitId} />
        </div>

        <div className={`routine-reveal__copy${stageIndex >= 2 ? ' is-shown' : ''}`}>
          <p className="routine-reveal__over">Your explorer spirit is…</p>
          <h1 id="reveal-title" className="routine-reveal__name">
            {trait.name}
          </h1>
          <p className="routine-reveal__description">{trait.description}</p>
        </div>
      </div>

      {/* Action dock: a compact holo bar in the safe band above the
          console, with one warm primary action and a discreet
          secondary review action. It never sits on the console plate. */}
      <div className="routine-reveal__panel">
        <div className={`routine-reveal__dock${stageIndex >= 3 ? ' is-shown' : ''}`}>
          <button
            type="button"
            className="reveal__primary"
            disabled={stageIndex < 3}
            onClick={continueFromReveal}
          >
            Meet your hero
          </button>
          <button
            type="button"
            className="reveal__secondary"
            aria-expanded={showChoices}
            onClick={() => setShowChoices((open) => !open)}
          >
            {showChoices ? 'Hide my choices' : 'See my choices'}
          </button>

          {showChoices && decisions.length > 0 && (
            <ul className="routine-reveal__choices" aria-label="Your four decisions">
              {decisions.map((decision, index) => (
                <li key={index} className="routine-reveal__chip">
                  <TraitSigil trait={decision.sigilTrait} />
                  {decision.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
