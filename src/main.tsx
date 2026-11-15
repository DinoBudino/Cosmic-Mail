import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './store/gameStore'
import { useJourneyStore } from './store/journeyStore'
import { useOnboardingStore } from './store/onboardingStore'
import { useNarrativeStore } from './store/narrativeStore'

// Dev-only handle so automated visual checks can jump straight to a scene.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __cosmic: { onboarding: useOnboardingStore, journey: useJourneyStore, game: useGameStore, narrative: useNarrativeStore },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
