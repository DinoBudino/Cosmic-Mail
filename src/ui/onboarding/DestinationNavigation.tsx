import { DESTINATIONS } from '../../data/destinations'
import {
  STORY_STATUS_LABEL,
  getPassportView,
} from '../../data/passport'
import { getSliceClosure } from '../../data/sliceClosure'
import { NEW_SIGNAL_LINE } from '../../data/onboardingNarrative'
import { useJourneyStore } from '../../store/journeyStore'
import type { JourneySave } from '../../store/journeySchema'
import { useOnboardingStore } from '../../store/onboardingStore'
import { hubElementEnabled, useHubFocus } from '../../store/hubFocus'

/**
 * Keyboard / screen-reader mirror of the cabin navigation screen: every
 * destination with its facts; places without a playable world yet are
 * visible but marked as missions in development.
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
  const focus = useHubFocus()
  const view = getPassportView(save)
  const closure = getSliceClosure(save)
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

        {closure.label && (
          <p className="destination-summary__ready" role="status">
            {closure.label}.{' '}
            {closure.newSignal ? NEW_SIGNAL_LINE : ''}
          </p>
        )}

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
                disabled={!destination.available || !hubElementEnabled(focus, 'nav-cards')}
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
                  {destination.kind}. {destination.clue}
                </span>
                <span className="destination-row__clue">
                  Terrain: {destination.terrain}
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
            <p className="destination-summary__clue">
              Terrain: {selected.terrain}
            </p>
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
                disabled={routeConfirmed || !hubElementEnabled(focus, 'nav-confirm')}
              >
                {routeConfirmed ? 'Route ready' : 'Confirm route'}
              </button>
              <button
                type="button"
                className="onboarding__quiet"
                disabled={!hubElementEnabled(focus, 'nav-back')}
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
