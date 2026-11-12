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
 * Postal registration: a physical shipping label, the carrier's name and
 * the seal. The name is persisted only through JourneySave.
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

      <div className="shipping-label-stage">
        <form
          className={`shipping-label is-arriving${sealed ? ' is-sealed' : ''}${
            stage === 'departing' ? ' is-departing' : ''
          }`}
          onSubmit={(event) => {
            event.preventDefault()
            sealAndContinue()
          }}
        >
          <div className="shipping-label__header">
            <span>Cosmic Mail</span>
            <span className="shipping-label__stamp" aria-hidden="true">
              ✦
            </span>
          </div>

          <div
            className={`shipping-label__field shipping-label__signature${
              valid ? ' is-valid' : ''
            }`}
          >
            <label htmlFor="carrier-name">From</label>
            <input
              ref={inputRef}
              id="carrier-name"
              className="shipping-label__input"
              type="text"
              value={name}
              maxLength={MAX_PLAYER_NAME_LENGTH}
              autoComplete="off"
              spellCheck={false}
              placeholder="Your name..."
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
            <span className="shipping-label__ink" aria-hidden="true" />
          </div>

          <div className="shipping-label__field">
            <span className="shipping-label__static-label">Service</span>
            <span className="shipping-label__static-value">Cosmic Mail</span>
          </div>

          <div className="shipping-label__field">
            <span className="shipping-label__static-label">Destination</span>
            <span className="shipping-label__static-value">Earth Archive</span>
          </div>

          <div className="shipping-label__field">
            <span className="shipping-label__static-label">Assignment</span>
            <span className="shipping-label__static-value">
              Cosmic Archive Memory Recovery
            </span>
          </div>

          <div className="shipping-label__field shipping-label__field--row">
            <span className="shipping-label__static-value shipping-label__fragile">
              Fragile: memories that must find their way home
            </span>
            <span className="shipping-label__barcode" aria-hidden="true" />
          </div>

          <div className="shipping-label__postmark" aria-hidden="true">
            <span className="shipping-label__postmark-envelope">✉</span>
            <span className="shipping-label__postmark-text">COSMIC MAIL</span>
            <span className="shipping-label__postmark-star">✦</span>
          </div>

          <p className="shipping-label__ink-mark" aria-hidden="true" />

          <p
            id="signature-hint"
            className="shipping-label__hint"
            aria-live="polite"
          >
            {!valid && name.length > 0
              ? 'At least two letters, carrier.'
              : ''}
          </p>

          {error && (
            <p className="shipping-label__hint" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="menu__option shipping-label__cta"
            disabled={!valid || sealed}
          >
            {sealed ? 'Sealed!' : 'Seal & Continue'}
          </button>
        </form>

        {(stage === 'farewell' || stage === 'departing') && (
          <p className="shipping-label__welcome" role="status">
            {registrationWelcomeLine(normalizedName)}
          </p>
        )}
      </div>
    </section>
  )
}
