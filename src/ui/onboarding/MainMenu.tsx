import { useEffect, useRef, useState } from 'react'
import { useOnboardingStore } from '../../store/onboardingStore'
import { useGameStore } from '../../store/gameStore'
import { playNavSound } from '../../game/music'

/**
 * Title screen: black space with the 3D scene behind, the game title at the
 * top and a bare list of options in the middle. No instructions, no panel —
 * the mystery is the tutorial.
 *
 * The options behave like a game menu, not web links: a single
 * selection indicator walks with rAF-free CSS transitions, arrow keys
 * move it, hover/focus adopt it, and confirming gives a brief warm
 * pulse + soft tick before the action runs.
 */
export function MainMenu() {
  const startMission = useOnboardingStore((state) => state.startMission)
  const continueMission = useOnboardingStore((state) => state.continueMission)
  const resetJourney = useOnboardingStore((state) => state.resetJourney)
  const passport = useOnboardingStore((state) => state.passport)
  const openSettings = useGameStore((state) => state.openSettings)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const musicVolume = useGameStore((state) => state.musicVolume)

  const [selected, setSelected] = useState(0)
  const [confirming, setConfirming] = useState<string | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const firstRenderRef = useRef(true)
  const timerRef = useRef<number | null>(null)

  const actions: Array<{ id: string; label: string; run: () => void }> = passport
    ? [
        { id: 'continue', label: 'Continue mission', run: continueMission },
        { id: 'start', label: 'Start a new mission', run: startMission },
        { id: 'settings', label: 'Settings', run: openSettings },
      ]
    : [
        { id: 'start', label: 'Start a new mission', run: startMission },
        { id: 'settings', label: 'Settings', run: openSettings },
      ]

  // Soft tick when the selection moves (never on mount).
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }
    playNavSound('move', musicVolume)
  }, [selected, musicVolume])

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  // First option gets focus on mount for keyboard users.
  useEffect(() => {
    optionRefs.current[0]?.focus()
    // Only on mount: the option list changes with passport state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const confirm = (action: { id: string; run: () => void }) => {
    if (confirming) return
    playNavSound('confirm', musicVolume)
    if (reducedMotion) {
      action.run()
      return
    }
    // Brief warm pulse, then the action runs.
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
        <p className="menu__tagline">Letters to the Forgotten Explorers</p>
        <span className="menu__divider" aria-hidden="true">
          ✦
        </span>
      </header>

      <nav className="menu__nav" aria-label="Main menu" onKeyDown={onNavKeyDown}>
        {actions.map((action, index) => (
          <button
            key={action.id}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            type="button"
            className={`menu__option${selected === index ? ' is-selected' : ''}${
              confirming === action.id ? ' is-confirming' : ''
            }`}
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

      {passport && (
        <button type="button" className="menu__footer" onClick={resetJourney}>
          Forget this explorer
        </button>
      )}
    </section>
  )
}
