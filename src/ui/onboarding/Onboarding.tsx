import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useOnboardingStore } from '../../store/onboardingStore'
import { Cabin } from './Cabin'
import { DiscoveryQuestions } from './DiscoveryQuestions'
import { ExplorerProfiles } from './ExplorerProfiles'
import { Hub } from './Hub'
import { LaunchSequence } from './LaunchSequence'
import { MainMenu } from './MainMenu'
import { ModulePicker } from './ModulePicker'
import { NamePrompt } from './NamePrompt'
import { TraitReveal } from './TraitReveal'
import './onboarding.css'

// The living 3D backdrop (planet, ship, stars, cockpit glass) stays
// mounted across the whole ritual so every screen shares the same space.
// Code-split so it only loads before the game world.
const MenuScene = lazy(() => import('../../game/MenuScene'))

/**
 * The pre-game ritual: main menu, then the cabin steps (questions,
 * reveal, explorer, module, name, passport). The 3D world is not
 * mounted until `playing`.
 */
export function Onboarding() {
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const [fadeKey, setFadeKey] = useState(0)
  const wasInside = useRef(false)

  // Fade only when LEAVING the cabin (back to the title scene): the
  // fade starts opaque black and reveals the menu once — boarding into
  // the cabin stays a clean cut with no initial animation.
  useEffect(() => {
    const inside = phase !== 'menu' && boardingStage === 'cabin'
    if (wasInside.current && !inside) {
      setFadeKey((key) => key + 1)
    }
    wasInside.current = inside
  }, [phase, boardingStage])

  // Move focus to the first control of each step for keyboard users.
  useEffect(() => {
    const root = document.querySelector('.onboarding')
    const controls = root?.querySelectorAll<HTMLElement>('button:not([disabled]), input') ?? []
    const target = Array.from(controls).find((el) => !el.classList.contains('onboarding__back'))
    ;(target ?? controls[0])?.focus()
  }, [phase])

  const isMenu = phase === 'menu'
  const isLaunching = phase === 'launching'

  // Launching reuses the menu scene itself (no new scene): the same
  // wide shot, ship and stars — `MenuScene` switches to launch mode,
  // and this overlay only adds countdown/fact/Skip text on top.
  if (isLaunching) {
    return (
      <main className="onboarding" data-phase={phase} aria-label="Cosmic Mail launch sequence">
        <div className="menu-scene" aria-hidden="true">
          <Suspense fallback={null}>
            <MenuScene />
          </Suspense>
        </div>
        <LaunchSequence />
      </main>
    )
  }

  return (
    <main
      className="onboarding"
      data-phase={phase}
      aria-label="Cosmic Mail main menu and explorer discovery"
    >
      <div className="menu-scene" aria-hidden="true">
        <Suspense fallback={null}>
          <MenuScene />
        </Suspense>
      </div>

      {fadeKey > 0 && <div key={fadeKey} className="scene-fade" aria-hidden="true" />}

      {isMenu ? (
        <MainMenu />
      ) : phase !== 'passport' && boardingStage === 'approach' ? (
        // Approach stage: the flight toward the ship, no dialogue yet —
        // but Back is always available so nobody feels trapped.
        <button
          type="button"
          className="identity__back"
          style={{ position: 'fixed', zIndex: 6 }}
          onClick={() => useOnboardingStore.getState().goBack()}
        >
          ← Back
        </button>
      ) : (
        <Cabin>
          {phase === 'questions' && <DiscoveryQuestions />}
          {phase === 'reveal' && <TraitReveal />}
          {phase === 'explorer' && <ExplorerProfiles />}
          {phase === 'module' && <ModulePicker />}
          {phase === 'name' && <NamePrompt />}
          {phase === 'hub' && <Hub />}
        </Cabin>
      )}
    </main>
  )
}
