import { describe, expect, it } from 'vitest'
import {
  getMinimapPoint,
  getRadarSnapshot,
  radarDirectionLabel,
  SPIRIT_RADAR_RANGE,
} from './radar'

const ORIGIN = { x: 0, z: 0 }

describe('getRadarSnapshot', () => {
  it('puts a colocated target at the centre', () => {
    const snapshot = getRadarSnapshot(ORIGIN, ORIGIN)
    expect(snapshot.distance).toBe(0)
    expect(snapshot.bearing).toBe(0)
    expect(snapshot.x).toBe(0)
    expect(snapshot.y).toBe(0)
    expect(snapshot.inRange).toBe(true)
  })

  it('maps the cardinal directions to the radar disc', () => {
    const north = getRadarSnapshot(ORIGIN, { x: 0, z: -10 })
    expect(north.y).toBeLessThan(0)
    expect(north.x).toBeCloseTo(0)
    expect(north.bearing).toBeCloseTo(0)

    const east = getRadarSnapshot(ORIGIN, { x: 10, z: 0 })
    expect(east.x).toBeGreaterThan(0)
    expect(east.y).toBeCloseTo(0)
    expect(east.bearing).toBeCloseTo(Math.PI / 2)

    const south = getRadarSnapshot(ORIGIN, { x: 0, z: 10 })
    expect(south.y).toBeGreaterThan(0)
    expect(Math.abs(south.bearing)).toBeCloseTo(Math.PI)

    const west = getRadarSnapshot(ORIGIN, { x: -10, z: 0 })
    expect(west.x).toBeLessThan(0)
    expect(west.bearing).toBeCloseTo(-Math.PI / 2)
  })

  it('keeps the direction but clamps an off-range blip to the rim', () => {
    const snapshot = getRadarSnapshot(ORIGIN, {
      x: SPIRIT_RADAR_RANGE * 2,
      z: 0,
    })
    expect(snapshot.inRange).toBe(false)
    expect(snapshot.x).toBeCloseTo(1)
    expect(snapshot.y).toBeCloseTo(0)
    expect(Math.hypot(snapshot.x, snapshot.y)).toBeCloseTo(1)
  })

  it('scales an in-range blip by distance', () => {
    const snapshot = getRadarSnapshot(ORIGIN, {
      x: SPIRIT_RADAR_RANGE / 2,
      z: 0,
    })
    expect(snapshot.inRange).toBe(true)
    expect(snapshot.x).toBeCloseTo(0.5)
    expect(Math.hypot(snapshot.x, snapshot.y)).toBeCloseTo(0.5)
  })

  it('turns bearings into readable compass labels', () => {
    expect(radarDirectionLabel(0)).toBe('north')
    expect(radarDirectionLabel(Math.PI / 2)).toBe('east')
    expect(radarDirectionLabel(Math.PI)).toBe('south')
    expect(radarDirectionLabel(-Math.PI / 2)).toBe('west')
    expect(radarDirectionLabel(Math.PI / 4)).toBe('north-east')
  })
})

describe('getMinimapPoint (heading-up)', () => {
  it('puts what the camera faces at the top of the map', () => {
    // Yaw 0 looks north (-Z).
    const ahead = getMinimapPoint(ORIGIN, { x: 0, z: -10 }, 0)
    expect(ahead.y).toBeLessThan(0)
    expect(ahead.x).toBeCloseTo(0)
    const right = getMinimapPoint(ORIGIN, { x: 10, z: 0 }, 0)
    expect(right.x).toBeGreaterThan(0)
    expect(right.y).toBeCloseTo(0)
  })

  it('turns with the camera', () => {
    // Facing east: forward = (-sin, -cos) = (1, 0) for yaw = -PI/2.
    const yaw = -Math.PI / 2
    const east = getMinimapPoint(ORIGIN, { x: 10, z: 0 }, yaw)
    expect(east.y).toBeLessThan(0)
    expect(east.x).toBeCloseTo(0)
    const north = getMinimapPoint(ORIGIN, { x: 0, z: -10 }, yaw)
    expect(north.x).toBeLessThan(0)
  })

  it('clamps far targets to the rim and centres colocated ones', () => {
    const far = getMinimapPoint(ORIGIN, { x: 0, z: -SPIRIT_RADAR_RANGE * 3 }, 0)
    expect(far.inRange).toBe(false)
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1)
    const here = getMinimapPoint(ORIGIN, ORIGIN, 1.2)
    expect(here.x).toBe(0)
    expect(here.y).toBe(0)
  })
})
