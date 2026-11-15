import { useState } from 'react'
import { TRANSMISSION_DESTINATION } from '../../data/onboardingNarrative'
import { getFieldNotesView } from '../../data/fieldNotes'
import { STORY_STATUS_LABEL, getPassportView } from '../../data/passport'
import type { MissionId } from '../../data/missions'
import type { JourneySave } from '../../store/journeySchema'
import { emitAudio } from '../../game/audio/audioEvents'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore, type AlbumTab } from '../../store/onboardingStore'
import { hubElementEnabled, useHubFocus } from '../../store/hubFocus'

const ALBUM_TABS: readonly { id: AlbumTab; label: string }[] = [
  { id: 'missions', label: 'Record' },
  { id: 'stamps', label: 'Stamps' },
  { id: 'discoveries', label: 'Discoveries' },
]

/**
 * Álbum de misiones (formerly the Cosmic Passport; store and save keys
 * keep the historical "passport" names). An open book projected from
 * JourneySave: the carrier record on the left page and, on the right,
 * three tabs — mission record, Archive stamps and field-note
 * discoveries. It never turns a legacy B seal into a delivery.
 */
export function Passport({
  pinned = false,
  saveOverride,
}: {
  pinned?: boolean
  /** Testing/embedding hook; production always reads the journey store. */
  saveOverride?: JourneySave | null
}) {
  const storedSave = useJourneyStore((state) => state.save)
  const save = saveOverride !== undefined ? saveOverride : storedSave
  const prepareSmartLetter = useJourneyStore(
    (state) => state.prepareSmartLetter,
  )
  const openArchive = useGameStore((state) => state.openArchive)
  const goBack = useOnboardingStore((state) => state.goBack)
  const [message, setMessage] = useState<string | null>(null)
  const tab = useOnboardingStore((state) => state.albumTab)
  const setTab = useOnboardingStore((state) => state.setAlbumTab)
  const focus = useHubFocus()
  const tourClass = (target: string) =>
    focus.tourActive && focus.target === target ? ' is-tour-target' : ''
  if (!save) return null

  const view = getPassportView(save)
  const fieldNotes = getFieldNotesView(save)

  const handlePrepare = (missionId: MissionId) => {
    const result = prepareSmartLetter(missionId)
    const ok =
      result?.status === 'created' || result?.status === 'already-created'
    emitAudio(ok ? 'smartLetterPrepared' : 'archiveQueryFailed')
    setMessage(
      ok
        ? null
        : 'The memory must be recovered before the smart letter can be prepared.',
    )
  }

  return (
    <section
      className={`onboarding__panel onboarding__panel--wide${
        pinned ? ' passport--pinned' : ''
      }`}
      aria-labelledby={pinned ? undefined : 'passport-title'}
      aria-label={pinned ? 'Mission Album' : undefined}
    >
      {!pinned && (
        <button type="button" className="onboarding__back" onClick={goBack}>
          ← Back
        </button>
      )}
      {!pinned && (
        <>
          <p className="onboarding__eyebrow">Mission Album</p>
          <h1 id="passport-title" className="onboarding__title">
            Your histories, {view.carrierName}
          </h1>
        </>
      )}

      <div className="passport album">
        <div className="album__spread">
          <div className={`album__page album__page--record${tourClass('album-id')}`}>
            <div className="album__emblem" aria-hidden="true">
              <span className="album__planet" />
              <span className="album__ring" />
            </div>
            <p className="passport__title album__name">Mission Album</p>
            <p className="passport__mission">
              {view.transmittedCount}/{view.totalStories} histories
            </p>
            <dl className="passport__fields album__fields">
              <div className="passport__field">
                <dt>Carrier</dt>
                <dd>{view.carrierName}</dd>
              </div>
              <div className="passport__field">
                <dt>ID</dt>
                <dd>{view.carrierId}</dd>
              </div>
              <div className="passport__field">
                <dt>Service</dt>
                <dd>Cosmic Mail · {TRANSMISSION_DESTINATION}</dd>
              </div>
              <div className="passport__field">
                <dt>Histories restored</dt>
                <dd>
                  {view.transmittedCount}/{view.totalStories} delivered to Earth
                </dd>
              </div>
            </dl>
            <p className="album__ship">Cabin CM-01 Explorer</p>
          </div>

          <div className="album__page album__page--content">
            <div className="album__tabs" role="tablist" aria-label="Album sections">
              {ALBUM_TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  id={`album-tab-${entry.id}`}
                  aria-selected={tab === entry.id}
                  aria-controls={`album-panel-${entry.id}`}
                  className={`album__tab album__tab--${entry.id}${
                    tab === entry.id ? ' is-active' : ''
                  }${tourClass(`tab-${entry.id}`)}`}
                  disabled={!hubElementEnabled(focus, `tab-${entry.id}`)}
                  onClick={() => {
                    emitAudio('uiHover', { dedupeKey: 'album-tab', dedupeMs: 120 })
                    setTab(entry.id)
                  }}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`album-panel-${tab}`}
              aria-labelledby={`album-tab-${tab}`}
              className="album__panel"
            >
              {tab === 'missions' && (
                <>
                  <p className="passport__slot-label">Explorer histories</p>
                  <div className="passport__stories">
                    {view.stories.map((story) => {
                      const statusLine =
                        story.status === 'unknown'
                          ? 'No signal identified yet. Follow the navigation screen.'
                          : story.status === 'discovered'
                            ? 'Explorer identified. Inspect its parts with the Cosmic Scanner.'
                            : story.status === 'investigating' ||
                                story.status === 'ready_for_full_scan'
                              ? `Fragments recognized ${story.scanned}/${story.total}.`
                              : story.status === 'memory_recovered'
                                ? 'Memory recovered. Prepare the smart letter.'
                                : story.status === 'smart_letter_ready'
                                  ? 'Smart letter ready to transmit from Mailwing.'
                                  : 'Delivered to Earth.'
                      return (
                      <article
                        key={story.destination.id}
                        className={`passport__story passport__story--${story.status}`}
                        aria-label={`${story.destination.name}: ${STORY_STATUS_LABEL[story.status]}`}
                      >
                        <div className="passport__story-head">
                          <span className="passport__story-glyph" aria-hidden="true">
                            {story.destination.glyph}
                          </span>
                          <div>
                            <h3>{story.destination.name}</h3>
                            <p className="passport__story-clue">
                              {story.destination.clue}
                            </p>
                          </div>
                          <span className="passport__story-state">
                            {STORY_STATUS_LABEL[story.status]}
                          </span>
                        </div>

                        <p className="passport__story-machine">
                          {story.machineName ?? 'Explorer not yet identified'}
                        </p>

                        <p className="passport__story-hint">{statusLine}</p>

                        {story.legacySealAt != null && !story.stampEarned && (
                          <p className="passport__story-legacy">
                            Legacy seal found in an older save. It is preserved as
                            history, but it is not a transmission to the Earth Cosmic
                            Archive.
                          </p>
                        )}

                        <div className="passport__story-actions">
                          {story.status === 'memory_recovered' && (
                            <button
                              type="button"
                              className="passport__action passport__action--primary"
                              onClick={() => handlePrepare(story.missionId)}
                            >
                              Prepare smart letter
                            </button>
                          )}
                          {story.hasSmartLetter && (
                            <button
                              type="button"
                              className="passport__action"
                              onClick={() => openArchive('smart-letter', story.missionId)}
                            >
                              {story.stampEarned
                                ? 'Review smart letter'
                                : 'Read smart letter'}
                            </button>
                          )}
                          {story.canTransmit && (
                            <button
                              type="button"
                              className="passport__action passport__action--primary"
                              onClick={() => openArchive('smart-letter', story.missionId)}
                            >
                              Deliver to Earth
                            </button>
                          )}
                        </div>

                        <div className="passport__story-foot">
                          <span>
                            {story.scanned}/{story.total} fragments
                          </span>
                          <span
                            className={`passport__story-stamp${
                              story.stampEarned ? ' is-filled' : ''
                            }`}
                          >
                            {story.stampEarned
                              ? `✦ ${story.stampLabel}`
                              : !story.destination.available
                                ? 'Mission in development'
                                : story.status === 'unknown'
                                  ? 'Search pending'
                                  : story.status === 'discovered'
                                    ? 'Explorer identified'
                                    : story.status === 'investigating'
                                      ? 'Recognition in progress'
                                      : story.status === 'ready_for_full_scan'
                                        ? 'Full scan ready'
                                        : story.status === 'memory_recovered'
                                          ? 'Memory recovered'
                                          : 'Awaiting delivery'}
                          </span>
                        </div>
                      </article>
                      )
                    })}
                  </div>
                </>
              )}

              {tab === 'stamps' && (
                <>
                  <p className="passport__slot-label">Archive stamps</p>
                  <ul className="album__stamps">
                    {view.stories.map((story) => (
                      <li
                        key={story.destination.id}
                        className={`album__stamp${story.stampEarned ? ' is-filled' : ''}`}
                      >
                        <span className="album__stamp-glyph" aria-hidden="true">
                          {story.stampEarned ? story.destination.glyph : '?'}
                        </span>
                        <span className="album__stamp-name">{story.destination.name}</span>
                        <span className="album__stamp-label">
                          {story.stampEarned ? story.stampLabel : 'Not yet stamped'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="passport__notes-intro">
                    A stamp is added each time a history is delivered to Earth.
                  </p>
                </>
              )}

              {tab === 'discoveries' && (
                <section
                  className="passport__notes"
                  aria-labelledby="passport-notes-title"
                >
                  <p id="passport-notes-title" className="passport__slot-label">
                    Mars field notes · {fieldNotes.unlockedCount}/{fieldNotes.totalCount}
                  </p>
                  <p className="passport__notes-intro">
                    Optional context from the landscape and the memorials. These notes
                    are not part of any smart letter.
                  </p>
                  <ul className="passport__notes-list">
                    {fieldNotes.entries.map(({ note, unlocked, detail }) => (
                      <li
                        key={note.id}
                        className={`passport__note${unlocked ? ' is-unlocked' : ''}`}
                      >
                        <h3>{unlocked ? note.title : 'Not yet observed'}</h3>
                        {unlocked ? (
                          <>
                            <p>{note.body}</p>
                            <p className="passport__note-meta">
                              {detail ? `${detail} · ` : ''}
                              {note.sources.map((source, index) => (
                                <a
                                  key={source.url}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {source.label}
                                  {index < note.sources.length - 1 ? ', ' : ''} ↗
                                </a>
                              ))}
                            </p>
                          </>
                        ) : (
                          <p className="passport__note-meta">
                            {note.kind === 'memorial'
                              ? 'Visit this Mars memorial to add its note.'
                              : `Scan a feature of this kind with the Cosmic Scanner.${
                                  detail ? ` ${detail}.` : ''
                                }`}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>

        {message && (
          <p className="passport__message" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  )
}
