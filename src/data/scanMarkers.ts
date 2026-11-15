/**
 * Diegetic scan markers: numbered hotspots over the scannable parts. Pure
 * rules only. A marker never names its part: until a part is recorded it is
 * just "Fragment N", so identity discipline holds even after `discovered`.
 * Order follows the anchors in spiritSite.ts (data, not geometry).
 */

export type MarkerState = 'pending' | 'next' | 'aimed' | 'recorded'

export interface MarkerView {
  componentId: string
  /** 1-based number shown on the marker and in the HUD. */
  number: number
  state: MarkerState
}

export function getMarkerViews(
  orderedComponentIds: readonly string[],
  scannedIds: readonly string[],
  aimedId: string | null,
): MarkerView[] {
  const scanned = new Set(scannedIds)
  const nextId =
    orderedComponentIds.find((id) => !scanned.has(id)) ?? null
  return orderedComponentIds.map((componentId, index) => {
    let state: MarkerState = 'pending'
    if (scanned.has(componentId)) state = 'recorded'
    else if (componentId === aimedId) state = 'aimed'
    else if (componentId === nextId) state = 'next'
    return { componentId, number: index + 1, state }
  })
}

/** Neutral label for a part that has not been recorded yet. */
export function fragmentLabel(
  orderedComponentIds: readonly string[],
  componentId: string,
): string {
  const index = orderedComponentIds.indexOf(componentId)
  return index === -1 ? 'Fragment' : `Fragment ${index + 1}`
}

/** The marker the player should try next (1 → 2 → 3), or null when done. */
export function getNextMarkerNumber(
  orderedComponentIds: readonly string[],
  scannedIds: readonly string[],
): number | null {
  const scanned = new Set(scannedIds)
  const index = orderedComponentIds.findIndex((id) => !scanned.has(id))
  return index === -1 ? null : index + 1
}

/**
 * The hunt goes in order (1 → 2 → 3), like PIP's clues: only the next
 * part can be recorded. Aiming at a later part says "find N first".
 */
export function isPartScannableNow(
  orderedComponentIds: readonly string[],
  scannedIds: readonly string[],
  componentId: string,
): boolean {
  if (!orderedComponentIds.includes(componentId)) return true
  const scanned = new Set(scannedIds)
  if (scanned.has(componentId)) return false
  return orderedComponentIds.find((id) => !scanned.has(id)) === componentId
}
