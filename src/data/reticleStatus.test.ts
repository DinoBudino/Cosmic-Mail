import { describe, expect, it } from 'vitest'
import {
  RETICLE_STATUS_LABEL,
  getReticleStatus,
  type ReticleStatusInput,
} from './reticleStatus'

const base: ReticleStatusInput = {
  hasTarget: true,
  physicalState: 'valid',
  triggerHeld: false,
  wrongLens: false,
  recorded: false,
}

describe('reticle status', () => {
  it('has no status without a target', () => {
    expect(getReticleStatus({ ...base, hasTarget: false })).toBeNull()
  })

  it('reports ready, scanning, wrong lens and recorded', () => {
    expect(getReticleStatus(base)).toBe('ready')
    expect(getReticleStatus({ ...base, triggerHeld: true })).toBe('scanning')
    expect(getReticleStatus({ ...base, wrongLens: true })).toBe('wrong-lens')
    expect(getReticleStatus({ ...base, recorded: true })).toBe('recorded')
  })

  it('does not claim scanning while the lens is wrong', () => {
    expect(
      getReticleStatus({ ...base, wrongLens: true, triggerHeld: true }),
    ).toBe('wrong-lens')
  })

  it('range and line of sight win, even with no target', () => {
    expect(getReticleStatus({ ...base, physicalState: 'out-of-range' })).toBe(
      'out-of-range',
    )
    expect(
      getReticleStatus({
        ...base,
        hasTarget: false,
        physicalState: 'occluded',
      }),
    ).toBe('blocked')
  })

  it('has a short label for every status', () => {
    for (const label of Object.values(RETICLE_STATUS_LABEL)) {
      expect(label.length).toBeLessThan(16)
    }
  })
})
