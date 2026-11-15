import { useEffect, useRef, useState } from 'react'
import { hasPriorFieldWork, needsArrivalBriefing } from '../data/arrivalProtocol'
import {
  BRIEFING_CARDS,
  BRIEFING_TITLE,
  briefingStep,
  isLastBriefingStep,
  learnedTools,
  nextBriefingIndex,
  type BriefingTool,
} from '../data/marsBriefing'
import { SPIRIT_SITE } from '../data/spiritSite'
import { isCoarsePointer } from '../game/missionNarrative'
import { speakPip, stopPipVoice } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { PipAvatar } from './PipSpeech'
import { useAdvanceAnywhere } from './useAdvanceAnywhere'
import './marsBriefing.css'

/**
 * After the landing-site title, a short breath to take in the landscape
 * before PIP starts talking.
 */
const OPENING_DELAY_MS = 1600

/**
 * Guided Mars arrival: PIP's welcome, the signal, the radar, then the
 * two-card tutorial (Radar, Scanner). The world stays paused and each
 * step waits for one clear action, so a child never misses a line.
 */
export function MarsBriefing() {
  const save = useJourneyStore((state) => state.save)
  const flags = useNarrativeStore((state) => state.protocol)
  const progress = save?.missions[SPIRIT_SITE.missionId] ?? null
  const needed =
    save !== null &&
    needsArrivalBriefing({
      progress,
      flags,
      priorFieldWork: hasPriorFieldWork(save, SPIRIT_SITE.missionId),
    })

  const [index, setIndex] = useState(0)
  const [opened, setOpened] = useState(false)
  // The landing-site title comes first.
  const arrived = useGameStore((state) => state.arrivalStage === 'done')

  useEffect(() => {
    if (!needed || !arrived) return
    const timer = window.setTimeout(() => setOpened(true), OPENING_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [needed, arrived])

  const active = needed && opened
  const step = briefingStep(index)

  // Publish the step: pauses the world, hides the HUD, drives PIP's face.
  // The radar flag is ephemeral; once PIP shows it, it stays on screen.
  useEffect(() => {
    const game = useGameStore.getState()
    game.setMarsBriefingStep(active ? step.id : null)
    if (active && step.showRadar && !useNarrativeStore.getState().protocol.radarShown) {
      useNarrativeStore.getState().markProtocol('radarShown')
    }
  }, [active, step])
  useEffect(() => () => useGameStore.getState().setMarsBriefingStep(null), [])

  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  useEffect(() => {
    if (!active) return
    speakPip(step.line, voiceEnabled, step.expression)
  }, [active, step, voiceEnabled])
  useEffect(() => () => stopPipVoice(), [])

  const advance = (action: Parameters<typeof nextBriefingIndex>[1]) => {
    if (action.kind === 'button' && isLastBriefingStep(index)) {
      stopPipVoice()
      useNarrativeStore.getState().markProtocol('briefed')
      return
    }
    setIndex((current) => nextBriefingIndex(current, action))
  }

  // A click anywhere (or Space / Enter): first finishes PIP's typing, then
  // works like the step's button (PIP opens the next card himself).
  const [typed, setTyped] = useState(false)
  const [skipNonce, setSkipNonce] = useState(0)
  const [seenStep, setSeenStep] = useState(step.id)
  if (seenStep !== step.id) {
    setSeenStep(step.id)
    setTyped(false)
    setSkipNonce(0)
  }
  const advanceAnywhere = () => {
    if (!typed) {
      setSkipNonce((nonce) => nonce + 1)
      return
    }
    if (step.cta) advance({ kind: 'button' })
  }
  useAdvanceAnywhere(
    active && (!typed || Boolean(step.cta)),
    advanceAnywhere,
    step.id,
  )

  if (!active) return null

  const pipLine = (
    <BriefingPipLine
      key={step.id}
      text={step.line}
      cta={step.cta}
      onCta={() => advance({ kind: 'button' })}
      skipNonce={skipNonce}
      onTyped={() => setTyped(true)}
    />
  )

  if (step.view === 'pip') {
    return (
      <div className="mars-briefing mars-briefing--pip" data-step={step.id}>
        {pipLine}
      </div>
    )
  }

  const learned = learnedTools(index)
  return (
    <div className="mars-briefing mars-briefing--panel" data-step={step.id}>
      <section className="briefing-panel" role="dialog" aria-modal="true" aria-label="Exploration tutorial">
        <header className="briefing-panel__head">
          <h2 className="briefing-panel__title">{BRIEFING_TITLE}</h2>
          <div
            className="briefing-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(step.progress * 100)}
            aria-label="Tutorial progress"
          >
            <span style={{ width: `${step.progress * 100}%` }} />
          </div>
        </header>

        {step.view === 'tools' ? (
          <div className="briefing-tools">
            {(['radar', 'scanner'] as const).map((tool) => (
              <ToolCard
                key={tool}
                tool={tool}
                learned={learned.includes(tool)}
                target={step.focus === tool}
                locked={
                  step.focus !== undefined &&
                  step.focus !== tool &&
                  !learned.includes(tool)
                }
                onPick={() => advance({ kind: 'card', tool })}
              />
            ))}
          </div>
        ) : (
          <ToolDetail tool={step.view} />
        )}

        {pipLine}
      </section>
    </div>
  )
}

function ToolCard({
  tool,
  learned,
  target,
  locked,
  onPick,
}: {
  tool: BriefingTool
  learned: boolean
  target: boolean
  locked: boolean
  onPick: () => void
}) {
  const card = BRIEFING_CARDS[tool]
  return (
    <button
      type="button"
      className={`briefing-card${target ? ' is-target' : ''}${learned ? ' is-learned' : ''}`}
      disabled={!target}
      aria-disabled={!target}
      onClick={onPick}
      data-locked={locked || undefined}
    >
      <span className="briefing-card__art" aria-hidden="true">
        {tool === 'radar' ? <RadarArt /> : <ScannerArt />}
      </span>
      <span className="briefing-card__title">{card.title}</span>
      <span className="briefing-card__summary">{card.summary}</span>
      {learned && <span className="briefing-card__badge">✓ Learned</span>}
      {target && <span className="briefing-card__badge briefing-card__badge--tap">Up next</span>}
    </button>
  )
}

function ToolDetail({ tool }: { tool: BriefingTool }) {
  const card = BRIEFING_CARDS[tool]
  const touch = isCoarsePointer()
  return (
    <article className={`briefing-detail briefing-detail--${tool}`}>
      <div className="briefing-detail__art" aria-hidden="true">
        {tool === 'radar' ? <RadarArt animated /> : <ScannerArt animated />}
      </div>
      <div className="briefing-detail__copy">
        <h3 className="briefing-detail__title">{card.title}</h3>
        <ol className="briefing-tips">
          {card.tips.map((tip, at) => (
            <li key={tip.text} className="briefing-tip">
              <span className="briefing-tip__number">{at + 1}</span>
              <span className="briefing-tip__text">
                {tip.key && (
                  <kbd className="briefing-key">{touch ? tip.key.touch : tip.key.desktop}</kbd>
                )}
                {tip.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  )
}

/** PIP's line inside the briefing: avatar, typed text, one clear action. */
function BriefingPipLine({
  text,
  cta,
  onCta,
  hint,
  skipNonce,
  onTyped,
}: {
  text: string
  cta?: string
  onCta: () => void
  hint?: string
  /** Bumped by a click anywhere: show the whole line at once. */
  skipNonce: number
  onTyped: () => void
}) {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const [shown, setShown] = useState(reducedMotion ? text.length : 0)
  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => {
      setShown((current) => (current >= text.length ? current : current + 1))
    }, 26)
    return () => window.clearInterval(timer)
  }, [text, reducedMotion])
  const [seenSkip, setSeenSkip] = useState(skipNonce)
  if (seenSkip !== skipNonce) {
    setSeenSkip(skipNonce)
    if (skipNonce !== 0) setShown(text.length)
  }
  const done = shown >= text.length
  const onTypedRef = useRef(onTyped)
  useEffect(() => {
    onTypedRef.current = onTyped
  }, [onTyped])
  useEffect(() => {
    if (done) onTypedRef.current()
  }, [done])
  const touch = isCoarsePointer()
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="briefing-pip" role="status" aria-live="polite">
      <PipAvatar />
      <div className="briefing-pip__copy">
        <p className="briefing-pip__name">PIP</p>
        <p className="briefing-pip__text">
          <span>{text.slice(0, shown)}</span>
          <span className="briefing-pip__ghost" aria-hidden="true">
            {text.slice(shown)}
          </span>
        </p>
      </div>
      {cta ? (
        <div className="briefing-cta-wrap">
          <button ref={buttonRef} type="button" className="briefing-cta" onClick={onCta}>
            {cta}
          </button>
          <span className="briefing-anywhere" aria-hidden="true">
            or {touch ? 'tap' : 'click'} anywhere
          </span>
        </div>
      ) : (
        hint && (
          <span className="briefing-hint">
            <span className="briefing-hint__dot" />
            {hint}
          </span>
        )
      )}
    </div>
  )
}

/**
 * Mini radar, drawn like the real minimap: the arrow in the middle is the
 * child, the star is where to go and the soft cone is where they look.
 * Animated: the map turns until the star is on top, then the star comes
 * down to the arrow, as when walking straight to it.
 */
function RadarArt({ animated = false }: { animated?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={`briefing-radar${animated ? ' is-animated' : ''}`}>
      <defs>
        <radialGradient id="briefing-radar-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7d6158" />
          <stop offset="100%" stopColor="#4a3934" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="url(#briefing-radar-bg)" stroke="#f2cdb4" strokeWidth="3" />
      <circle cx="60" cy="60" r="32" fill="none" stroke="rgba(242,205,180,0.22)" />
      <path d="M60 60 L40 15 A48 48 0 0 1 80 15 Z" fill="rgba(242,205,180,0.13)" />
      <g className="briefing-radar__turn">
        <g className="briefing-radar__signal">
          <circle cx="60" cy="22" r="10" className="briefing-radar__halo" />
          <path
            d="M60 13.5 L62.6 19.4 L68.9 19.4 L63.8 23.4 L65.6 29.5 L60 25.9 L54.4 29.5 L56.2 23.4 L51.1 19.4 L57.4 19.4 Z"
            fill="#f47b38"
            stroke="#f2cdb4"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <path d="M60 50 L67 66 L60 62 L53 66 Z" fill="#f2cdb4" stroke="#3a2b27" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

/** Mini scanner: the device, its beam and a glowing rock filling a ring. */
function ScannerArt({ animated = false }: { animated?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={`briefing-scanner${animated ? ' is-animated' : ''}`}>
      <ellipse cx="88" cy="96" rx="22" ry="5" fill="rgba(10,4,16,0.45)" />
      <g className="briefing-scanner__target">
        <circle cx="88" cy="80" r="21" fill="none" stroke="rgba(143,227,216,0.18)" strokeWidth="4" />
        <circle
          cx="88"
          cy="80"
          r="21"
          fill="none"
          stroke="#8fe3d8"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          className="briefing-scanner__ring"
          transform="rotate(-90 88 80)"
        />
        <path d="M74 90 L80 70 L92 66 L102 78 L98 92 Z" fill="#c9704a" stroke="#ffd9a8" strokeWidth="1.5" />
        <path d="M82 72 L92 68 L96 76" fill="none" stroke="#ffd9a8" strokeWidth="1.2" opacity="0.7" />
      </g>
      <path d="M44 50 L76 66 L70 84 Z" className="briefing-scanner__beam" />
      <g transform="rotate(24 30 46)">
        <rect x="8" y="34" width="44" height="24" rx="8" fill="#e9e1ea" stroke="#33203f" strokeWidth="2" />
        <rect x="14" y="39" width="20" height="14" rx="4" fill="#1b1029" />
        <path d="M18 46 h12" stroke="#8fe3d8" strokeWidth="2" strokeLinecap="round" className="briefing-scanner__screen" />
        <circle cx="44" cy="46" r="4" fill="#8fe3d8" />
        <rect x="18" y="56" width="12" height="22" rx="5" fill="#f28a3c" stroke="#33203f" strokeWidth="2" />
      </g>
    </svg>
  )
}
