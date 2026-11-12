import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Vector2, Vector3 } from 'three'
import { useGameStore } from '../store/gameStore'
import { applyOrbitDelta, computeCameraOffset, computeScannerCameraOffset, getMovementBasis, getOrbit, resetOrbit, zoomOrbit } from './cameraRig'
import { CAMERA, SCANNER } from './worldConfig'

describe('camera orbit', () => {
  beforeEach(resetOrbit)

  it('resets to the default view', () => {
    applyOrbitDelta(100, 100)
    zoomOrbit(2)
    resetOrbit()
    expect(getOrbit()).toEqual({ yaw: 0, pitch: CAMERA.pitch, distance: CAMERA.distance })
  })

  it('limits pitch and distance', () => {
    applyOrbitDelta(100000, 100000)
    zoomOrbit(100000)
    expect(getOrbit().pitch).toBe(CAMERA.maxPitch)
    expect(getOrbit().distance).toBe(CAMERA.maxDistance)
    expect(Math.abs(getOrbit().yaw)).toBeLessThanOrEqual(Math.PI)
    applyOrbitDelta(0, -100000)
    zoomOrbit(-100000)
    expect(getOrbit().pitch).toBe(CAMERA.minPitch)
    expect(getOrbit().distance).toBe(CAMERA.minDistance)
  })

  it('keeps the offset at the selected distance', () => {
    applyOrbitDelta(200, 100)
    const offset = computeCameraOffset(new Vector3())
    expect(offset.length()).toBeCloseTo(getOrbit().distance, 10)
    expect(offset.y).toBeGreaterThan(0)
  })

  it('provides orthogonal movement axes aligned with the camera', () => {
    applyOrbitDelta(200, 0)
    const forward = new Vector2()
    const right = new Vector2()
    getMovementBasis(forward, right)
    expect(forward.length()).toBeCloseTo(1)
    expect(right.length()).toBeCloseTo(1)
    expect(forward.dot(right)).toBeCloseTo(0)
    const offset = computeCameraOffset(new Vector3())
    expect(forward.dot(new Vector2(offset.x, offset.z).normalize())).toBeCloseTo(-1)
  })

  it('keeps a third-person scanner camera at a stable distance', () => {
    zoomOrbit(100000)
    applyOrbitDelta(200, 0)
    const offset = computeScannerCameraOffset(new Vector3())
    expect(offset.length()).toBeCloseTo(SCANNER.cameraDistance, 10)
    expect(offset.y).toBeGreaterThan(0)
    // The framing must not follow the zoomed exploration distance.
    expect(offset.length()).toBeLessThan(getOrbit().distance)
  })

  it('allows a wider pitch range in first-person scanner mode', () => {
    const store = useGameStore.getState()
    store.equipScanner('spirit')
    store.setScannerCamera('first-person')
    applyOrbitDelta(0, -100000)
    expect(getOrbit().pitch).toBe(SCANNER.firstPersonPitchMin)
    applyOrbitDelta(0, 100000)
    expect(getOrbit().pitch).toBe(SCANNER.firstPersonPitchMax)
    resetOrbit()
  })
})

afterEach(() => {
  useGameStore.getState().unequipScanner()
  useGameStore.getState().setScannerCamera('first-person')
  resetOrbit()
})
