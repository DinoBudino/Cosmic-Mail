import { lazy, Suspense, useEffect } from 'react'
import './App.css'
import { attachInput, clearInput } from './game/input'
import { isWorldPaused, useGameStore } from './store/gameStore'
import { SiteInteraction } from './ui/SiteInteraction'
import { Hud } from './ui/Hud'
import { SettingsMenu } from './ui/SettingsMenu'
import { TouchControls } from './ui/TouchControls'
import { SceneBoundary, SceneStatus } from './ui/SceneStatus'

const GameCanvas = lazy(() => import('./game/GameCanvas'))

export default function App() {
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  useEffect(() => attachInput(isWorldPaused), [])

  useEffect(() => {
    const stopTravel = () => useGameStore.getState().cancelTravel()
    const onVisibilityChange = () => { if (document.hidden) stopTravel() }
    window.addEventListener('blur', stopTravel)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', stopTravel)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (settingsOpen) clearInput()
  }, [settingsOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const state = useGameStore.getState()
      if (state.settingsOpen || state.activeSiteId) return
      event.preventDefault()
      state.openSettings()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <main className="game" data-reduced-motion={reducedMotion}>
      <div className="world-layer" inert={settingsOpen}>
      <SceneBoundary>
        <Suspense fallback={<SceneStatus />}>
          <GameCanvas />
        </Suspense>
      </SceneBoundary>

      <Hud />
      <TouchControls />
      </div>
      <SettingsMenu />
      <SiteInteraction />
    </main>
  )
}
