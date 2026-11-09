import { describe, expect, it } from 'vitest'
import {
  countdownLabel,
  cruiseDistance,
  descentProgress,
  inCabinStage,
  launchTimeline,
  marsApproach,
  shipPoseAt,
  showEscapeVelocityFact,
  speedShake,
  stageAt,
} from './launchTimeline'

describe('launch timeline', () => {
  it('runs about 24 seconds normally and much shorter with reduced motion', () => {
    const full = launchTimeline(false).duration
    expect(full).toBeGreaterThanOrEqual(20)
    expect(full).toBeLessThanOrEqual(30)
    expect(launchTimeline(true).duration).toBeLessThan(full)
  })

  it('gives the arrive descent a long, immersive duration', () => {
    const arrive = launchTimeline(false).segments.find((segment) => segment.id === 'arrive')!
    expect(arrive.end - arrive.start).toBeGreaterThanOrEqual(4)
  })

  it('counts 3, 2, 1 then Lift off!', () => {
    const timeline = launchTimeline(false)
    const countdown = timeline.segments.find((segment) => segment.id === 'countdown')!
    expect(countdownLabel(countdown.start + 0.1, false)).toBe('3')
    expect(countdownLabel(countdown.start + 1.1, false)).toBe('2')
    expect(countdownLabel(countdown.start + 2.1, false)).toBe('1')
    const liftoff = timeline.segments.find((segment) => segment.id === 'liftoff')!
    expect(countdownLabel(liftoff.start + 0.1, false)).toBe('Lift off!')
    expect(countdownLabel(0, false)).toBeNull()
  })

  it('starts inside the cabin and only goes exterior at liftoff', () => {
    const timeline = launchTimeline(false)
    const mid = (id: string) => {
      const segment = timeline.segments.find((entry) => entry.id === id)!
      return (segment.start + segment.end) / 2
    }
    expect(inCabinStage(mid('ignition'), false)).toBe(true)
    expect(inCabinStage(mid('countdown'), false)).toBe(true)
    expect(inCabinStage(mid('liftoff'), false)).toBe(false)
    expect(inCabinStage(mid('ascent'), false)).toBe(false)
  })

  it('travels in a straight line and only shows Mars at the end', () => {
    const timeline = launchTimeline(false)
    const mid = (id: string) => {
      const segment = timeline.segments.find((entry) => entry.id === id)!
      return (segment.start + segment.end) / 2
    }
    expect(cruiseDistance(0, false)).toBe(0)
    expect(cruiseDistance(mid('ascent'), false)).toBeGreaterThan(0)
    expect(cruiseDistance(mid('space'), false)).toBeGreaterThan(cruiseDistance(mid('ascent'), false))
    expect(cruiseDistance(mid('accelerate'), false)).toBeGreaterThan(cruiseDistance(mid('space'), false))
    expect(marsApproach(mid('space'), false)).toBe(0)
    expect(marsApproach(mid('accelerate'), false)).toBeGreaterThan(0)
    expect(marsApproach(mid('arrive'), false)).toBeGreaterThan(marsApproach(mid('accelerate'), false))
    expect(descentProgress(mid('space'), false)).toBe(0)
    expect(descentProgress(mid('arrive'), false)).toBeGreaterThan(0)
  })

  it('flies nose-forward until the final upright descent', () => {
    const timeline = launchTimeline(false)
    const mid = (id: string) => {
      const segment = timeline.segments.find((entry) => entry.id === id)!
      return (segment.start + segment.end) / 2
    }
    expect(shipPoseAt(mid('space'), false)).toBe('fly')
    expect(shipPoseAt(mid('accelerate'), false)).toBe('fly')
    expect(shipPoseAt(mid('arrive'), false)).toBe('land')
  })

  it('shakes the camera with speed and calms down on arrival', () => {
    const timeline = launchTimeline(false)
    const mid = (id: string) => {
      const segment = timeline.segments.find((entry) => entry.id === id)!
      return (segment.start + segment.end) / 2
    }
    expect(speedShake(mid('countdown'), false)).toBe(0)
    expect(speedShake(mid('space'), false)).toBeGreaterThan(speedShake(mid('ascent'), false))
    expect(speedShake(mid('accelerate'), false)).toBeGreaterThan(speedShake(mid('space'), false))
    const earlyArrive = timeline.segments.find((entry) => entry.id === 'arrive')!
    expect(speedShake(earlyArrive.start + 0.2, false)).toBeLessThan(speedShake(mid('accelerate'), false))
    expect(speedShake(mid('space'), true)).toBe(0)
  })

  it('shows the escape-velocity fact in space and starts at ignition', () => {
    const space = launchTimeline(false).segments.find((segment) => segment.id === 'space')!
    expect(showEscapeVelocityFact(space.start + 0.5, false)).toBe(true)
    expect(showEscapeVelocityFact(0, false)).toBe(false)
    expect(stageAt(0, false).stage).toBe('ignition')
  })
})
