import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useOnboardingStore } from '../../store/onboardingStore'
import { Cabin } from './Cabin'
import { Hub } from './Hub'
import { Intro } from './Intro'
import { LaunchSequence } from './LaunchSequence'
import { MarsOrbit } from './MarsOrbit'
import { MainMenu } from './MainMenu'
import { PostalRegistration } from './PostalRegistration'
import './onboarding.css'

const MenuScene = lazy(() => import('../../game/MenuScene'))

/**
 * One active onboarding: menu -> intro -> registration -> hub -> launch ->
 * playing. There is no personality, hero, power or passport-v2 branch.
 */
export function Onboarding() {
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const [fadeKey, setFadeKey] = useState(0)
  const wasInside = useRef(false)

  useEffect(() => {
    const inside = phase !== 'menu' && boardingStage === 'cabin'
    if (wasInside.current && !inside) {
      setFadeKey((key) => key + 1)
    }
    wasInside.current = inside
  }, [phase, boardingStage])

  const isMenu = phase === 'menu'
  const isLaunching = phase === 'launching'

  if (phase === 'orbit') {
    return (
      <main className="onboarding" data-phase={phase} aria-label="Mars orbit">
        <MarsOrbit />
      </main>
    )
  }

  if (isLaunching) {
    return (
      <main
        className="onboarding"
        data-phase={phase}
        aria-label="Cosmic Mail launch sequence"
      >
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
      aria-label="Cosmic Mail main menu, archive story and carrier registration"
    >
      <div className="menu-scene" aria-hidden="true">
        <Suspense fallback={null}>
          <MenuScene />
        </Suspense>
      </div>

      {fadeKey > 0 && (
        <div key={fadeKey} className="scene-fade" aria-hidden="true" />
      )}

      {isMenu ? (
        <MainMenu />
      ) : boardingStage === 'approach' ? (
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
          {phase === 'intro' && <Intro />}
          {phase === 'registration' && <PostalRegistration />}
          {phase === 'hub' && <Hub />}
        </Cabin>
      )}
    </main>
  )
}
