import { useCallback, useEffect, useRef, useState } from 'react'
import { LAUNCH_CABIN_LINE } from '../../data/onboardingNarrative'
import { getDestination } from '../../data/destinations'
import { emitAudio } from '../../game/audio/audioEvents'
import { speakPip } from '../../game/pipVoice'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { useOnboardingStore } from '../../store/onboardingStore'
import {
  ESCAPE_VELOCITY_FACT,
  countdownLabel,
  inCabinStage,
  launchClock,
  launchTimeline,
  liftoffFlash,
  showEscapeVelocityFact,
  stageAt,
  type LaunchStageId,
} from '../../game/launchTimeline'
import { PipAvatar } from '../PipSpeech'

/**
 * Text overlay for the preserved launch cinematic. The 3D action plays
 * in MenuScene; this component only draws countdown, ignition caption,
 * the fact card and the destination caption.
 */
export function LaunchSequence() {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const finishLaunch = useOnboardingStore((state) => state.finishLaunch)
  const destinationId =
    useJourneyStore((state) => state.save?.currentDestination) ?? 'mars'
  const destination = getDestination(destinationId)
  const carrierName = useJourneyStore(
    (state) => state.save?.playerName ?? 'carrier',
  )
  const setPipTalking = useOnboardingStore((state) => state.setPipTalking)
  const [elapsed, setElapsed] = useState(0)
  const finishedRef = useRef(false)
  const previousStageRef = useRef<LaunchStageId | null>(null)
  const previousCountdownRef = useRef<string | null>(null)

  const duration = launchTimeline(reducedMotion).duration
  const { stage } = stageAt(elapsed, reducedMotion)
  const countdown = countdownLabel(elapsed, reducedMotion)
  const showFact = showEscapeVelocityFact(elapsed, reducedMotion)

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    launchClock.value = 0
    finishLaunch()
  }, [finishLaunch])

  const skipLaunch = useCallback(() => {
    emitAudio('launchSkipped')
    finish()
  }, [finish])

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
  }, [duration, finish])

  useEffect(() => {
    speakPip(LAUNCH_CABIN_LINE, voiceEnabled)
  }, [voiceEnabled])

  useEffect(() => {
    if (previousStageRef.current === stage) return
    previousStageRef.current = stage
    switch (stage) {
      case 'ignition':
        emitAudio('launchIgnition')
        break
      case 'liftoff':
        emitAudio('launchLiftoff')
        break
      case 'space':
        emitAudio('launchSpaceTransition')
        break
      case 'arrive':
        emitAudio('launchArrived')
        break
      default:
        break
    }
  }, [stage])

  useEffect(() => {
    if (countdown && countdown !== previousCountdownRef.current) {
      previousCountdownRef.current = countdown
      emitAudio('launchCountdown')
    }
  }, [countdown])

  useEffect(() => {
    setPipTalking(inCabinStage(elapsed, reducedMotion))
    return () => setPipTalking(false)
  }, [elapsed, reducedMotion, setPipTalking])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        skipLaunch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [skipLaunch])

  return (
    <section className="launch" aria-label="Launch sequence">
      <div className="launch__vignette" aria-hidden="true" />
      {/* White flash that covers the cut from the cabin to the exterior. */}
      <div
        className="launch__flash"
        aria-hidden="true"
        style={{ opacity: liftoffFlash(elapsed, reducedMotion) }}
      />

      {inCabinStage(elapsed, reducedMotion) && (
        <p className="launch__caption pip-bubble-wrap-like">
          <PipAvatar />{' '}
          <span>
            <strong>PIP:</strong> {LAUNCH_CABIN_LINE}
          </span>
        </p>
      )}

      {countdown && (
        <p key={countdown} className="launch__countdown" aria-live="assertive">
          {countdown}
        </p>
      )}

      {showFact && (
        <p className="launch__fact">
          <span className="launch__fact-glyph" aria-hidden="true">
            ✦
          </span>{' '}
          {ESCAPE_VELOCITY_FACT}
        </p>
      )}

      {(stage === 'accelerate' || stage === 'arrive') && (
        <p className="launch__destination">
          Next stop: <strong>{destination.name}</strong> · {carrierName}
        </p>
      )}

      <button type="button" className="launch__skip" onClick={skipLaunch} autoFocus>
        Skip ▸
      </button>
    </section>
  )
}
