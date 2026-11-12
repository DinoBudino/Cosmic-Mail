import { describe, expect, it } from 'vitest'
import {
  clampAimDirection,
  clearScannerAim,
  scannerAim,
  setScannerAim,
} from './scannerAim'

const MIN_YAW = -0.35
const MAX_YAW = 1.35
const MIN_Y = -0.8
const MAX_Y = 0.6

function clamp(direction: { x: number; y: number; z: number }) {
  return clampAimDirection(
    direction,
    0,
    MIN_YAW,
    MAX_YAW,
    MIN_Y,
    MAX_Y,
  )
}

describe('scanner aim state', () => {
  it('stores and clears the world aim point', () => {
    setScannerAim(1, 2, 3)
    expect(scannerAim).toEqual({ x: 1, y: 2, z: 3, valid: true })
    clearScannerAim()
    expect(scannerAim.valid).toBe(false)
  })
})

describe('clampAimDirection', () => {
  it('keeps a forward aim unchanged', () => {
    const result = clamp({ x: 0, y: 0, z: -1 })
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(-1)
  })

  it('clamps a far-right target to the right-arm limit', () => {
    const result = clamp({ x: 1, y: 0, z: 0 })
    expect(result.x).toBeCloseTo(Math.sin(MAX_YAW))
    expect(result.z).toBeCloseTo(-Math.cos(MAX_YAW))
    expect(result.y).toBeCloseTo(0)
  })

  it('clamps a far-left target so the arm does not cross the body', () => {
    const result = clamp({ x: -1, y: 0, z: 0 })
    expect(result.x).toBeCloseTo(Math.sin(MIN_YAW))
    expect(result.z).toBeCloseTo(-Math.cos(MIN_YAW))
  })

  it('clamps high and low aim to a readable vertical range', () => {
    const high = clamp({ x: 0, y: 2, z: -1 })
    expect(high.y).toBeLessThanOrEqual(MAX_Y)
    expect(high.y).toBeGreaterThan(0)

    const low = clamp({ x: 0, y: -2, z: -1 })
    expect(low.y).toBeGreaterThanOrEqual(MIN_Y)
    expect(low.y).toBeLessThan(0)
  })

  it('never leaves the direction unnormalized or pointing backwards', () => {
    const result = clamp({ x: -1, y: 1, z: 2 })
    expect(Math.hypot(result.x, result.y, result.z)).toBeCloseTo(1)
    expect(result.z).toBeLessThan(0)
  })
})
