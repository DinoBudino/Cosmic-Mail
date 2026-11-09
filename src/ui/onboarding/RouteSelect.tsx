import { ZONES } from '../../data/zones'
import { isNavigationUnlocked, useOnboardingStore } from '../../store/onboardingStore'

/**
 * Route charting, inside the cabin tablet: PIP sends the pilot to tap
 * the panel, the tablet turns into a navigation screen with the three
 * destinations. Mars is playable; the others are coming soon. Picking
 * a zone previews its objects, then "Take off" starts the adventure.
 */
export function RouteSelect() {
  // Same lock as the 3D panel: until PIP says "tap the radar screen"
  // (dialogue index 2) the destinations cannot be picked, not even
  // via this keyboard mirror.
  const unlocked = useOnboardingStore((state) => isNavigationUnlocked(state))
  const selectedZoneId = useOnboardingStore((state) => state.selectedZoneId)
  const selectZone = useOnboardingStore((state) => state.selectZone)
  const takeOff = useOnboardingStore((state) => state.takeOff)

  const selected = ZONES.find((zone) => zone.id === selectedZoneId)

  return (
    <section className="quest" aria-labelledby="route-title">
      <h1 id="route-title" className="sr-only">
        Choose your route
      </h1>

      <div className="tablet tablet--wide is-ready">
        <div className="tablet__header">
          <span>Navigation</span>
          <span className="tablet__header-trait">
            {selected ? `${selected.glyph} ${selected.name}` : 'Pick a destination'}
          </span>
        </div>

        <div className="choice-list">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              type="button"
              className={`choice-option zone-row${zone.enabled ? '' : ' zone-row--soon'}`}
              disabled={!zone.enabled || !unlocked}
              aria-pressed={selectedZoneId === zone.id}
              onClick={(event) => {
                event.stopPropagation()
                selectZone(zone.id)
              }}
            >
              <span className="choice-option__title">
                {zone.glyph} {zone.name}
              </span>
              <span className="choice-option__hint">
                {zone.enabled ? `${zone.objects.length} objects` : 'Coming soon'}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="zone-objects">
            <p className="zone-objects__label">Objects on this route</p>
            <div className="zone-objects__grid">
              {selected.objects.map((object) => (
                <span key={object} className="zone-objects__slot">
                  {object}
                </span>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="tablet__cta">
            <button type="button" className="menu__option" onClick={takeOff}>
              Take off
            </button>
          </div>
        )}

      </div>
    </section>
  )
}
