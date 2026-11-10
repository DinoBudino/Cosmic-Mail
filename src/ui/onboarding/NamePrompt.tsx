import { useEffect, useRef, useState } from 'react'
import {
  MAX_NAME_LENGTH,
  getExplorer,
  getTrait,
  isValidExplorerName,
  sanitizeExplorerName,
} from '../../data/personalization'
import { useGameStore } from '../../store/gameStore'
import { useOnboardingStore } from '../../store/onboardingStore'

/**
 * Final signing step: the explorer signs the name onto the postal
 * shipping label (already filled with power + hero). Confirming runs
 * a short ceremony — stamp press, PIP's welcome, then the label folds
 * and glides toward the passport support — before the passport is
 * persisted once and the hub opens.
 *
 * The label appears only after PIP's line and unfolds into place
 * (see the CSS `name-arrive` keyframes).
 */
type SignStage = 'signing' | 'sealing' | 'farewell' | 'departing'

export function NamePrompt() {
  const submitName = useOnboardingStore((state) => state.submitName)
  const goBack = useOnboardingStore((state) => state.goBack)
  const signing = useOnboardingStore((state) => state.signing)
  const traitId = useOnboardingStore((state) => state.trait)
  const explorerId = useOnboardingStore((state) => state.explorerId)
  const setPipTalking = useOnboardingStore((state) => state.setPipTalking)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [name, setName] = useState('')
  const [stage, setStage] = useState<SignStage>('signing')
  const sealed = stage !== 'signing'
  const valid = isValidExplorerName(name)
  const normalizedName = sanitizeExplorerName(name)
  const inputRef = useRef<HTMLInputElement>(null)
  const timersRef = useRef<number[]>([])

  // Focus the signature once the unfold animation has settled, and
  // never leave timers running after unmount.
  useEffect(() => {
    if (!signing) return
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), reducedMotion ? 0 : 1050)
    return () => window.clearTimeout(focusTimer)
  }, [signing, reducedMotion])

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
      setPipTalking(false)
    },
    [setPipTalking],
  )

  const trait = traitId ? getTrait(traitId) : null
  const explorer = explorerId ? getExplorer(explorerId) : null

  // Before PIP's invitation is accepted, only the Back action exists.
  if (!signing) {
    return (
      <section className="boarding" aria-labelledby="name-title" style={{ minHeight: 0, padding: 0 }}>
        <button type="button" className="identity__back" onClick={goBack}>
          ← Back
        </button>
        <h1 id="name-title" className="sr-only">
          Sign your name on the label
        </h1>
      </section>
    )
  }

  const sealAndContinue = () => {
    if (!valid || stage !== 'signing') return
    if (reducedMotion) {
      submitName(normalizedName)
      return
    }
    // Ceremony: stamp press → PIP welcomes the carrier → label
    // folds and glides to the passport support → passport saved once.
    setStage('sealing')
    timersRef.current.push(
      window.setTimeout(() => {
        setStage('farewell')
        setPipTalking(true)
      }, 780),
      window.setTimeout(() => setPipTalking(false), 1720),
      window.setTimeout(() => setStage('departing'), 1700),
      window.setTimeout(() => submitName(normalizedName), 2320),
    )
  }

  return (
    <section className={`boarding name-phase is-${stage}`} aria-labelledby="name-title">
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

      <h1 id="name-title" className="sr-only">
        Sign your name on the label
      </h1>

      <div className="shipping-label-stage">
        <form
          className={`shipping-label is-arriving${sealed ? ' is-sealed' : ''}${stage === 'departing' ? ' is-departing' : ''}`}
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

          <div className={`shipping-label__field shipping-label__signature${valid ? ' is-valid' : ''}`}>
            <label htmlFor="explorer-name">From</label>
            <input
              ref={inputRef}
              id="explorer-name"
              className="shipping-label__input"
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              spellCheck={false}
              placeholder="Your name..."
              onChange={(event) => setName(event.target.value)}
              disabled={sealed}
              aria-describedby="signature-hint"
            />
            <span className="shipping-label__ink" aria-hidden="true" />
          </div>

          <div className="shipping-label__field">
            <span className="shipping-label__static-label">To</span>
            <span className="shipping-label__static-value">The Forgotten Explorers</span>
          </div>

          <div className="shipping-label__field">
            <span className="shipping-label__static-label">Carrier kit</span>
            <span className="shipping-label__static-value shipping-label__contents">
              {trait ? `${trait.sigil} ${trait.name}` : ''}
              {explorer ? ` · ${explorer.name}` : ''}
            </span>
          </div>

          <div className="shipping-label__field shipping-label__field--row">
            <span className="shipping-label__static-value shipping-label__fragile">
              Fragile: your dreams
            </span>
            <span className="shipping-label__barcode" aria-hidden="true" />
          </div>

          {/* Postmark: pressed onto the paper as ink, never an agency logo. */}
          <div className="shipping-label__postmark" aria-hidden="true">
            <span className="shipping-label__postmark-envelope">✉</span>
            <span className="shipping-label__postmark-text">COSMIC MAIL</span>
            <span className="shipping-label__postmark-star">✦</span>
          </div>

          <p className="shipping-label__ink-mark" aria-hidden="true" />

          <p id="signature-hint" className="shipping-label__hint" aria-live="polite">
            {!valid && name.length > 0 ? 'At least two letters, carrier.' : ''}
          </p>

          <button
            type="submit"
            className="menu__option shipping-label__cta"
            disabled={!valid || sealed}
          >
            {sealed ? 'Sealed!' : 'Seal & continue'}
          </button>
        </form>

        {stage === 'farewell' || stage === 'departing' ? (
          <p className="shipping-label__welcome" role="status">
            Welcome aboard, {normalizedName}! Your story starts here.
          </p>
        ) : null}
      </div>
    </section>
  )
}
