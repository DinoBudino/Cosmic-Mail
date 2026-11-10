import {
  HISTORICAL_EXPLORERS,
  MEMORY_SLOTS,
  getTrait,
} from '../../data/personalization'
import { useOnboardingStore } from '../../store/onboardingStore'

/**
 * PIP's hero archive, shown inside the passport detail in the hub.
 * Recovered heroes are full cards the child can switch to (switching
 * swaps power too); locked ones are silhouettes hinting at the Mars
 * site where their memory fragment was lost.
 */
export function MemoryArchive() {
  const passport = useOnboardingStore((state) => state.passport)
  const switchHero = useOnboardingStore((state) => state.switchHero)

  if (!passport) return null
  const unlocked = new Set(passport.unlockedExplorerIds)

  return (
    <section className="memory-archive" aria-label="Hero memory archive">
      <p className="passport__slot-label">
        Hero memories · {unlocked.size}/{MEMORY_SLOTS}
      </p>
      <div className="memory-archive__grid">
        {HISTORICAL_EXPLORERS.map((hero) => {
          const isUnlocked = unlocked.has(hero.id)
          const isActive = passport.explorerId === hero.id
          const trait = getTrait(hero.trait)
          return (
            <button
              key={hero.id}
              type="button"
              className={`memory-card${isUnlocked ? '' : ' is-locked'}${isActive ? ' is-active' : ''}`}
              style={{ '--accent': hero.accent } as React.CSSProperties}
              disabled={!isUnlocked || isActive}
              onClick={() => switchHero(hero.id)}
              aria-label={
                isUnlocked
                  ? isActive
                    ? `${hero.name}, ${trait.name}, active hero`
                    : `Switch to ${hero.name}, ${trait.name} power`
                  : `${hero.name}'s memory is lost — recover it from a Mars site`
              }
            >
              <span className="memory-card__glyph" aria-hidden="true">
                {isUnlocked ? trait.sigil : '❓'}
              </span>
              <span className="memory-card__name">{isUnlocked ? hero.name : 'Lost memory'}</span>
              <span className="memory-card__trait">
                {isUnlocked
                  ? `${trait.name} · ${hero.gender === 'girl' ? 'woman' : 'man'}`
                  : 'A fragment sleeps on Mars…'}
              </span>
              <span className="memory-card__bio">
                {isUnlocked
                  ? isActive
                    ? 'Active hero'
                    : hero.memoryLine
                  : 'Find the silent machine and recover its fragment.'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
