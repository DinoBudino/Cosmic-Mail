import {
  MODULE_SLOTS,
  STAMP_SLOTS,
  getExplorer,
  getModule,
  getTrait,
} from '../../data/personalization'
import { useOnboardingStore } from '../../store/onboardingStore'

export function Passport({ pinned = false }: { pinned?: boolean }) {
  const passport = useOnboardingStore((state) => state.passport)
  const openRoute = useOnboardingStore((state) => state.openRoute)
  const goBack = useOnboardingStore((state) => state.goBack)

  if (!passport) return null

  const trait = getTrait(passport.trait)
  const explorer = getExplorer(passport.explorerId)
  const module = getModule(passport.moduleId)

  return (
    <section
      className={`onboarding__panel onboarding__panel--wide${pinned ? ' passport--pinned' : ''}`}
      aria-labelledby={pinned ? undefined : 'passport-title'}
      aria-label={pinned ? 'Cosmic Mail Carrier Passport' : undefined}
    >
      {!pinned && (
        <button type="button" className="onboarding__back" onClick={goBack}>
          ← Back
        </button>
      )}
      {!pinned && (
        <>
          <p className="onboarding__eyebrow">Cosmic Mail Carrier Passport</p>
          <h1 id="passport-title" className="onboarding__title">
            Your journey begins, {passport.explorerName}
          </h1>
        </>
      )}
      <div className="passport">
        <div className="passport__header">
          <p className="passport__title">✉ Cosmic Mail Carrier</p>
          <p className="passport__mission">Mission {passport.missionNumber}</p>
        </div>

        <dl className="passport__fields">
          <div className="passport__field">
            <dt>Explorer</dt>
            <dd>{passport.explorerName}</dd>
          </div>
          <div className="passport__field">
            <dt>Spirit</dt>
            <dd>
              {trait.sigil} {trait.name}
            </dd>
          </div>
          <div className="passport__field">
            <dt>Most like</dt>
            <dd>{explorer.name}</dd>
          </div>
          <div className="passport__field">
            <dt>First module</dt>
            <dd>{module.name}</dd>
          </div>
        </dl>

        <p className="passport__slot-label">Mission stamps</p>
        <div className="passport__stamps" aria-label={`${STAMP_SLOTS} stamp slots, all empty for now`}>
          {Array.from({ length: STAMP_SLOTS }, (_, index) => (
            <span key={index} className="passport__stamp" aria-hidden="true" />
          ))}
        </div>

        <p className="passport__slot-label">Mission modules</p>
        <div className="passport__modules" aria-label={`${MODULE_SLOTS} module slots, one unlocked`}>
          <span className="passport__module is-unlocked">{module.name}</span>
          {Array.from({ length: MODULE_SLOTS - 1 }, (_, index) => (
            <span key={index} className="passport__module" aria-hidden="true">
              Locked
            </span>
          ))}
        </div>
      </div>

      {!pinned && (
        <div className="onboarding__actions">
          <button type="button" className="onboarding__cta" onClick={openRoute}>
            Choose your route
          </button>
        </div>
      )}
    </section>
  )
}
