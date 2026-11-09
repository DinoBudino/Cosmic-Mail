import { PLAYER } from './worldConfig'

/**
 * Mars-gravity vertical motion — pure and testable, independent from React.
 *
 * One press of the boots (edge) launches a long Martian arc: with
 * g = 3.71 m/s² a 3.4 m/s impulse peaks near 1.6 m and hangs in the air
 * for almost 2 s. Holding the boots (level) adds thrust on top of the
 * arc (net +6.8 m/s²) so the astronaut can hover and climb, capped at
 * maxBootHeight so the boots never trivially skip a site ring.
 */

export interface VerticalState {
  y: number
  vy: number
  grounded: boolean
}

export function stepVertical(
  state: VerticalState,
  groundY: number,
  dt: number,
  input: { jumpPressed: boolean; bootHeld: boolean },
): VerticalState {
  let { y, vy, grounded } = state

  if (grounded) {
    if (!input.jumpPressed) return { y: groundY, vy: 0, grounded: true }
    vy = PLAYER.jumpVelocity
    grounded = false
  }

  const thrust = input.bootHeld ? PLAYER.bootThrust : 0
  vy += (thrust - PLAYER.gravityMars) * dt
  vy = Math.min(PLAYER.maxRiseSpeed, Math.max(-PLAYER.maxFallSpeed, vy))
  y += vy * dt

  // Rising terrain can catch the astronaut: ground snap above the arc.
  if (y <= groundY) return { y: groundY, vy: 0, grounded: true }

  const maxY = groundY + PLAYER.maxBootHeight
  if (y > maxY) {
    y = maxY
    vy = Math.min(vy, 0)
  }

  return { y, vy, grounded: false }
}

/** Height of a no-input Mars jump from the impulse alone (for tuning). */
export function marsJumpHeight(): number {
  return (PLAYER.jumpVelocity * PLAYER.jumpVelocity) / (2 * PLAYER.gravityMars)
}

/** Air time of a no-input Mars jump from the impulse alone (for tuning). */
export function marsJumpAirTime(): number {
  return (2 * PLAYER.jumpVelocity) / PLAYER.gravityMars
}
