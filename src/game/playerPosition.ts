import { WORLD } from './worldConfig'

/**
 * Mutable, non-reactive player position shared between the player and
 * terrain-side effects (footprint trail). Kept outside React state so
 * per-frame updates never trigger re-renders.
 */
export const playerPosition: { x: number; z: number; airborne: number } = {
  x: WORLD.spawn.x,
  z: WORLD.spawn.z,
  airborne: 0,
}
