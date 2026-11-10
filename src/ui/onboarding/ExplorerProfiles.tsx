import { useEffect, useState } from 'react'
import {
  HISTORICAL_EXPLORERS,
  getExplorer,
  getHeroForTrait,
  getTrait,
  type TraitId,
} from '../../data/personalization'
import { getTraitAbility } from '../../data/traitAbilities'
import { useOnboardingStore } from '../../store/onboardingStore'

/**
 * Explorer phase — the hero is revealed INSIDE the Cosmic Memory
 * Window (see MenuScene MemoryWindowHolograms): portrait, name,
 * power and bio compose one holographic card behind PIP. Only the
 * action dock lives in the DOM, in a safe band above the console.
 *
 * The recommended hero is the initial view; browsing other heroes
 * only changes the ephemeral preview. Nothing is persisted until the
 * child confirms, and confirming a hero also commits its power/trait
 * (existing store rule).
 */
export function ExplorerProfiles() {
  const traitId = useOnboardingStore((state) => state.trait)
  const explorerId = useOnboardingStore((state) => state.explorerId)
  const confirmExplorer = useOnboardingStore((state) => state.confirmExplorer)
  const goBack = useOnboardingStore((state) => state.goBack)
  const previewId = useOnboardingStore((state) => state.explorerPreviewId)
  const setExplorerPreview = useOnboardingStore((state) => state.setExplorerPreview)
  const setDialogueIndex = useOnboardingStore((state) => state.setDialogueIndex)
  const [exploring, setExploring] = useState(false)

  const recommended =
    (explorerId ? HISTORICAL_EXPLORERS.find((entry) => entry.id === explorerId) : undefined) ??
    (traitId ? getHeroForTrait(traitId as TraitId) : HISTORICAL_EXPLORERS[0]!)

  // While browsing, the hologram shows the previewed hero.
  const shownId = previewId ?? recommended.id
  const shown = (() => {
    try {
      return getExplorer(shownId)
    } catch {
      return recommended
    }
  })()
  const shownTrait = getTrait(shown.trait)
  const ability = getTraitAbility(shown.trait)
  const selected = exploring ? shown : recommended
  const firstName = selected.name.split(' ')[0]

  // Keep the 3D projection in sync with the browsed hero. Leaving the
  // phase clears the preview so nothing lingers.
  useEffect(() => {
    setExplorerPreview(shown.id)
    // Restart the two-part narration from the history line whenever
    // the visible hero changes, so text and voice stay in sync.
    setDialogueIndex(0)
  }, [shown.id, setExplorerPreview, setDialogueIndex])
  useEffect(
    () => () => {
      setExplorerPreview(null)
    },
    [setExplorerPreview],
  )

  const index = HISTORICAL_EXPLORERS.findIndex((entry) => entry.id === shown.id)
  const step = (direction: 1 | -1) => {
    const count = HISTORICAL_EXPLORERS.length
    const next = HISTORICAL_EXPLORERS[(index + direction + count) % count]
    if (next) setExplorerPreview(next.id)
  }

  const startExploring = () => {
    setExploring(true)
    setExplorerPreview(shown.id)
  }

  const backToRecommendation = () => {
    setExploring(false)
    setExplorerPreview(recommended.id)
  }

  return (
    <section className="quest explorer" aria-labelledby="explorer-title">
      <button type="button" className="identity__back" onClick={goBack}>
        ← Back
      </button>

      <h1 id="explorer-title" className="sr-only">
        {exploring ? `Other historical explorers — ${shown.name}` : `Your historical explorer — ${recommended.name}`}
      </h1>

      {/* The hero card is projected in 3D inside the window; this is
          its accessible transcript. */}
      <p className="sr-only">
        {shown.name}, {shownTrait.name}. Power: {ability.name}. {ability.description}{' '}
        {shown.bio} “{shown.memoryLine}”
      </p>

      <div className="explorer__dock">
        {exploring ? (
          <>
            <div className="explorer__carousel-row">
              <button
                type="button"
                className="explorer__step"
                onClick={() => step(-1)}
                aria-label="Previous hero"
              >
                ‹
              </button>
              <button
                type="button"
                className="reveal__primary explorer__choose"
                onClick={() => confirmExplorer(shown.id)}
              >
                Choose {firstName}
              </button>
              <button
                type="button"
                className="explorer__step"
                onClick={() => step(1)}
                aria-label="Next hero"
              >
                ›
              </button>
            </div>
            <div className="explorer__links">
              <span className="explorer__count" aria-hidden="true">
                {String(index + 1).padStart(2, '0')} / {String(HISTORICAL_EXPLORERS.length).padStart(2, '0')}
              </span>
              <button type="button" className="reveal__secondary" onClick={backToRecommendation}>
                Back to recommendation
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="reveal__primary"
              onClick={() => confirmExplorer(recommended.id)}
            >
              Keep {recommended.name.split(' ')[0]}
            </button>
            <button type="button" className="reveal__secondary" onClick={startExploring}>
              Explore other heroes
            </button>
            <p className="explorer__note">
              Another hero means another power. Nothing changes until you choose.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
