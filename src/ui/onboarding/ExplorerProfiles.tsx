import { useState } from 'react'
import {
  HISTORICAL_EXPLORERS,
  explorersForTrait,
  getTrait,
  type HistoricalExplorer,
} from '../../data/personalization'
import { useOnboardingStore } from '../../store/onboardingStore'

function ProfileCard({ explorer, onSelect }: { explorer: HistoricalExplorer; onSelect: () => void }) {
  const trait = getTrait(explorer.trait)
  return (
    <button
      type="button"
      className="holo-card"
      style={{ '--accent': explorer.accent } as React.CSSProperties}
      onClick={onSelect}
    >
      <span className="holo-card__glyph" aria-hidden="true">
        {trait.sigil}
      </span>
      <span className="holo-card__name">{explorer.name}</span>
      <span className="holo-card__trait">{trait.name}</span>
      <span className="holo-card__bio">{explorer.bio}</span>
      <span className="holo-card__cta">Choose {explorer.name.split(' ')[0]}</span>
    </button>
  )
}

export function ExplorerProfiles() {
  const traitId = useOnboardingStore((state) => state.trait)
  const confirmExplorer = useOnboardingStore((state) => state.confirmExplorer)
  const goBack = useOnboardingStore((state) => state.goBack)
  const [showOthers, setShowOthers] = useState(false)

  if (!traitId) return null
  const trait = getTrait(traitId)
  const matches = explorersForTrait(traitId)
  const others = HISTORICAL_EXPLORERS.filter((entry) => entry.trait !== traitId)

  return (
    <section className="quest" aria-labelledby="explorer-title">
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      <h1 id="explorer-title" className="sr-only">
        Who will fly with you?
      </h1>

      <div className="tablet tablet--wide is-ready">
        <div className="tablet__header">
          <span>Copilot select</span>
          <span className="tablet__header-trait">
            {trait.sigil} {trait.name}
          </span>
        </div>

        <div className="holo-grid">
          {matches.map((explorer) => (
            <ProfileCard
              key={explorer.id}
              explorer={explorer}
              onSelect={() => confirmExplorer(explorer.id)}
            />
          ))}
        </div>

        {showOthers ? (
          <div className="holo-grid holo-grid--scroll">
            {others.map((explorer) => (
              <ProfileCard
                key={explorer.id}
                explorer={explorer}
                onSelect={() => confirmExplorer(explorer.id)}
              />
            ))}
          </div>
        ) : (
          <div className="tablet__cta">
            <button
              type="button"
              className="menu__option"
              onClick={() => setShowOthers(true)}
            >
              Choose a different spirit
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
