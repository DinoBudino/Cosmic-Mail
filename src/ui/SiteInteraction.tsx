import { useEffect, useRef } from 'react'
import { MARS_OBJECTS, REGION_INFO, type ObjectState } from '../data/marsObjects'
import { getExplorer, getTrait } from '../data/personalization'
import { speakPip } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useOnboardingStore } from '../store/onboardingStore'

const STATE_LABELS: Record<ObjectState, string> = {
  available: 'Available to explore',
  'coming-soon': 'Coming soon',
  'in-progress': 'In progress',
  rescued: 'Rescued',
}

export function SiteInteraction() {
  const nearbyId = useGameStore((state) => state.nearbySiteId)
  const activeId = useGameStore((state) => state.activeSiteId)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const preview = useGameStore((state) => state.challengePreview)
  const travelTargetId = useGameStore((state) => state.travelTargetId)
  const openSite = useGameStore((state) => state.openNearbySite)
  const closeSite = useGameStore((state) => state.closeSite)
  const startChallenge = useGameStore((state) => state.startChallenge)
  const passport = useOnboardingStore((state) => state.passport)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const collectMemory = useOnboardingStore((state) => state.collectMemory)
  const switchHero = useOnboardingStore((state) => state.switchHero)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const active = MARS_OBJECTS.find((site) => site.id === activeId)
  const nearby = MARS_OBJECTS.find((site) => site.id === nearbyId)

  useEffect(() => {
    if (!activeId) return
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [activeId])

  // Memory fragment: one per site, restores the next locked hero.
  const memoryAlreadyCollected = Boolean(
    active && passport?.memorySites.includes(active.id),
  )
  const canCollectMemory = Boolean(
    active && passport && active.state !== 'coming-soon' && !memoryAlreadyCollected,
  )
  const restoredHeroId = passport?.stamps[passport.stamps.length - 1]

  return (
    <>
      {!active && !settingsOpen && nearby && (
        <aside className="site-prompt" aria-label="Explorer information">
          <p className="settings-eyebrow">Explorer</p>
          <div role="status" aria-live="polite" aria-atomic="true">
            <h2>{nearby.name}</h2>
            <p className="site-region">{REGION_INFO[nearby.id].regionName}</p>
            <p>{STATE_LABELS[nearby.state]}</p>
            <p>{nearby.description}</p>
          </div>
          <button type="button" className="site-action" onClick={openSite}>
            <span className="desktop-interact">Press E or click to inspect</span>
            <span className="touch-interact">Tap to inspect</span>
            <span className="sr-only"> {nearby.name}</span>
          </button>
          {travelTargetId && <p className="site-travel">Travelling to {MARS_OBJECTS.find((site) => site.id === travelTargetId)?.name}…</p>}
        </aside>
      )}
      {active && (
        <dialog
          ref={dialogRef}
          className="settings-panel site-dialog"
          aria-labelledby="site-title"
          aria-describedby="site-description"
          onCancel={(event) => { event.preventDefault(); closeSite() }}
        >
          <div className="settings-header">
            <div>
              <p className="settings-eyebrow">Mars explorer · {STATE_LABELS[active.state]}</p>
              <h2 id="site-title">{active.name}</h2>
            </div>
            <button type="button" className="settings-close" aria-label="Close explorer information" onClick={closeSite}>×</button>
          </div>
          <p id="site-description" className="settings-description">{active.description}</p>
          <blockquote className="site-voice">
            <span aria-hidden="true">“</span>{active.artifactVoice}<span aria-hidden="true">”</span>
          </blockquote>
          <p className="settings-hint">This is a stylized memorial scene. These missions are no longer operating. Letters and rescues in the game are fictional, not real transmissions.</p>
          <nav aria-label="NASA mission sources" className="site-sources">
            {active.sources.map((source, index) => <a key={source} href={source} target="_blank" rel="noopener noreferrer">NASA mission source{active.sources.length > 1 ? ` ${index + 1}` : ''} ↗</a>)}
          </nav>
          {active.state === 'coming-soon' ? (
            <p className="site-preview">Coming soon — this explorer’s activity is not available yet.</p>
          ) : (
            <>
              <button type="button" className="site-action" onClick={() => startChallenge(active.id)} disabled={preview}>Deliver letter</button>
              {preview && <p className="site-preview" role="status">Letter delivery is coming soon. This preview awards no stamp yet. You can keep exploring.</p>}
              {canCollectMemory && (
                <button
                  type="button"
                  className="site-action site-action--memory"
                  onClick={() => {
                    const restoredId = collectMemory(active.id)
                    if (restoredId) {
                      try {
                        speakPip(getExplorer(restoredId).memoryLine, voiceName, voiceEnabled)
                      } catch {
                        // Store changed under us; subtitles still show.
                      }
                    }
                  }}
                >
                  🧠 Recover memory fragment
                </button>
              )}
              {memoryAlreadyCollected && passport && (
                <p className="site-preview" role="status">
                  Memory fragment recovered · {passport.unlockedExplorerIds.length}/5 heroes restored.
                  {restoredHeroId && (
                    <>
                      {' '}Last restored: {(() => { try { const h = getExplorer(restoredHeroId); return `${h.name} · ${getTrait(h.trait).sigil} ${getTrait(h.trait).name}` } catch { return '' } })()}
                      . <button type="button" className="site-link" onClick={() => switchHero(restoredHeroId)}>Use this hero</button>
                    </>
                  )}
                </p>
              )}
            </>
          )}
          <button type="button" className="settings-resume" onClick={closeSite}>Return to exploring</button>
        </dialog>
      )}
    </>
  )
}
