import { describe, expect, it } from 'vitest'
import { getExplorerShot, getPartShot, getPipBesidePart, getSendFilmFrame, pickPipSpot } from './explorerShots'

const flat = () => 0
const center = { x: 0, z: 0 }
const side = { x: 0, z: 1 }

describe('explorer shots', () => {
  it('runs three shots and never goes under the ground', () => {
    const shots = [0.1, 0.5, 0.9].map((p) => getExplorerShot(p, 'surveyor-3', center, side, flat))
    expect(shots.map((s) => s.shot)).toEqual([0, 1, 2])
    for (const s of shots) expect(s.position.y).toBeGreaterThanOrEqual(0.35)
  })
})

describe('part close-up', () => {
  const part = { x: 0.5, y: 0.6, z: 0.4 }

  it('stays close to the part and looks at it', () => {
    for (const p of [0, 0.5, 1]) {
      const frame = getPartShot(p, part, center, side, 1, flat)
      const d = Math.hypot(frame.position.x - part.x, frame.position.z - part.z)
      expect(d).toBeGreaterThan(1.2)
      expect(d).toBeLessThan(2.5)
      expect(frame.look).toEqual(part)
      expect(frame.position.y).toBeGreaterThanOrEqual(0.35)
    }
  })

  it('comes from the side the child was standing on', () => {
    const frame = getPartShot(0.5, part, center, side, 1, flat)
    expect(frame.position.z).toBeGreaterThan(part.z)
  })

  it('puts PIP between the camera and the part, off to one side', () => {
    const frame = getPartShot(0.5, part, center, side, 1, flat)
    const pip = getPipBesidePart(frame.position, part)
    const toCamera = Math.hypot(frame.position.x - part.x, frame.position.z - part.z)
    const pipToPart = Math.hypot(pip.x - part.x, pip.z - part.z)
    expect(pipToPart).toBeGreaterThan(0.4)
    expect(pipToPart).toBeLessThan(toCamera)
  })
})

describe('PIP spot in a close-up', () => {
  const camera = { x: 0, y: 1, z: 3 }
  const part = { x: 0, y: 0.6, z: 0 }

  it('floats between the camera and the part, off to one side', () => {
    const spot = pickPipSpot(camera, part, null)
    expect(spot.z).toBeGreaterThan(part.z)
    expect(spot.z).toBeLessThan(camera.z)
    expect(Math.abs(spot.x)).toBeGreaterThan(0.2)
  })

  it('takes the other side when the scene says he would be hidden', () => {
    const spot = pickPipSpot(camera, part, (s) => (s.x > 0 ? 1 : 0.4))
    expect(spot.x).toBeGreaterThan(0)
  })

  it('stays far enough from the lens to look his own size', () => {
    const spot = pickPipSpot(camera, part, null)
    expect(Math.hypot(spot.x - camera.x, spot.y - camera.y, spot.z - camera.z)).toBeGreaterThan(1.6)
  })

  it('floats above the part on a phone', () => {
    const spot = pickPipSpot(camera, part, null, 390 / 844)
    expect(spot.y).toBeGreaterThan(part.y + 0.3)
    expect(Math.abs(spot.x)).toBeLessThan(0.5)
  })
})

describe('send film', () => {
  const sky = { x: 0.6, y: 0.6, z: -0.5 }
  it('starts close on PIP, then looks up from the far side', () => {
    const first = getSendFilmFrame(0.2, 'opportunity', center, side, sky, flat)
    expect(first.shot).toBe(0)
    expect(first.launch).toBe(0)
    const toPip = Math.hypot(first.position.x - first.pip.x, first.position.z - first.pip.z)
    expect(toPip).toBeLessThan(2.4)
    const last = getSendFilmFrame(0.95, 'opportunity', center, side, sky, flat)
    expect(last.shot).toBe(1)
    expect(last.launch).toBeGreaterThan(0.8)
    // The camera looks upward at the end.
    expect(last.look.y).toBeGreaterThan(last.position.y + 2)
  })
})
