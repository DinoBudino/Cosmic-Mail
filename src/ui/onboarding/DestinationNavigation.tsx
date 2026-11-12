import { DESTINATIONS } from '../../data/destinations'
import {
  STORY_STATUS_LABEL,
  getPassportView,
} from '../../data/passport'
import { useJourneyStore } from '../../store/journeyStore'
import type { JourneySave } from '../../store/journeySchema'
import { useOnboardingStore } from '../../store/onboardingStore'

/**
 * Keyboard / screen-reader mirror of the cabin navigation screen. Mars is
 * the only playable destination; Moon and Deep Space are visible but
 * marked as missions in development.
 */
export function DestinationNavigation({
  saveOverride,
}: {
  /** Testing/embedding hook; production always reads the journey store. */
  saveOverride?: JourneySave | null
} = {}) {
  const storedSave = useJourneyStore((state) => state.save)
  const save = saveOverride !== undefined ? saveOverride : storedSave
  const selectedId = useOnboardingStore((state) => state.selectedDestination)
  const selectDestination = useOnboardingStore(
    (state) => state.selectDestination,
  )
  const confirmRoute = useOnboardingStore((state) => state.confirmRoute)
  const clearSelection = useOnboardingStore((state) => state.clearSelection)
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)
  const view = getPassportView(save)
  const selected = DESTINATIONS.find((entry) => entry.id === selectedId) ?? null
  const selectedStory = selected
    ? (view.stories.find(
        (story) => story.destination.id === selected.id,
      ) ?? null)
    : null

  return (
    <section className="quest" aria-labelledby="destination-title">
      <h1 id="destination-title" className="sr-only">
        Choose your destination
      </h1>

      <div className="tablet tablet--wide is-ready">
        <div className="tablet__header">
          <span>Navigation</span>
          <span className="tablet__header-status">
            {selected
              ? `${selected.glyph} ${selected.name}`
              : 'Pick a destination'}
          </span>
        </div>

        <div className="choice-list">
          {DESTINATIONS.map((destination) => {
            const story = view.stories.find(
              (entry) => entry.destination.id === destination.id,
            )
            return (
              <button
                key={destination.id}
                type="button"
                className={`choice-option destination-row${
                  destination.available ? '' : ' is-coming-soon'
                }`}
                disabled={!destination.available}
                aria-pressed={selectedId === destination.id}
                aria-label={`${destination.name}: ${
                  destination.available
                    ? story?.machineName ?? 'signal awaiting identification'
                    : 'mission in development'
                }`}
                onClick={() => selectDestination(destination.id)}
              >
                <span className="choice-option__title">
                  {destination.glyph} {destination.name}
                </span>
                <span className="destination-row__clue">
                  {destination.clue}
                </span>
                <span className="choice-option__hint">
                  {destination.available
                    ? story?.machineName ?? 'Signal awaiting identification'
                    : 'Mission in development'}
                </span>
              </button>
            )
          })}
        </div>

        {selected && selectedStory && (
          <div className="destination-summary" role="status">
            <p className="zone-objects__label">Destination clue</p>
            <p className="destination-summary__clue">{selected.clue}</p>
            <p className="destination-summary__machine">
              {selectedStory.machineName ?? 'Signal unidentified'}
            </p>
            <p className="destination-summary__meta">
              {STORY_STATUS_LABEL[selectedStory.status]}
              {selectedStory.stampEarned
                ? ` · ✦ ${selectedStory.stampLabel}`
                : ''}
            </p>
            <div className="tablet__cta">
              <button
                type="button"
                className="menu__option"
                onClick={confirmRoute}
                disabled={routeConfirmed}
              >
                {routeConfirmed ? 'Route ready' : 'Confirm route'}
              </button>
              <button
                type="button"
                className="onboarding__quiet"
                onClick={clearSelection}
              >
                Choose another destination
              </button>
            </div>
          </div>
        )}

        {routeConfirmed && (
          <p className="destination-summary__ready" role="status">
            Route ready! Press the red button when you&apos;re set!
          </p>
        )}
      </div>
    </section>
  )
}
