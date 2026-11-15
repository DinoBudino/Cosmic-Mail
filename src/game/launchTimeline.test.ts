import { describe, expect, it } from 'vitest'
import {
  countdownLabel,
  cruiseDistance,
  descentProgress,
  inCabinStage,
  launchTimeline,
  marsApproach,
  LAUNCH_PLANET_RADIUS,
  LAUNCH_SHIP_CLEARANCE,
  launchPlanetPlacement,
  launchShipPosition,
  shipPoseAt,
  showEscapeVelocityFact,
  speedShake,
  stageAt,
  warpFactor,
  liftoffFlash,
  cabinLaunchPulse,
} from './launchTimeline'

describe('launch timeline', () => {
  it('runs about 15 seconds normally and shorter with reduced motion', () => {
    const full = launchTimeline(false).duration
    expect(full).toBeGreaterThanOrEqual(13)
    expect(full).toBeLessThanOrEqual(18)
    expect(launchTimeline(true).duration).toBeLessThan(full)
  })

  it('keeps the arrive descent long enough to see the planet arrive', () => {
    const arrive = launchTimeline(false).segments.find((segment) => segment.id === 'arrive')!
    expect(arrive.end - arrive.start).toBeGreaterThanOrEqual(3.5)
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

describe('launch excitement curves', () => {
  const timeline = launchTimeline(false)
  const at = (id: string, t: number) => {
    const segment = timeline.segments.find((entry) => entry.id === id)!
    return segment.start + (segment.end - segment.start) * t
  }

  it('builds warp speed up to the dash and drops it on arrival', () => {
    expect(warpFactor(at('countdown', 0.5), false)).toBe(0)
    expect(warpFactor(at('space', 0.5), false)).toBeGreaterThan(warpFactor(at('ascent', 0.5), false))
    expect(warpFactor(at('accelerate', 0.99), false)).toBeGreaterThan(0.95)
    expect(warpFactor(at('arrive', 0.6), false)).toBe(0)
  })

  it('flashes at liftoff and pulses the cabin on every count', () => {
    expect(liftoffFlash(at('liftoff', 0), false)).toBe(1)
    expect(liftoffFlash(at('ascent', 0.5), false)).toBe(0)
    expect(liftoffFlash(at('liftoff', 0), true)).toBe(0)
    expect(cabinLaunchPulse(at('countdown', 0.01), false)).toBeGreaterThan(0.9)
    expect(cabinLaunchPulse(at('countdown', 0.2), false)).toBeLessThan(0.7)
    expect(cabinLaunchPulse(at('liftoff', 0.5), false)).toBe(0)
  })

  it('keeps the ship (and its solar arrays) clear of the destination planet', () => {
    for (const reducedMotion of [false, true]) {
      const { duration } = launchTimeline(reducedMotion)
      for (let i = 0; i <= 200; i += 1) {
        const t = (duration * i) / 200
        const planet = launchPlanetPlacement(t, reducedMotion)
        if (!planet.visible) continue
        const ship = launchShipPosition(t, reducedMotion)
        const gap =
          Math.hypot(ship.x - planet.x, ship.y - planet.y, ship.z - planet.z) -
          LAUNCH_PLANET_RADIUS * planet.scale
        expect(gap).toBeGreaterThanOrEqual(LAUNCH_SHIP_CLEARANCE)
      }
    }
  })
})
