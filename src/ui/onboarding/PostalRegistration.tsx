import { useEffect, useRef, useState } from 'react'
import { registrationWelcomeLine } from '../../data/onboardingNarrative'
import { emitAudio } from '../../game/audio/audioEvents'
import {
  MAX_PLAYER_NAME_LENGTH,
  isValidPlayerName,
  sanitizePlayerName,
} from '../../store/journeySchema'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'

type SignStage = 'signing' | 'sealing' | 'farewell' | 'departing'

/**
 * Carrier registration: a holographic terminal on the cabin console that
 * builds the child's Carrier ID (the badge kept in the mission album)
 * from their name. The name is persisted only through JourneySave.
 */
export function PostalRegistration() {
  const goBack = useOnboardingStore((state) => state.goBack)
  const completeRegistration = useOnboardingStore(
    (state) => state.completeRegistration,
  )
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [name, setName] = useState('')
  const [stage, setStage] = useState<SignStage>('signing')
  const [error, setError] = useState<string | null>(null)
  const sealed = stage !== 'signing'
  const valid = isValidPlayerName(name)
  const normalizedName = sanitizePlayerName(name)
  const inputRef = useRef<HTMLInputElement>(null)
  const timersRef = useRef<number[]>([])
  const signatureSoundPlayed = useRef(false)

  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 850)
    return () => window.clearTimeout(timer)
  }, [reducedMotion])

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
    },
    [],
  )

  const completeSigning = () => {
    const started = useJourneyStore.getState().startJourney(normalizedName)
    if (!started) {
      setError('The Cosmic Mail archive could not create this journey.')
      setStage('signing')
      return
    }
    useJourneyStore.getState().completeOnboarding()
    completeRegistration()
  }

  const sealAndContinue = () => {
    if (!valid || stage !== 'signing') return
    setError(null)
    emitAudio('postalSealed')
    if (reducedMotion) {
      completeSigning()
      return
    }
    setStage('sealing')
    timersRef.current.push(
      window.setTimeout(() => setStage('farewell'), 780),
      window.setTimeout(() => setStage('departing'), 1700),
      window.setTimeout(completeSigning, 2320),
    )
  }

  return (
    <section
      className={`boarding name-phase is-${stage}`}
      aria-labelledby="registration-title"
    >
      <div className="cabin-controls">
        <button
          type="button"
          className="identity__back identity__back--static"
          onClick={goBack}
          disabled={sealed}
        >
          ← Back
        </button>
        <button
          type="button"
          className="identity__back identity__back--static"
          onClick={() => useGameStore.getState().openSettings()}
        >
          Settings
        </button>
      </div>

      <h1 id="registration-title" className="sr-only">
        Register as a Cosmic Mail Carrier
      </h1>

      <div className="carrier-stage">
        <form
          className={`carrier-terminal is-arriving${sealed ? ' is-sealed' : ''}${
            stage === 'departing' ? ' is-departing' : ''
          }`}
          onSubmit={(event) => {
            event.preventDefault()
            sealAndContinue()
          }}
        >
          <span className="carrier-terminal__corner carrier-terminal__corner--tl" aria-hidden="true" />
          <span className="carrier-terminal__corner carrier-terminal__corner--tr" aria-hidden="true" />
          <span className="carrier-terminal__corner carrier-terminal__corner--bl" aria-hidden="true" />
          <span className="carrier-terminal__corner carrier-terminal__corner--br" aria-hidden="true" />

          <header className="carrier-terminal__header">
            <span className="carrier-terminal__led" aria-hidden="true" />
            <span>Cosmic Mail · Carrier ID</span>
            <span className="carrier-terminal__status">
              {stage === 'signing'
                ? valid
                  ? 'Ready'
                  : 'Waiting for name'
                : stage === 'sealing'
                  ? 'Scanning'
                  : 'ID active'}
            </span>
          </header>

          {/* Live preview of the badge the album will keep. */}
          <div
            className={`carrier-card${valid ? ' is-valid' : ''}`}
            aria-hidden="true"
          >
            <div className="carrier-card__photo">
              <span className="carrier-card__planet" />
              <span className="carrier-card__ring" />
            </div>
            <div className="carrier-card__info">
              <span className="carrier-card__label">Carrier</span>
              <span className="carrier-card__name">
                {normalizedName || 'Your name'}
              </span>
              <span className="carrier-card__label">Ship</span>
              <span className="carrier-card__value">Mailwing · CM-01</span>
            </div>
            <span className="carrier-card__check">
              {stage === 'farewell' || stage === 'departing' ? '✓' : ''}
            </span>
            <span className="carrier-card__scan" />
          </div>

          <div
            className={`carrier-terminal__field${valid ? ' is-valid' : ''}`}
          >
            <label htmlFor="carrier-name">
              <span className="carrier-terminal__step">1</span>
              Type your name
            </label>
            <input
              ref={inputRef}
              id="carrier-name"
              className="carrier-terminal__input"
              type="text"
              value={name}
              maxLength={MAX_PLAYER_NAME_LENGTH}
              autoComplete="off"
              spellCheck={false}
              placeholder="Your name"
              onChange={(event) => {
                if (!signatureSoundPlayed.current && event.target.value.length > 0) {
                  signatureSoundPlayed.current = true
                  emitAudio('postalSignature')
                }
                setName(event.target.value)
              }}
              disabled={sealed}
              aria-describedby="signature-hint"
              aria-invalid={name.length > 0 && !valid}
            />
          </div>

          <ul className="carrier-terminal__facts">
            <li>
              <span>Job</span>
              Bring explorer stories home
            </li>
            <li>
              <span>Saved in</span>
              Your mission album
            </li>
          </ul>

          <p
            id="signature-hint"
            className="carrier-terminal__hint"
            aria-live="polite"
          >
            {!valid && name.length > 0
              ? 'Use at least two letters.'
              : ''}
          </p>

          {error && (
            <p className="carrier-terminal__hint" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="carrier-terminal__cta"
            disabled={!valid || sealed}
          >
            <span className="carrier-terminal__step">2</span>
            {sealed ? 'Carrier ID created' : 'Create my Carrier ID'}
          </button>
        </form>

        {(stage === 'farewell' || stage === 'departing') && (
          <p className="carrier-stage__welcome" role="status">
            {registrationWelcomeLine(normalizedName)}
          </p>
        )}
      </div>
    </section>
  )
}
