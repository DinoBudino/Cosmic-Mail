import { lazy, Suspense, useEffect } from 'react'
import './App.css'
import { attachInput, clearInput } from './game/input'
import { getEscapeAction } from './game/escapePriority'
import { installPacing } from './game/pacing'
import { MissionNarrativeController } from './game/MissionNarrativeController'
import { isWorldPaused, useGameStore } from './store/gameStore'
import { useOnboardingStore } from './store/onboardingStore'
import { AudioDirector } from './game/audio/AudioDirector'
import { Onboarding } from './ui/onboarding/Onboarding'
import { CosmicRadar } from './ui/CosmicRadar'
import { CosmicScanner } from './ui/CosmicScanner'
import { MemoryReconstructionOverlay } from './ui/MemoryReconstruction'
import { SmartLetterOverlay } from './ui/SmartLetter'
import { ScannerHud } from './ui/ScannerHud'
import { ScanReward } from './ui/ScanReward'
import { ScannerReadingCard } from './ui/ScannerReadingCard'
import { SiteInteraction } from './ui/SiteInteraction'
import { SpiritInteraction } from './ui/SpiritInteraction'
import { ShipInteraction } from './ui/ShipInteraction'
import { CinematicOverlay } from './ui/CinematicOverlay'
import { Hud } from './ui/Hud'
import { MissionPanel } from './ui/MissionPanel'
import { ObjectiveBar } from './ui/ObjectiveBar'
import { PipSpeech } from './ui/PipSpeech'
import { SettingsMenu } from './ui/SettingsMenu'
import { TouchControls } from './ui/TouchControls'
import { MarsBriefing } from './ui/MarsBriefing'
import { SceneBoundary, SceneStatus } from './ui/SceneStatus'

const GameCanvas = lazy(() => import('./game/GameCanvas'))

export default function App() {
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const briefingOpen = useGameStore((state) => state.marsBriefingStep !== null)
  const scannerCamera = useGameStore((state) => state.scannerCamera)
  const scanStation = useGameStore((state) => state.scanStation)
  const onboardingActive = useOnboardingStore((state) => state.phase !== 'playing')

  useEffect(() => attachInput(isWorldPaused), [])

  useEffect(() => installPacing(), [])

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
      // Escape releases Pointer Lock first; the next press opens settings.
      if (document.pointerLockElement) return
      const state = useGameStore.getState()
      const action = getEscapeAction(state)
      if (action === 'ignore') return

      event.preventDefault()
      if (action === 'close-records') {
        state.closeScannerCard()
        return
      }
      if (action === 'unequip-scanner') {
        state.unequipScanner()
        return
      }
      state.openSettings()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <AudioDirector />
      {onboardingActive ? (
        <main className="game" data-reduced-motion={reducedMotion}>
          <Onboarding />
          <SettingsMenu />
          <SmartLetterOverlay />
          <MemoryReconstructionOverlay />
        </main>
      ) : (
        <main
          className="game"
          data-reduced-motion={reducedMotion}
          data-scanner={scannerEquipped ? 'equipped' : 'idle'}
          data-scanner-camera={scanStation ? 'station' : scannerCamera}
        >
          <div className="world-layer" inert={settingsOpen}>
            <SceneBoundary>
              <Suspense fallback={<SceneStatus />}>
                <GameCanvas />
              </Suspense>
            </SceneBoundary>

            {/* The guided arrival briefing owns the screen: only the radar
                PIP presents stays, everything else waits until it ends. */}
            {!briefingOpen && <Hud />}
            {!briefingOpen && <ObjectiveBar />}
            {!briefingOpen && <MissionPanel />}
            <CosmicRadar />
            <ScannerHud />
            {!briefingOpen && <ScanReward />}
            {!briefingOpen && <PipSpeech />}
            <CinematicOverlay />
            {!briefingOpen && <TouchControls />}
            <MissionNarrativeController />
            <MarsBriefing />
          </div>
          <SettingsMenu />
          <SiteInteraction />
          <SpiritInteraction />
          <ShipInteraction />
          <CosmicScanner />
          <ScannerReadingCard />
          <SmartLetterOverlay />
          <MemoryReconstructionOverlay />
        </main>
      )}
    </>
  )
}
