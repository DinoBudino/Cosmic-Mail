import { MISSION_MODULES } from '../../data/personalization'
import { useOnboardingStore } from '../../store/onboardingStore'

export function ModulePicker() {
  const confirmModule = useOnboardingStore((state) => state.confirmModule)
  const goBack = useOnboardingStore((state) => state.goBack)

  return (
    <section className="quest" aria-labelledby="module-title">
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      <h1 id="module-title" className="sr-only">
        Choose your first mission tool
      </h1>

      <div className="tablet tablet--wide is-ready">
        <div className="tablet__header">
          <span>Mission module</span>
          <span className="tablet__header-trait">Pick 1</span>
        </div>

        <div className="holo-grid">
          {MISSION_MODULES.map((module) => (
            <button
              key={module.id}
              type="button"
              className="holo-card"
              style={{ '--accent': module.accent } as React.CSSProperties}
              onClick={() => confirmModule(module.id)}
            >
              <span className="holo-card__glyph" aria-hidden="true">
                {module.glyph}
              </span>
              <span className="holo-card__name">{module.name}</span>
              <span className="holo-card__bio">{module.ability}</span>
              <span className="holo-card__inspiration">
                Inspired by {module.inspiration.replace(/^Inspired by /, '')}
              </span>
              <span className="holo-card__cta">Choose {module.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
