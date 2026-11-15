import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDestination } from '../data/destinations'
import type { MissionDefinition } from '../data/missions'
import { pipLine } from '../data/pipVoiceCatalog'
import { audioManager } from '../game/audio/audioManager'
import { emitAudio } from '../game/audio/audioEvents'
import { speakPip, stopPipVoice } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { PipAvatar } from './PipSpeech'

/**
 * The explorer's story, full screen, as one continuous moment:
 *
 *   connecting → video → record saved → sending → delivered
 *
 * 1. An incoming-transmission screen (PIP narrates the video, so the
 *    archive "opens a line" first).
 * 2. The story video, edge to edge. It ends on its own "Record saved".
 * 3. Right there the child taps "Send to Earth": the record flies from the
 *    planet to Earth and the explorer's stamp appears. The real, idempotent
 *    transmission is saved the moment the record leaves.
 *
 * All screens are tech screens (no paper). Replays skip the sending part.
 */

type Phase = 'connecting' | 'video' | 'record' | 'sending' | 'delivered'

const CONNECT_MS = 3400
const FLIGHT_MS = 4300

const TEXTURES = `${import.meta.env.BASE_URL}textures/`
const PLANET_TEXTURE: Record<string, string> = {
  mars: `${TEXTURES}mars/mars-color.jpg`,
  moon: `${TEXTURES}moon/moon-color.jpg`,
}
const EARTH_TEXTURE = `${TEXTURES}earth/earth-day.jpg`

/** Flight route (cubic Bézier in the 1600×900 stage): planet → Earth. */
const ROUTE = [
  [430, 530],
  [640, 140],
  [960, 90],
  [1170, 300],
] as const
const HOLD_S = 0.7
const FLY_S = 2.9
const SPARK_LAGS = [0.12, 0.24, 0.36] as const

function routePoint(t: number): [number, number] {
  const u = 1 - t
  const [a, b, c, d] = ROUTE
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ]
}

/** Soft start, soft landing. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export function StoryTransmission({
  mission,
  onClose,
}: {
  mission: MissionDefinition & { reconstruction: { video?: string } }
  onClose: () => void
}) {
  const video = mission.reconstruction.video!
  const save = useJourneyStore((state) => state.save)
  const transmit = useJourneyStore((state) => state.transmit)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const masterVolume = useGameStore((state) => state.masterVolume)
  const muted = useGameStore((state) => state.muted)
  const phaseOnboarding = useOnboardingStore((state) => state.phase)
  const onMars = phaseOnboarding === 'playing'

  // A replay (already delivered) never shows the sending part again.
  const [alreadySent] = useState(
    () => save?.missions[mission.id]?.transmittedAt != null,
  )
  const [phase, setPhase] = useState<Phase>('connecting')
  const [failed, setFailed] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const capsuleRef = useRef<SVGGElement>(null)
  const sparkRefs = useRef<(SVGCircleElement | null)[]>([])
  const destination = getDestination(mission.destination)
  const planetTexture = PLANET_TEXTURE[mission.destination] ?? PLANET_TEXTURE.mars

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    stopPipVoice()
    return () => {
      if (dialog?.open) dialog.close()
      audioManager.setVideoActive(false)
      stopPipVoice()
    }
  }, [])

  // 1. Incoming transmission, then the video.
  useEffect(() => {
    if (phase !== 'connecting') return
    emitAudio('transmissionSignal')
    const timer = window.setTimeout(
      () => setPhase('video'),
      reducedMotion ? 900 : CONNECT_MS,
    )
    return () => window.clearTimeout(timer)
  }, [phase, reducedMotion])

  // 2. The video: game music and wind go quiet while it plays.
  useEffect(() => {
    if (phase !== 'video') {
      audioManager.setVideoActive(false)
      return
    }
    audioManager.setVideoActive(true)
    const element = videoRef.current
    element?.focus()
    void element?.play().catch(() => {
      // Autoplay refused: the native controls let the child start it.
    })
  }, [phase])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    element.volume = Math.min(1, Math.max(0, masterVolume))
    element.muted = muted
  }, [masterVolume, muted, phase])

  // 3. PIP's lines after the video.
  useEffect(() => {
    const key =
      phase === 'record' && !alreadySent
        ? 'story-send-ready'
        : phase === 'delivered'
          ? 'story-delivered'
          : null
    if (!key) return
    speakPip(pipLine(key), voiceName, voiceEnabled, 'excited')
    const frame = window.requestAnimationFrame(() => actionRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [phase, alreadySent, voiceName, voiceEnabled])

  const endVideo = useCallback(() => {
    setPhase((current) => (current === 'video' ? 'record' : current))
  }, [])

  /** The real, idempotent transmission: saved as soon as the record flies. */
  const send = () => {
    const result = transmit(mission.id)
    if (
      !result ||
      (result.status !== 'transmitted' &&
        result.status !== 'already-transmitted')
    ) {
      emitAudio('uiError')
      setFailed(true)
      return
    }
    setFailed(false)
    stopPipVoice()
    emitAudio('transmissionStarted')
    setPhase('sending')
  }

  // The record's flight: a tiny rAF loop moves the capsule and its sparks.
  useEffect(() => {
    if (phase !== 'sending' || reducedMotion) return
    const start = performance.now()
    let frame = 0
    const place = (node: SVGElement | null, delay: number, now: number) => {
      if (!node) return
      const k = Math.min(1, Math.max(0, ((now - start) / 1000 - HOLD_S - delay) / FLY_S))
      const [x, y] = routePoint(ease(k))
      node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
    }
    const step = (now: number) => {
      place(capsuleRef.current, 0, now)
      SPARK_LAGS.forEach((lag, index) => place(sparkRefs.current[index] ?? null, lag, now))
      if ((now - start) / 1000 < HOLD_S + FLY_S + 0.5) {
        frame = window.requestAnimationFrame(step)
      }
    }
    frame = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frame)
  }, [phase, reducedMotion])

  useEffect(() => {
    if (phase !== 'sending') return
    const arrive = window.setTimeout(
      () => emitAudio('transmissionReceived'),
      reducedMotion ? 300 : FLIGHT_MS - 900,
    )
    const done = window.setTimeout(
      () => {
        emitAudio('transmissionCompleted')
        setPhase('delivered')
      },
      reducedMotion ? 800 : FLIGHT_MS,
    )
    return () => {
      window.clearTimeout(arrive)
      window.clearTimeout(done)
    }
  }, [phase, reducedMotion])

  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => ({
        left: (index * 37) % 100,
        delay: (index % 7) * 0.09,
        drift: ((index * 53) % 60) - 30,
        hue: ['#ffd9a8', '#8fe3d8', '#f4b4df', '#9be7b0'][index % 4],
      })),
    [],
  )

  return (
    <dialog
      ref={dialogRef}
      className="story-tx"
      data-phase={phase}
      aria-label={`${mission.machineName}'s story`}
      onCancel={(event) => {
        event.preventDefault()
        if (phase === 'video') endVideo()
        else if (phase === 'delivered' || alreadySent) onClose()
      }}
    >
      {phase === 'connecting' && (
        <div className="story-tx__connect" role="status">
          <div className="story-tx__grid" aria-hidden="true" />
          <div className="story-tx__dish" aria-hidden="true">
            <span />
            <span />
            <span />
            <b>✦</b>
          </div>
          <p className="story-tx__eyebrow">Incoming transmission</p>
          <h2 className="story-tx__title">{mission.machineName}'s story</h2>
          <div className="story-tx__bar" aria-hidden="true">
            <i />
          </div>
          <p className="story-tx__pip">
            <PipAvatar /> PIP is on the line
          </p>
        </div>
      )}

      {(phase === 'video' || phase === 'record') && (
        <div className="story-tx__video">
          <video
            ref={videoRef}
            src={`${import.meta.env.BASE_URL}${video}`}
            controls={phase === 'video'}
            playsInline
            preload="auto"
            controlsList="nodownload noplaybackrate nofullscreen"
            disablePictureInPicture
            onEnded={endVideo}
          />
          {phase === 'video' && (
            <button type="button" className="story-tx__skip" onClick={endVideo}>
              Skip ▸
            </button>
          )}
        </div>
      )}

      {phase === 'record' && (
        <div className="story-tx__panel" role="status">
          <p className="story-tx__pip-line">
            <PipAvatar />
            <span>
              <strong>PIP</strong>{' '}
              {alreadySent
                ? `${mission.machineName}'s story is already safe on Earth.`
                : pipLine('story-send-ready')}
            </span>
          </p>
          {failed && (
            <p className="story-tx__error">
              The signal slipped. Try again!
            </p>
          )}
          <div className="story-tx__actions">
            {alreadySent ? (
              <>
                <button
                  ref={actionRef}
                  type="button"
                  className="story-tx__btn story-tx__btn--main"
                  onClick={onClose}
                >
                  {onMars ? 'Back to Mars' : 'Done'}
                </button>
                <button
                  type="button"
                  className="story-tx__btn"
                  onClick={() => setPhase('connecting')}
                >
                  ↻ Watch again
                </button>
              </>
            ) : (
              <button
                ref={actionRef}
                type="button"
                className="story-tx__btn story-tx__btn--send"
                onClick={send}
              >
                <span aria-hidden="true">🚀</span> Send to Earth
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'sending' && (
        <div className="story-tx__space" role="status" aria-live="polite">
          {/* A 16:9 stage that covers the screen; planets are plain
              divs (cheap to draw), the SVG only holds the route. */}
          <div className="story-tx__stage" aria-hidden="true">
            <span
              className="story-tx__planet story-tx__planet--from"
              style={{ backgroundImage: `url(${planetTexture})` }}
            />
            <span
              className="story-tx__planet story-tx__planet--earth"
              style={{ backgroundImage: `url(${EARTH_TEXTURE})` }}
            />
            <span className="story-tx__catch" />
            <svg className="story-tx__sky" viewBox="0 0 1600 900">
              <defs>
                <radialGradient id="tx-glow">
                  <stop offset="0%" stopColor="#fff7e6" />
                  <stop offset="45%" stopColor="#ffd9a8" />
                  <stop offset="100%" stopColor="#ffb27a" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path
                id="tx-route"
                className="story-tx__route"
                d={`M ${ROUTE[0].join(' ')} C ${ROUTE[1].join(' ')}, ${ROUTE[2].join(' ')}, ${ROUTE[3].join(' ')}`}
                pathLength="1"
              />
              {SPARK_LAGS.map((lag, index) => (
                <circle
                  key={lag}
                  ref={(node) => {
                    sparkRefs.current[index] = node
                  }}
                  r={6 - index * 1.4}
                  className="story-tx__spark"
                  opacity={reducedMotion ? 0 : 0.75 - index * 0.18}
                  transform={`translate(${ROUTE[0][0]} ${ROUTE[0][1]})`}
                />
              ))}
              <g
                ref={capsuleRef}
                className="story-tx__capsule"
                transform={
                  reducedMotion
                    ? `translate(${ROUTE[3][0]} ${ROUTE[3][1]})`
                    : `translate(${ROUTE[0][0]} ${ROUTE[0][1]})`
                }
              >
                <circle r="46" fill="url(#tx-glow)" />
                <circle r="16" fill="#fff7e6" />
                <text y="6" textAnchor="middle" className="story-tx__capsule-star">
                  ✦
                </text>
              </g>
            </svg>
          </div>
          <p className="story-tx__flight-label">
            <span className="story-tx__flight-out">
              Sending {mission.machineName}'s story from {destination.name}…
            </span>
            <span className="story-tx__flight-in">Received on Earth!</span>
          </p>
        </div>
      )}

      {phase === 'delivered' && (
        <div className="story-tx__delivered" role="status">
          <div className="story-tx__confetti" aria-hidden="true">
            {!reducedMotion &&
              confetti.map((piece, index) => (
                <i
                  key={index}
                  style={{
                    left: `${piece.left}%`,
                    background: piece.hue,
                    animationDelay: `${piece.delay}s`,
                    ['--drift' as string]: `${piece.drift}px`,
                  }}
                />
              ))}
          </div>
          <p className="story-tx__eyebrow">Delivered to Earth</p>
          <div
            className="story-tx__stamp"
            role="img"
            aria-label={`New stamp: ${mission.stampLabel}`}
          >
            <span
              className="story-tx__stamp-planet"
              style={{ backgroundImage: `url(${planetTexture})` }}
              aria-hidden="true"
            />
            <span className="story-tx__stamp-name">{mission.machineName}</span>
            <span className="story-tx__stamp-place">{destination.name}</span>
            <span className="story-tx__stamp-word">✦ Stamp earned ✦</span>
          </div>
          <p className="story-tx__pip-line">
            <PipAvatar />
            <span>
              <strong>PIP</strong> {pipLine('story-delivered')}
            </span>
          </p>
          <button
            ref={actionRef}
            type="button"
            className="story-tx__btn story-tx__btn--main"
            onClick={onClose}
          >
            {onMars ? 'Back to Mars' : 'Done'}
          </button>
        </div>
      )}
    </dialog>
  )
}

