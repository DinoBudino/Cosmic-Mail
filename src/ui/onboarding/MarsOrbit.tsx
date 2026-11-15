import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  MARS_LANDING_SITES,
  getLandingSiteProgress,
  getLandingSiteState,
  getOrbitGuidance,
} from '../../data/marsLandingSites'
import { getMission } from '../../data/missions'
import { pipLine } from '../../data/pipVoiceCatalog'
import type { MarsExplorerId } from '../../data/spiritSite'
import { emitAudio } from '../../game/audio/audioEvents'
import { speakPip, stopPipVoice } from '../../game/pipVoice'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { PipAvatar } from '../PipSpeech'
import type { OrbitMarker } from '../../game/MarsOrbitScene'

const MarsOrbitScene = lazy(() => import('../../game/MarsOrbitScene'))

const LANDING_MS = 1900

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
  const voiceName = useGameStore((state) => state.voiceName)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const openArchive = useGameStore((state) => state.openArchive)

  const guidance = getOrbitGuidance(save)
  const [selected, setSelected] = useState<MarsExplorerId | null>(null)
  const [landing, setLanding] = useState(false)
  // PIP's own reply to a pick / the landing; otherwise the guidance line.
  const [reply, setReply] = useState<string | null>(null)
  const line = reply ?? guidance.line
  const landTimer = useRef<number | null>(null)
  const labels = useRef<Partial<Record<MarsExplorerId, HTMLElement | null>>>({})

  const markers: OrbitMarker[] = useMemo(
    () =>
      MARS_LANDING_SITES.map((site) => {
        const state = getLandingSiteState(save, site.explorer)
        // The explorer's name stays hidden until the child finds it.
        const label =
          state === 'unknown' ? site.place : getMission(site.explorer).machineName
        const percent = getLandingSiteProgress(save, site.explorer)
        return { explorer: site.explorer, label, state, percent }
      }),
    [save],
  )

  // PIP speaks the guidance whenever it changes (arrival, after delivery).
  useEffect(() => {
    if (archiveOpen) return
    speakPip(guidance.line, voiceName, voiceEnabled, 'happy')
  }, [guidance.line, archiveOpen, voiceName, voiceEnabled])

  useEffect(
    () => () => {
      if (landTimer.current) window.clearTimeout(landTimer.current)
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
    speakPip(text, voiceName, voiceEnabled, 'excited')
    landTimer.current = window.setTimeout(
      () => landAt(explorer),
      reducedMotion ? 300 : LANDING_MS,
    )
  }

  return (
    <section className="orbit" data-landing={landing} aria-label="Mars orbit: choose where to land">
      <div className="orbit__scene">
        <Suspense fallback={null}>
          <MarsOrbitScene
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
      {landing && <div className="orbit__dive" aria-hidden="true" />}

      <header className="orbit__top">
        <p className="orbit__title">Mars orbit</p>
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
