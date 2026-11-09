import { lazy, Suspense, useEffect } from 'react'
import './App.css'
import { attachInput, clearInput } from './game/input'
import { isWorldPaused, useGameStore } from './store/gameStore'
import { useOnboardingStore } from './store/onboardingStore'
import { startMusic, stopMusic, unlockMusic, setMusicVolume as applyMusicVolume } from './game/music'
import { Onboarding } from './ui/onboarding/Onboarding'
import { SiteInteraction } from './ui/SiteInteraction'
import { Hud } from './ui/Hud'
import { MissionPanel } from './ui/MissionPanel'
import { PipSpeech } from './ui/PipSpeech'
import { SettingsMenu } from './ui/SettingsMenu'
import { TouchControls } from './ui/TouchControls'
import { SceneBoundary, SceneStatus } from './ui/SceneStatus'

const GameCanvas = lazy(() => import('./game/GameCanvas'))

export default function App() {
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const musicVolume = useGameStore((state) => state.musicVolume)
  const onboardingActive = useOnboardingStore((state) => state.phase !== 'playing')

  useEffect(() => attachInput(isWorldPaused), [])

  // Cabin ambience: plays through the whole initial phase (title screen
  // to the name signing) and stops when the adventure starts.
  useEffect(() => {
    if (onboardingActive) startMusic(musicVolume)
    else stopMusic()
  }, [onboardingActive, musicVolume])

  useEffect(() => {
    applyMusicVolume(musicVolume)
  }, [musicVolume])

  useEffect(() => {
    // Browsers block audio before the first gesture: retry on any
    // interaction while the ritual is active.
    const unlock = () => {
      if (useOnboardingStore.getState().phase !== 'playing') {
        unlockMusic(useGameStore.getState().musicVolume)
      }
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

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

  if (onboardingActive) {
    return (
      <main className="game" data-reduced-motion={reducedMotion}>
        <Onboarding />
        <SettingsMenu />
      </main>
    )
  }

  return (
    <main className="game" data-reduced-motion={reducedMotion}>
      <div className="world-layer" inert={settingsOpen}>
      <SceneBoundary>
        <Suspense fallback={<SceneStatus />}>
          <GameCanvas />
        </Suspense>
      </SceneBoundary>

      <Hud />
      <MissionPanel />
      <PipSpeech />
      <TouchControls />
      </div>
      <SettingsMenu />
      <SiteInteraction />
    </main>
  )
}
