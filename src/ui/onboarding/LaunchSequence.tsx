import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import { ZONES } from '../../data/zones'
import {
  ESCAPE_VELOCITY_FACT,
  countdownLabel,
  inCabinStage,
  launchClock,
  launchTimeline,
  showEscapeVelocityFact,
  stageAt,
} from '../../game/launchTimeline'
import { PipAvatar } from '../PipSpeech'

/**
 * Text overlay for the launch cinematic. The 3D action plays in the
 * (already mounted) menu scene — `MenuScene` in launching mode — so
 * this component only draws the countdown, the ignition caption, the
 * brief fact card, and the destination caption, driven by the same
 * shared clock the scene reads.
 */
export function LaunchSequence() {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const finishLaunch = useOnboardingStore((state) => state.finishLaunch)
  const destinationId = useOnboardingStore((state) => state.passport?.destination ?? 'mars')
  const destination = ZONES.find((zone) => zone.id === destinationId) ?? ZONES[1]!
  const explorerName = useOnboardingStore((state) => state.passport?.explorerName ?? '')
  const setPipTalking = useOnboardingStore((state) => state.setPipTalking)
  const [elapsed, setElapsed] = useState(0)
  const finishedRef = useRef(false)

  const duration = launchTimeline(reducedMotion).duration
  const { stage } = stageAt(elapsed, reducedMotion)
  const countdown = countdownLabel(elapsed, reducedMotion)
  const showFact = showEscapeVelocityFact(elapsed, reducedMotion)

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    launchClock.value = 0
    finishLaunch()
  }

  useEffect(() => {
    launchClock.value = 0
    const start = performance.now()
    let frame = 0
    const tick = () => {
      const value = (performance.now() - start) / 1000
      launchClock.value = value
      setElapsed(value)
      if (value >= duration) {
        finish()
        return
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
    // finishLaunch/duration are stable per mount; re-run only if the
    // reduced-motion setting changes mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  // PIP talks through the in-cabin countdown (his 3D mouth moves);
  // the exterior cruise is silent.
  useEffect(() => {
    setPipTalking(inCabinStage(elapsed, reducedMotion))
    return () => setPipTalking(false)
  }, [elapsed, reducedMotion, setPipTalking])

  // Skip with Escape as well as the on-screen button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="launch" aria-label="Launch sequence">
      <div className="launch__vignette" aria-hidden="true" />

      {inCabinStage(elapsed, reducedMotion) && (
        <p className="launch__caption pip-bubble-wrap-like">
          <PipAvatar /> <span><strong>PIP:</strong> Buckle up, {explorerName || 'carrier'} — hold on tight!</span>
        </p>
      )}

      {countdown && (
        <p key={countdown} className="launch__countdown" aria-live="assertive">
          {countdown}
        </p>
      )}

      {showFact && (
        <p className="launch__fact">
          <span className="launch__fact-glyph" aria-hidden="true">✦</span> {ESCAPE_VELOCITY_FACT}
        </p>
      )}

      {(stage === 'accelerate' || stage === 'arrive') && (
        <p className="launch__destination">
          Next stop: <strong>{destination.name}</strong>
        </p>
      )}

      <button type="button" className="launch__skip" onClick={finish} autoFocus>
        Skip ▸
      </button>
    </section>
  )
}
