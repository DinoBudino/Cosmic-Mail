import { useEffect, useRef, useState } from 'react'
import { emitAudio } from '../../game/audio/audioEvents'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'

interface MenuAction {
  id: string
  label: string
  run: () => void
}

/**
 * Title screen. Continue is offered only for a valid JourneySave; New
 * Game asks for confirmation before the registration step replaces it.
 */
export function MainMenu() {
  const save = useJourneyStore((state) => state.save)
  const loadStatus = useJourneyStore((state) => state.loadStatus)
  const openSettings = useGameStore((state) => state.openSettings)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  const [selected, setSelected] = useState(0)
  const [confirming, setConfirming] = useState<string | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const firstRenderRef = useRef(true)
  const timerRef = useRef<number | null>(null)

  // With a save on disk, New Game asks first in the game's own screen.
  const [askingNew, setAskingNew] = useState(false)
  const startNewGame = () => {
    if (save) {
      setAskingNew(true)
      return
    }
    useOnboardingStore.getState().startNewJourney()
  }

  const continueGame = () => {
    useOnboardingStore.getState().continueJourney()
  }

  const actions: MenuAction[] = save
    ? [
        { id: 'continue', label: 'Continue', run: continueGame },
        { id: 'new', label: 'New Game', run: startNewGame },
        { id: 'settings', label: 'Settings', run: openSettings },
      ]
    : [
        { id: 'new', label: 'New Game', run: startNewGame },
        { id: 'settings', label: 'Settings', run: openSettings },
      ]

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    emitAudio('uiHover', { dedupeKey: 'menu-selection', dedupeMs: 60 })
  }, [selected])

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  useEffect(() => {
    optionRefs.current[0]?.focus()
  }, [])

  const moveSelection = (index: number) => {
    const next = (index + actions.length) % actions.length
    setSelected(next)
    optionRefs.current[next]?.focus()
  }

  const onNavKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      moveSelection(selected + 1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      moveSelection(selected - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      moveSelection(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      moveSelection(actions.length - 1)
    }
  }

  const confirm = (action: MenuAction) => {
    if (confirming) return
    emitAudio('uiConfirm')
    if (reducedMotion) {
      action.run()
      return
    }
    setConfirming(action.id)
    timerRef.current = window.setTimeout(() => {
      setConfirming(null)
      action.run()
    }, 240)
  }

  return (
    <section className="menu" aria-labelledby="menu-title">
      <header className="menu__header">
        <h1 id="menu-title" className="menu__title">
          COSMIC MAIL
        </h1>
        <p className="menu__tagline">The memories that must find their way home</p>
        <span className="menu__divider" aria-hidden="true">
          ✦
        </span>
      </header>

      <nav
        className="menu__nav"
        aria-label="Main menu"
        onKeyDown={onNavKeyDown}
      >
        {actions.map((action, index) => (
          <button
            key={action.id}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            type="button"
            className={`menu__option${
              selected === index ? ' is-selected' : ''
            }${confirming === action.id ? ' is-confirming' : ''}`}
            tabIndex={selected === index ? 0 : -1}
            aria-current={selected === index ? 'true' : undefined}
            onClick={() => confirm(action)}
            onMouseEnter={() => setSelected(index)}
            onFocus={() => setSelected(index)}
          >
            {action.label}
          </button>
        ))}
      </nav>

      {save && (
        <p className="menu__carrier">
          Carrier {save.playerName} · Cosmic Mail
        </p>
      )}
      {askingNew && save && (
        <NewGameConfirm
          carrier={save.playerName}
          onCancel={() => {
            emitAudio('uiClick')
            setAskingNew(false)
            optionRefs.current[selected]?.focus()
          }}
          onConfirm={() => {
            emitAudio('uiConfirm')
            setAskingNew(false)
            useOnboardingStore.getState().startNewJourney()
          }}
        />
      )}
      {!save && loadStatus === 'corrupt' && (
        <p className="menu__carrier" role="status">
          The saved journey could not be read. New Game will start a fresh one.
        </p>
      )}
    </section>
  )
}

/**
 * "Start a new journey?" on a tech screen, not the browser's own confirm.
 * Keeping the current journey is the safe, focused default.
 */
function NewGameConfirm({
  carrier,
  onCancel,
  onConfirm,
}: {
  carrier: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const keepRef = useRef<HTMLButtonElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    keepRef.current?.focus()
  }, [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
      return
    }
    // Two buttons: Tab and the arrows simply switch between them.
    if (['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
      const next =
        document.activeElement === keepRef.current ? startRef.current : keepRef.current
      next?.focus()
    }
  }

  return (
    <div
      className="newgame-scrim"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="newgame"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="newgame-title"
        aria-describedby="newgame-text"
        onKeyDown={onKeyDown}
      >
        <p className="newgame__eyebrow">Cosmic Mail · new journey</p>
        <div className="newgame__icon" aria-hidden="true">
          ✦
        </div>
        <h2 id="newgame-title">Start a new journey?</h2>
        <p id="newgame-text">
          Carrier <strong>{carrier}</strong>&apos;s stamps and saved stories will be
          replaced. This can&apos;t be undone.
        </p>
        <div className="newgame__actions">
          <button
            ref={keepRef}
            type="button"
            className="newgame__btn newgame__btn--keep"
            onClick={onCancel}
          >
            Keep my journey
          </button>
          <button
            ref={startRef}
            type="button"
            className="newgame__btn newgame__btn--start"
            onClick={onConfirm}
          >
            Start new
          </button>
        </div>
      </div>
    </div>
  )
}
