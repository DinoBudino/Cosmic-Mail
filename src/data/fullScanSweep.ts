/**
 * Pure rules for the in-world sweep of the full recognition scan. The player
 * aims the scanner at glowing memory traces around the explorer and holds to
 * reveal each one. Which trace is under the reticle is decided here from the
 * ray hits, so occlusion and range are testable without a renderer.
 */

import {
  MEMORY_FRAGMENT_KINDS,
  type MemoryFragmentKind,
} from './fullScanReconstruction'

export interface TraceRayHit {
  /** Set when the hit object belongs to a memory-trace anchor. */
  traceKind: string | null
  componentId: string | null
  distractorId: string | null
  ignored: boolean
  opaque: boolean
  distance: number
}

export interface TracePick {
  kind: MemoryFragmentKind
  /** Index of the hit in the ray-hit list (to read the impact point). */
  index: number
}

/** Tolerance so a trace sitting on the body is not hidden by that body. */
const OCCLUSION_MARGIN = 0.05

function isMemoryKind(value: string | null): value is MemoryFragmentKind {
  return (
    value !== null &&
    (MEMORY_FRAGMENT_KINDS as readonly string[]).includes(value)
  )
}

/**
 * First unrevealed trace under the reticle, within range and with a clear
 * line of sight. Hits are expected nearest-first (as three.js returns them).
 * Logical hit boxes of the explorer (components, distractors) and ignored
 * helper meshes never block; solid scenery and the body do.
 */
export function pickTraceHit(
  hits: readonly TraceRayHit[],
  revealed: readonly MemoryFragmentKind[],
  maxDistance: number,
): TracePick | null {
  for (let index = 0; index < hits.length; index += 1) {
    const hit = hits[index]!
    if (!isMemoryKind(hit.traceKind) || revealed.includes(hit.traceKind)) {
      continue
    }
    if (hit.distance > maxDistance) return null
    for (let before = 0; before < index; before += 1) {
      const blocker = hits[before]!
      if (
        !blocker.ignored &&
        blocker.opaque &&
        !blocker.componentId &&
        !blocker.distractorId &&
        blocker.distance < hit.distance - OCCLUSION_MARGIN
      ) {
        return null
      }
    }
    return { kind: hit.traceKind, index }
  }
  return null
}

/** Objective line while the sweep is running. */
export function getSweepObjective(input: {
  equipped: boolean
  aiming: boolean
  revealed: number
  coarsePointer: boolean
}): { text: string; highlight: 'scanner-key' | 'trace' | 'hold' } {
  if (!input.equipped) {
    return {
      text: input.coarsePointer
        ? 'Tap the scanner button to sweep the explorer'
        : 'Press Q to equip the scanner and sweep the explorer',
      highlight: 'scanner-key',
    }
  }
  if (input.aiming) return { text: 'Hold to reveal the trace', highlight: 'hold' }
  return {
    text: `Circle the explorer · find memory traces (${input.revealed}/4)`,
    highlight: 'trace',
  }
}
