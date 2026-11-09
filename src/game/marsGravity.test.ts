import { describe, expect, it } from 'vitest'
import { marsJumpAirTime, marsJumpHeight, stepVertical } from './marsGravity'
import { PLAYER } from './worldConfig'

function simulate(duration: number, bootHeld: boolean, dt = 1 / 60) {
  let state = { y: 0, vy: 0, grounded: true }
  let peak = 0
  let airFrames = 0
  for (let t = 0; t < duration; t += dt) {
    const pressed = t === 0
    state = stepVertical(state, 0, dt, { jumpPressed: pressed, bootHeld })
    peak = Math.max(peak, state.y)
    if (!state.grounded) airFrames += 1
  }
  return { state, peak, airTime: airFrames * dt }
}

describe('mars gravity', () => {
  it('produces a long, floaty jump compared to Earth', () => {
    expect(marsJumpHeight()).toBeCloseTo(1.56, 2)
    expect(marsJumpAirTime()).toBeCloseTo(1.83, 2)
  })

  it('reaches the expected peak and lands back at ground level', () => {
    const { state, peak, airTime } = simulate(3, false)
    expect(peak).toBeCloseTo(1.56, 1)
    expect(state.grounded).toBe(true)
    expect(state.y).toBe(0)
    expect(airTime).toBeCloseTo(1.83, 1)
  })

  it('stays on the ground without a jump press', () => {
    const state = stepVertical({ y: 2, vy: 0, grounded: true }, 5, 0.016, {
      jumpPressed: false,
      bootHeld: false,
    })
    expect(state).toEqual({ y: 5, vy: 0, grounded: true })
  })

  it('holding the boots climbs higher than a plain jump', () => {
    const plain = simulate(4, false)
    const boosted = simulate(4, true)
    expect(boosted.peak).toBeGreaterThan(plain.peak)
    expect(boosted.peak).toBeLessThanOrEqual(PLAYER.maxBootHeight + 1e-9)
  })

  it('caps the hover at maxBootHeight instead of flying away', () => {
    let state = { y: 0, vy: 0, grounded: true }
    const dt = 1 / 60
    for (let t = 0; t < 8; t += dt) {
      state = stepVertical(state, 0, dt, { jumpPressed: t === 0, bootHeld: true })
    }
    expect(state.y).toBeCloseTo(PLAYER.maxBootHeight, 9)
    expect(state.vy).toBeLessThanOrEqual(0)
    expect(state.grounded).toBe(false)
  })

  it('falls gently: terminal speed respects the Mars cap', () => {
    let state = { y: 5, vy: 0, grounded: false }
    const dt = 1 / 60
    let fastest = 0
    for (let t = 0; t < 2 && !state.grounded; t += dt) {
      state = stepVertical(state, 0, dt, { jumpPressed: false, bootHeld: false })
      expect(state.vy).toBeGreaterThanOrEqual(-PLAYER.maxFallSpeed - 1e-9)
      fastest = Math.min(fastest, state.vy)
    }
    expect(fastest).toBeCloseTo(-PLAYER.maxFallSpeed, 9)
  })

  it('lands softly from an arbitrary height', () => {
    let state = { y: 2, vy: 0, grounded: false }
    const dt = 1 / 60
    for (let t = 0; t < 3 && !state.grounded; t += dt) {
      state = stepVertical(state, 0, dt, { jumpPressed: false, bootHeld: false })
    }
    expect(state.grounded).toBe(true)
    expect(state.y).toBe(0)
  })
})
