import {
  MEMORY_SLOTS,
  STAMP_SLOTS,
  getExplorer,
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
  const stamps = passport.stamps.map((id) => {
    try {
      return getExplorer(id)
    } catch {
      return null
    }
  })

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
            <dt>Power</dt>
            <dd>
              {trait.sigil} {trait.name}
            </dd>
          </div>
          <div className="passport__field">
            <dt>Hero</dt>
            <dd>
              {explorer.name} · {explorer.gender === 'girl' ? 'woman' : 'man'}
            </dd>
          </div>
          <div className="passport__field">
            <dt>Memories</dt>
            <dd>
              {passport.unlockedExplorerIds.length}/{MEMORY_SLOTS}
            </dd>
          </div>
        </dl>

        <p className="passport__slot-label">Mission stamps</p>
        <div
          className="passport__stamps"
          aria-label={`${stamps.length} of ${STAMP_SLOTS} stamp slots filled`}
        >
          {Array.from({ length: STAMP_SLOTS }, (_, index) => {
            const stamp = stamps[index]
            return (
              <span
                key={index}
                className={`passport__stamp${stamp ? ' is-filled' : ''}`}
                aria-hidden="true"
              >
                {stamp ? getTrait(stamp.trait).sigil : ''}
              </span>
            )
          })}
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
