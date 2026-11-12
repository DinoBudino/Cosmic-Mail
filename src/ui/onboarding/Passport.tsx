import { useState } from 'react'
import {
  TRANSMISSION_DESTINATION,
  TRANSMISSION_SUCCESS_LINE,
} from '../../data/onboardingNarrative'
import { STORY_STATUS_LABEL, getPassportView } from '../../data/passport'
import type { MissionId } from '../../data/missions'
import type { JourneySave } from '../../store/journeySchema'
import { emitAudio } from '../../game/audio/audioEvents'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'

/**
 * Physical Cosmic Passport. Every field is projected from JourneySave:
 * carrier identity, three history slots, explicit A stages and real
 * Archive stamps. It never turns a legacy B seal into a delivery.
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
  const transmit = useJourneyStore((state) => state.transmit)
  const openArchive = useGameStore((state) => state.openArchive)
  const goBack = useOnboardingStore((state) => state.goBack)
  const [message, setMessage] = useState<string | null>(null)
  if (!save) return null

  const view = getPassportView(save)

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

  const handleTransmit = (missionId: MissionId) => {
    emitAudio('transmissionStarted')
    const result = transmit(missionId)
    if (!result) {
      emitAudio('uiError')
      setMessage('No active journey save. The transmission was not recorded.')
      return
    }
    if (result.status === 'transmitted') {
      setMessage(TRANSMISSION_SUCCESS_LINE)
      return
    }
    if (result.status === 'already-transmitted') {
      setMessage('This history is already restored in the Archive.')
      return
    }
    emitAudio('uiError')
    setMessage(
      result.status === 'letter-missing'
        ? 'Prepare the smart letter before transmitting it.'
        : 'This mission is not available.',
    )
  }

  return (
    <section
      className={`onboarding__panel onboarding__panel--wide${
        pinned ? ' passport--pinned' : ''
      }`}
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
            Your histories, {view.carrierName}
          </h1>
        </>
      )}

      <div className="passport">
        <div className="passport__header">
          <p className="passport__title">✉ Cosmic Mail Carrier</p>
          <p className="passport__mission">
            {view.transmittedCount}/{view.totalStories} histories
          </p>
        </div>

        <dl className="passport__fields">
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

        <p className="passport__slot-label">Three histories</p>
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
                    onClick={() => handleTransmit(story.missionId)}
                  >
                    Transmit to Earth
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

        {message && (
          <p className="passport__message" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  )
}
