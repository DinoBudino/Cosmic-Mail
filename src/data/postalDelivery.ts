/**
 * Pure state machine for the physical postal delivery aboard Mailwing:
 * seal the letter, load the capsule into the transmission slot, send it
 * toward Earth, watch it depart, then stamp the passport.
 *
 * The ceremony is presentation only. The single persisted effect is
 * `transmitLetter` (through journeyStore.transmit), which the UI issues
 * exactly once on the `send` step; it is idempotent, so reloading, repeating
 * or double-pressing during the animation can never duplicate the delivery
 * or the stamp. A save that is already transmitted starts at `done`.
 */

export const DELIVERY_STEPS = [
  'seal',
  'load',
  'send',
  'departing',
  'stamp',
  'done',
] as const
export type DeliveryStep = (typeof DELIVERY_STEPS)[number]

export type DeliveryEvent =
  | 'sealed'
  | 'loaded'
  | 'sent'
  | 'departed'
  | 'stamped'

export interface DeliveryState {
  step: DeliveryStep
}

const NEXT: Readonly<Record<DeliveryEvent, readonly [DeliveryStep, DeliveryStep]>> =
  {
    sealed: ['seal', 'load'],
    loaded: ['load', 'send'],
    sent: ['send', 'departing'],
    departed: ['departing', 'stamp'],
    stamped: ['stamp', 'done'],
  }

export function createDelivery(alreadyTransmitted: boolean): DeliveryState {
  return { step: alreadyTransmitted ? 'done' : 'seal' }
}

/**
 * Advances one step. An event that does not match the current step is
 * ignored and returns the same state object, so steps cannot be skipped or
 * repeated.
 */
export function advanceDelivery(
  state: DeliveryState,
  event: DeliveryEvent,
): DeliveryState {
  const [from, to] = NEXT[event]
  return state.step === from ? { step: to } : state
}

/** True while the ceremony is running (not at the start, not finished). */
export function isDeliveryInProgress(state: DeliveryState | null): boolean {
  return state !== null && state.step !== 'done'
}

/** Whether the letter has physically left Mailwing. */
export function hasCapsuleDeparted(state: DeliveryState): boolean {
  return DELIVERY_STEPS.indexOf(state.step) > DELIVERY_STEPS.indexOf('send')
}
