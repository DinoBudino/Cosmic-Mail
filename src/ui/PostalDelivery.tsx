import { useEffect, useRef } from 'react'
import {
  DELIVERY_STEPS,
  hasCapsuleDeparted,
  type DeliveryEvent,
  type DeliveryState,
  type DeliveryStep,
} from '../data/postalDelivery'
import {
  TRANSMISSION_DESTINATION,
  TRANSMISSION_SUCCESS_LINE,
} from '../data/onboardingNarrative'
import { emitAudio } from '../game/audio/audioEvents'
import { useHoldAction } from './useHoldAction'

const SEAL_HOLD_SECONDS = 0.8
const DEPARTURE_MS = 1800

const STEP_LABEL: Partial<Record<DeliveryStep, string>> = {
  seal: 'Seal',
  load: 'Load',
  send: 'Send',
  stamp: 'Stamp',
}

/** Steps shown in the tracker; `departing` is part of `send`. */
const TRACKER: readonly DeliveryStep[] = ['seal', 'load', 'send', 'stamp']

function trackerState(
  tracker: DeliveryStep,
  current: DeliveryStep,
): 'done' | 'active' | 'pending' {
  const order = (step: DeliveryStep) =>
    DELIVERY_STEPS.indexOf(step === 'departing' ? 'send' : step)
  const mine = order(tracker)
  const now =
    current === 'departing' ? DELIVERY_STEPS.indexOf('stamp') : order(current)
  if (current === 'done') return 'done'
  if (mine < now) return 'done'
  return mine === now ? 'active' : 'pending'
}

function SealButton({
  reducedMotion,
  onSealed,
}: {
  reducedMotion: boolean
  onSealed: () => void
}) {
  const { progress, handlers } = useHoldAction({
    seconds: SEAL_HOLD_SECONDS,
    reducedMotion,
    disabled: false,
    onComplete: onSealed,
  })
  return (
    <button
      type="button"
      className="archive-action archive-action--primary postal__seal"
      style={{ ['--seal-progress' as string]: progress }}
      data-postal-primary
      {...handlers}
    >
      {reducedMotion
        ? 'Seal the letter'
        : 'Hold to press the wax seal'}
    </button>
  )
}

/**
 * The physical delivery aboard Mailwing. Each step is an action by the
 * carrier: seal the letter, load the capsule, send it, stamp the passport.
 * It is presentation only; `onSend` performs the single idempotent
 * transmission and the stamp shown here is derived from that result.
 */
export function PostalDelivery({
  delivery,
  stampLabel,
  reducedMotion,
  onAdvance,
  onSend,
}: {
  delivery: DeliveryState
  stampLabel: string
  reducedMotion: boolean
  onAdvance: (event: DeliveryEvent) => void
  /** Performs the real transmission. Returns true when it succeeded. */
  onSend: () => boolean
}) {
  const step = delivery.step
  const stageRef = useRef<HTMLDivElement>(null)

  // Move focus to the new primary action after each step.
  useEffect(() => {
    stageRef.current
      ?.querySelector<HTMLElement>('[data-postal-primary]')
      ?.focus()
  }, [step])

  // The capsule travels for a moment, then the passport can be stamped.
  useEffect(() => {
    if (step !== 'departing') return
    const timer = window.setTimeout(() => onAdvance('departed'), DEPARTURE_MS)
    return () => window.clearTimeout(timer)
  }, [step, onAdvance])

  const handleSend = () => {
    if (step !== 'send') return
    if (!onSend()) return
    onAdvance('sent')
    // Reduced motion: no flight animation, but the player still stamps.
    if (reducedMotion) onAdvance('departed')
  }

  const departed = hasCapsuleDeparted(delivery)

  return (
    <section className="postal" aria-labelledby="postal-title">
      <h3 id="postal-title">Deliver to {TRANSMISSION_DESTINATION}</h3>

      <ol className="postal__tracker" aria-label="Delivery steps">
        {TRACKER.map((tracked) => {
          const state = trackerState(tracked, step)
          return (
            <li
              key={tracked}
              className={`postal__tracker-step is-${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {STEP_LABEL[tracked]}
              <span className="postal__sr">
                {state === 'done' ? ' (done)' : ''}
              </span>
            </li>
          )
        })}
      </ol>

      <div ref={stageRef} className="postal__stage" data-step={step}>
        <div className="postal__scene" aria-hidden="true">
          <span
            className={`postal__letter${
              step === 'seal' ? '' : ' is-sealed'
            }${departed ? ' is-gone' : ''}`}
          >
            ✉
          </span>
          <span className="postal__slot">transmission slot</span>
          <span
            className={`postal__capsule${
              step === 'load' || step === 'send' ? ' is-loaded' : ''
            }${step === 'departing' ? ' is-departing' : ''}${
              step === 'seal' || departed ? '' : ' is-visible'
            }`}
          />
          <span className="postal__earth">Earth</span>
        </div>

        {step === 'seal' && (
          <SealButton
            reducedMotion={reducedMotion}
            onSealed={() => {
              emitAudio('postalSealed')
              onAdvance('sealed')
            }}
          />
        )}

        {step === 'load' && (
          <button
            type="button"
            className="archive-action archive-action--primary"
            data-postal-primary
            onClick={() => {
              emitAudio('uiConfirm')
              onAdvance('loaded')
            }}
          >
            Load the capsule into the transmission slot
          </button>
        )}

        {step === 'send' && (
          <button
            type="button"
            className="archive-action archive-action--primary"
            data-postal-primary
            onClick={handleSend}
          >
            Send the capsule to Earth
          </button>
        )}

        {step === 'departing' && (
          <p className="postal__status" role="status">
            The capsule is on its way to the Earth Cosmic Archive…
          </p>
        )}

        {(step === 'stamp' || step === 'done') && (
          <div className="postal__passport">
            <span className="postal__passport-label">Mission album</span>
            {step === 'done' ? (
              <div
                className={`smart-letter__stamp${
                  reducedMotion ? '' : ' is-just-sealed'
                }`}
                role="img"
                aria-label={`Archive stamp: ${stampLabel}`}
              >
                <span className="smart-letter__stamp-star" aria-hidden="true">
                  ✦
                </span>
                <span className="smart-letter__stamp-label">{stampLabel}</span>
                <span className="smart-letter__stamp-word">TRANSMITTED</span>
              </div>
            ) : (
              <button
                type="button"
                className="archive-action archive-action--primary"
                data-postal-primary
                onClick={() => {
                  emitAudio('passportStamped')
                  onAdvance('stamped')
                }}
              >
                Stamp your mission album
              </button>
            )}
          </div>
        )}

        {step === 'done' && (
          <p className="postal__status postal__status--done" role="status">
            {TRANSMISSION_SUCCESS_LINE}
          </p>
        )}
      </div>
    </section>
  )
}
