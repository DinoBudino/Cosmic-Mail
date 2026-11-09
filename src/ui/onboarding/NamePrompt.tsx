import { useEffect, useRef, useState } from 'react'
import {
  MAX_NAME_LENGTH,
  getExplorer,
  getModule,
  getTrait,
  isValidExplorerName,
} from '../../data/personalization'
import { useGameStore } from '../../store/gameStore'
import { useOnboardingStore } from '../../store/onboardingStore'

/**
 * Final signing step: the explorer signs their name onto the postal
 * shipping label (already filled with their choices). Confirming "seals"
 * the label (stamp slam) before the passport appears. PIP's reminder
 * lives in the cabin bubble above.
 */
export function NamePrompt() {
  const submitName = useOnboardingStore((state) => state.submitName)
  const goBack = useOnboardingStore((state) => state.goBack)
  const signing = useOnboardingStore((state) => state.signing)
  const traitId = useOnboardingStore((state) => state.trait)
  const explorerId = useOnboardingStore((state) => state.explorerId)
  const moduleId = useOnboardingStore((state) => state.moduleId)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [name, setName] = useState('')
  const [sealed, setSealed] = useState(false)
  const valid = isValidExplorerName(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (signing) inputRef.current?.focus()
  }, [signing])

  const trait = traitId ? getTrait(traitId) : null
  const explorer = explorerId ? getExplorer(explorerId) : null
  const module = moduleId ? getModule(moduleId) : null

  // Before signing, only PIP's warning (his bubble, in the cabin) and
  // the Back action exist. The label window appears after his click.
  // (All hooks live above this return: flipping it would change the
  // hook count between renders and crash.)
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
    if (!valid || sealed) return
    if (reducedMotion) {
      submitName(name)
      return
    }
    setSealed(true)
    window.setTimeout(() => submitName(name), 650)
  }

  return (
    <section className="boarding" aria-labelledby="name-title" style={{ minHeight: 0, padding: 0 }}>
      <div className="cabin-controls">
        <button type="button" className="identity__back identity__back--static" onClick={goBack}>
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

      <form
        className={`shipping-label${sealed ? ' is-sealed' : ''}`}
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

        <div className="shipping-label__field">
          <label htmlFor="explorer-name">From</label>
          <input
            ref={inputRef}
            id="explorer-name"
            className="shipping-label__input"
            type="text"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            placeholder="Your name…"
            onChange={(event) => setName(event.target.value)}
            disabled={sealed}
          />
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
            {module ? ` · ${module.name}` : ''}
          </span>
        </div>

        <div className="shipping-label__field shipping-label__field--row">
          <span className="shipping-label__static-value shipping-label__fragile">
            Fragile: your dreams
          </span>
          <span className="shipping-label__barcode" aria-hidden="true" />
        </div>

        <p className="shipping-label__seal" aria-hidden="true">
          ✉ Sealed
        </p>

        <button type="submit" className="menu__option shipping-label__cta" disabled={!valid || sealed}>
          {sealed ? 'Sealed!' : 'Seal & continue'}
        </button>
      </form>
    </section>
  )
}
