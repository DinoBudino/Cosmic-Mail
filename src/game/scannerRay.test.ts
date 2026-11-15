import { describe, expect, it } from 'vitest'
import { pickScannerTarget, type ScannerRayHit } from './scannerRay'

const PLAYER = { x: 0, z: 0 }
const MISSION = 'spirit'

function hit(overrides: Partial<ScannerRayHit> = {}): ScannerRayHit {
  return {
    componentId: null,
    missionId: null,
    distance: 5,
    x: 0,
    y: 1,
    z: 5,
    ignored: false,
    opaque: false,
    ...overrides,
  }
}

describe('pickScannerTarget', () => {
  it('accepts a matching component in range', () => {
    expect(
      pickScannerTarget(
        [
          hit({
            componentId: 'spirit-pancam',
            missionId: MISSION,
            distance: 4,
            z: 4,
          }),
        ],
        MISSION,
        PLAYER,
        14,
      ),
    ).toEqual({
      componentId: 'spirit-pancam',
      distance: 4,
      x: 0,
      y: 1,
      z: 4,
    })
  })

  it('rejects a component outside the player range', () => {
    expect(
      pickScannerTarget(
        [
          hit({
            componentId: 'spirit-pancam',
            missionId: MISSION,
            z: 20,
          }),
        ],
        MISSION,
        PLAYER,
        14,
      ),
    ).toBeNull()
  })

  it('rejects an opaque object in front of the component', () => {
    expect(
      pickScannerTarget(
        [
          hit({ distance: 3, z: 3, opaque: true }),
          hit({
            componentId: 'spirit-pancam',
            missionId: MISSION,
            distance: 4,
            z: 4,
          }),
        ],
        MISSION,
        PLAYER,
        14,
      ),
    ).toBeNull()
  })

  it('skips the player, PIP and other ignored objects', () => {
    expect(
      pickScannerTarget(
        [
          hit({ distance: 1, z: 1, ignored: true, opaque: true }),
          hit({
            componentId: 'spirit-mini-tes',
            missionId: MISSION,
            distance: 4,
            z: 4,
          }),
        ],
        MISSION,
        PLAYER,
        14,
      ),
    ).toEqual({
      componentId: 'spirit-mini-tes',
      distance: 4,
      x: 0,
      y: 1,
      z: 4,
    })
  })

  it('lets transparent non-target effects through', () => {
    expect(
      pickScannerTarget(
        [
          hit({ distance: 2, z: 2, opaque: false }),
          hit({
            componentId: 'spirit-rock-abrasion-tool',
            missionId: MISSION,
            distance: 5,
            z: 5,
          }),
        ],
        MISSION,
        PLAYER,
        14,
      ),
    ).toEqual({
      componentId: 'spirit-rock-abrasion-tool',
      distance: 5,
      x: 0,
      y: 1,
      z: 5,
    })
  })

  it('rejects a component belonging to another mission', () => {
    expect(
      pickScannerTarget(
        [
          hit({
            componentId: 'surveyor-3-tv-camera',
            missionId: 'surveyor-3',
            distance: 3,
            z: 3,
          }),
        ],
        MISSION,
        PLAYER,
        14,
      ),
    ).toBeNull()
  })

  it('accepts an environmental target in range', () => {
    expect(
      pickScannerTarget(
        [
          hit({
            environmentalId: 'env-soil-landing',
            distance: 4,
            z: 4,
          }),
        ],
        MISSION,
        PLAYER,
        14,
      ),
    ).toEqual({
      environmentalId: 'env-soil-landing',
      distance: 4,
      x: 0,
      y: 1,
      z: 4,
    })
  })

  it('rejects an environmental target outside the scanner range', () => {
    expect(
      pickScannerTarget(
        [hit({ environmentalId: 'env-wind-passage', z: 20 })],
        MISSION,
        PLAYER,
        14,
      ),
    ).toBeNull()
  })

  it('returns null when the reticle does not hit a component', () => {
    expect(pickScannerTarget([], MISSION, PLAYER, 14)).toBeNull()
    expect(
      pickScannerTarget(
        [hit({ distance: 3, z: 3, opaque: true })],
        MISSION,
        PLAYER,
        14,
      ),
    ).toBeNull()
  })

  it('returns a distractor in range without treating it as a component', () => {
    const pick = pickScannerTarget(
      [hit({ distractorId: 'spirit-wheels', missionId: MISSION, z: 4 })],
      MISSION,
      PLAYER,
      14,
    )
    expect(pick).toMatchObject({ distractorId: 'spirit-wheels' })
    expect(pick && 'componentId' in pick).toBe(false)
  })

  it('rejects distractors from another mission, out of range or occluded', () => {
    const d = { distractorId: 'spirit-wheels', missionId: MISSION }
    expect(
      pickScannerTarget([hit({ ...d, missionId: 'surveyor-3' })], MISSION, PLAYER, 14),
    ).toBeNull()
    expect(pickScannerTarget([hit({ ...d, z: 30 })], MISSION, PLAYER, 14)).toBeNull()
    expect(
      pickScannerTarget([hit({ opaque: true }), hit(d)], MISSION, PLAYER, 14),
    ).toBeNull()
  })
})

describe('next part preference', () => {
  const recorded = hit({ componentId: 'scoop', missionId: MISSION, distance: 3, opaque: true })
  const next = hit({ componentId: 'radar', missionId: MISSION, distance: 3.4, opaque: true })

  it('picks the part to find even behind a recorded neighbour', () => {
    const pick = pickScannerTarget([recorded, next], MISSION, PLAYER, 14, 'radar')
    expect(pick && 'componentId' in pick ? pick.componentId : null).toBe('radar')
  })

  it('keeps the nearest part when no preference is given', () => {
    const pick = pickScannerTarget([recorded, next], MISSION, PLAYER, 14)
    expect(pick && 'componentId' in pick ? pick.componentId : null).toBe('scoop')
  })

  it('never reaches through the ground', () => {
    const ground = hit({ distance: 3.2, opaque: true, ground: true })
    const pick = pickScannerTarget([recorded, ground, next], MISSION, PLAYER, 14, 'radar')
    expect(pick && 'componentId' in pick ? pick.componentId : null).toBe('scoop')
  })
})
