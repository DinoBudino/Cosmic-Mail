/**
 * One consistent status word for the scanner reticle, so the label under the
 * crosshair always says the same thing as the rest of the HUD. Pure rules.
 */

export type ReticleStatus =
  | 'scanning'
  | 'out-of-range'
  | 'blocked'
  | 'recorded'
  | 'ready'
  /** A part further down the hunt: the next one comes first. */
  | 'later'
  | null

export interface ReticleStatusInput {
  hasTarget: boolean
  physicalState: 'idle' | 'valid' | 'out-of-range' | 'occluded'
  triggerHeld: boolean
  recorded: boolean
  /** The aimed part is not the next one in the hunt. */
  later?: boolean
}

export function getReticleStatus(input: ReticleStatusInput): ReticleStatus {
  // Range and line of sight describe the world, so they win over the rest.
  if (input.physicalState === 'out-of-range') return 'out-of-range'
  if (input.physicalState === 'occluded') return 'blocked'
  if (!input.hasTarget) return null
  if (input.recorded) return 'recorded'
  if (input.later) return 'later'
  if (input.triggerHeld) return 'scanning'
  return 'ready'
}

export const RETICLE_STATUS_LABEL: Readonly<
  Record<Exclude<ReticleStatus, null>, string>
> = {
  scanning: 'Scanning…',
  'out-of-range': 'Out of range',
  blocked: 'Blocked',
  recorded: 'Recorded',
  ready: 'Hold to scan',
  later: 'Not yet',
}
