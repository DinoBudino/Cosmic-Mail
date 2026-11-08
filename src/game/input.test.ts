import { describe, expect, it } from 'vitest'
import { clampMoveVector, normalizeMoveVector } from './input'

describe('normalizeMoveVector', () => {
  it('returns a zero vector for no input', () => {
    expect(normalizeMoveVector(0, 0)).toEqual({ x: 0, z: 0 })
  })

  it('normalizes diagonal input to unit length', () => {
    const result = normalizeMoveVector(1, 1)
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(1, 12)
    expect(result.x).toBeCloseTo(Math.SQRT1_2, 12)
    expect(result.z).toBeCloseTo(Math.SQRT1_2, 12)
  })

  it('normalizes an axis-aligned vector', () => {
    expect(normalizeMoveVector(3, 4)).toEqual({ x: 0.6, z: 0.8 })
  })

  it('preserves direction for negative input', () => {
    const result = normalizeMoveVector(-2, 0)
    expect(result.x).toBe(-1)
    expect(result.z).toBe(0)
  })

  it('treats very small values as no input', () => {
    expect(normalizeMoveVector(1e-9, -1e-9)).toEqual({ x: 0, z: 0 })
  })
})

describe('clampMoveVector', () => {
  it('returns a zero vector for no input', () => {
    expect(clampMoveVector(0, 0)).toEqual({ x: 0, z: 0 })
  })

  it('keeps analog input below full tilt', () => {
    const result = clampMoveVector(0.4, -0.3)
    expect(result.x).toBe(0.4)
    expect(result.z).toBe(-0.3)
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(0.5, 12)
  })

  it('clamps overlong vectors to the unit circle', () => {
    const result = clampMoveVector(3, 4)
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(1, 12)
    expect(result.x).toBeCloseTo(0.6, 12)
    expect(result.z).toBeCloseTo(0.8, 12)
  })

  it('clamps combined keyboard and touch input without changing direction', () => {
    const result = clampMoveVector(1.5, 1.5)
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(1, 12)
    expect(result.x).toBeCloseTo(result.z, 12)
  })
})
