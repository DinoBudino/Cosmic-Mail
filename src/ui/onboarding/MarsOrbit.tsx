import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  landingSitesFor,
  getLandingSiteProgress,
  getLandingSiteState,
  getOrbitGuidance,
} from '../../data/marsLandingSites'
import { getMission } from '../../data/missions'
import { pipLine } from '../../data/pipVoiceCatalog'
import type { ExplorerId as MarsExplorerId } from '../../data/spiritSite'
import { emitAudio } from '../../game/audio/audioEvents'
import { onPipVoiceEnded, speakPip, stopPipVoice } from '../../game/pipVoice'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { PipAvatar } from '../PipSpeech'
import type { OrbitMarker } from '../../game/MarsOrbitScene'

const MarsOrbitScene = lazy(() => import('../../game/MarsOrbitScene'))

/** Shortest dive (voice off) and the dive while PIP talks. */
const LANDING_MS = 1900
const LANDING_TALK_MS = 3400
/** Never wait longer than this for the voice (a stuck audio element). */
const LANDING_MAX_MS = 6500

/**
 * Mailwing in orbit around Mars. The planet turns slowly and can be spun
 * with a drag; PIP points at the glowing spot to visit. Tapping a spot lands
 * there straight away. Each spot shows how much of it is done. After a
 * mission the child walks back aboard and returns here: the letter is sent
 * to Earth and the finished spot shows a check mark.
 */
export function MarsOrbit() {
  const save = useJourneyStore((state) => state.save)
  const landAt = useOnboardingStore((state) => state.landAt)
  const leaveOrbit = useOnboardingStore((state) => state.leaveOrbit)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const openArchive = useGameStore((state) => state.openArchive)

  const world = save?.currentDestination === 'moon' ? 'moon' : 'mars'
  const worldName = world === 'moon' ? 'Moon' : 'Mars'
  const guidance = getOrbitGuidance(save, world)
  const [selected, setSelected] = useState<MarsExplorerId | null>(null)
  const [landing, setLanding] = useState(false)
  // PIP's own reply to a pick / the landing; otherwise the guidance line.
  const [reply, setReply] = useState<string | null>(null)
  const line = reply ?? guidance.line
  const landTimer = useRef<number | null>(null)
  const stopVoiceWait = useRef<(() => void) | null>(null)
  const labels = useRef<Partial<Record<MarsExplorerId, HTMLElement | null>>>({})

  const markers: OrbitMarker[] = useMemo(
    () =>
      landingSitesFor(world).map((site) => {
        const state = getLandingSiteState(save, site.explorer)
        // The explorer's name stays hidden until the child finds it.
        const label =
          state === 'unknown' ? site.place : getMission(site.explorer).machineName
        const percent = getLandingSiteProgress(save, site.explorer)
        return { explorer: site.explorer, label, state, percent }
      }),
    [save, world],
  )

  // PIP speaks the guidance whenever it changes (arrival, after delivery).
  useEffect(() => {
    if (archiveOpen) return
    speakPip(guidance.line, voiceEnabled, 'happy')
  }, [guidance.line, archiveOpen, voiceEnabled])

  useEffect(
    () => () => {
      if (landTimer.current) window.clearTimeout(landTimer.current)
      stopVoiceWait.current?.()
      stopPipVoice()
    },
    [],
  )

  // Tapping a spot is the whole choice: the Mailwing dives right there.
  const pick = (explorer: MarsExplorerId) => {
    if (landing || guidance.pendingDelivery) return
    emitAudio('uiConfirm')
    setSelected(explorer)
    setLanding(true)
    const text = pipLine('orbit-landing')
    setReply(text)
    speakPip(text, voiceEnabled, 'excited')
    // Touch down only once PIP has finished "Hold on tight…": leaving the
    // orbit screen earlier would cut the line in half.
    const startedAt = performance.now()
    const minimum = reducedMotion ? 300 : voiceEnabled ? LANDING_TALK_MS : LANDING_MS
    let voiceDone = !voiceEnabled
    let landed = false
    const touchDown = () => {
      if (landed) return
      landed = true
      stopListening()
      if (landTimer.current) window.clearTimeout(landTimer.current)
      landAt(explorer)
    }
    const tryLand = () => {
      if (voiceDone && performance.now() - startedAt >= minimum - 20) touchDown()
    }
    const stopListening = onPipVoiceEnded(() => {
      voiceDone = true
      // A short breath after the last word, then down we go.
      window.setTimeout(tryLand, 250)
    })
    stopVoiceWait.current = stopListening
    landTimer.current = window.setTimeout(() => {
      tryLand()
      if (!landed) landTimer.current = window.setTimeout(touchDown, LANDING_MAX_MS - minimum)
    }, minimum)
  }

  return (
    <section
      className="orbit"
      data-world={world}
      data-landing={landing}
      aria-label={`${worldName} orbit: choose where to land`}
    >
      <div className="orbit__scene">
        <Suspense fallback={null}>
          <MarsOrbitScene
            world={world}
            markers={markers}
            selected={selected}
            suggested={guidance.suggested}
            landing={landing}
            reducedMotion={reducedMotion}
            onPick={pick}
            labels={labels}
          />
        </Suspense>
        {markers.map((marker) => (
          <button
            key={marker.explorer}
            ref={(node) => {
              labels.current[marker.explorer] = node
            }}
            type="button"
            className="orbit-marker"
            data-state={marker.state}
            data-active={marker.explorer === selected}
            data-glow={marker.explorer === guidance.suggested && !selected}
            onClick={() => pick(marker.explorer)}
          >
            {marker.label}
            <SiteProgress marker={marker} />
          </button>
        ))}
      </div>
      {landing && (
        <div
          className="orbit__dive"
          aria-hidden="true"
          style={{ animationDuration: `${(voiceEnabled ? LANDING_TALK_MS : LANDING_MS) / 1000}s` }}
        />
      )}

      <header className="orbit__top">
        <p className="orbit__title">{worldName} orbit</p>
        <ul className="orbit__sites" aria-label="Landing spots">
          {markers.map((marker) => (
            <li key={marker.explorer}>
              <button
                type="button"
                className="orbit__site"
                data-state={marker.state}
                aria-pressed={marker.explorer === selected}
                disabled={landing || Boolean(guidance.pendingDelivery)}
                onClick={() => pick(marker.explorer)}
              >
                {marker.label}
                <SiteProgress marker={marker} />
              </button>
            </li>
          ))}
        </ul>
      </header>

      <div className="orbit__bottom">
        <div className="orbit__pip" aria-live="polite">
          <PipAvatar />
          <p>
            <strong>PIP</strong> {line}
          </p>
        </div>
        <div className="orbit__actions">
          {guidance.pendingDelivery ? (
            <button
              type="button"
              className="orbit__action orbit__action--primary"
              onClick={() => {
                setReply(null)
                setSelected(null)
                openArchive('smart-letter', guidance.pendingDelivery!)
              }}
            >
              ✉ Send the letter
            </button>
          ) : guidance.allDone ? (
            <button
              type="button"
              className="orbit__action orbit__action--primary"
              onClick={leaveOrbit}
            >
              Fly home
            </button>
          ) : null}
          {!guidance.allDone && !landing && (
            <button type="button" className="orbit__action" onClick={leaveOrbit}>
              Back to cabin
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/** ✓ when the story is sent, otherwise how much of the area is done. */
function SiteProgress({ marker }: { marker: OrbitMarker }) {
  if (marker.state === 'done') {
    return (
      <span className="orbit-progress orbit-progress--done" aria-label="complete">
        ✓
      </span>
    )
  }
  return (
    <span
      className="orbit-progress"
      style={{ '--pct': `${marker.percent}%` } as CSSProperties}
      aria-label={`${marker.percent}% complete`}
    >
      {marker.percent}%
    </span>
  )
}
