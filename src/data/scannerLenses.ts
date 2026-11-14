/**
 * Cosmic Scanner lenses. Each lens mirrors how a real instrument works, so
 * recognizing a component means using the matching way of observing it.
 * Content and pure rules only: no React, no rendering, no persistence.
 * The active lens is ephemeral UI state; mission progress is still just
 * `scannedComponentIds`.
 */

export const SCANNER_LENS_IDS = ['visual', 'contact', 'thermal'] as const
export type ScannerLensId = (typeof SCANNER_LENS_IDS)[number]

export interface ScannerLens {
  id: ScannerLensId
  /** Keyboard shortcut (also shown in the HUD). */
  key: '1' | '2' | '3'
  label: string
  shortLabel: string
  /** What the lens does, never which part it unlocks. */
  description: string
}

export const SCANNER_LENSES: Readonly<Record<ScannerLensId, ScannerLens>> = {
  visual: {
    id: 'visual',
    key: '1',
    label: 'Visual lens',
    shortLabel: 'Visual',
    description: 'Looks at shapes and views, like a camera.',
  },
  contact: {
    id: 'contact',
    key: '2',
    label: 'Contact lens',
    shortLabel: 'Contact',
    description: 'Studies what a tool touches, grinds or digs.',
  },
  thermal: {
    id: 'thermal',
    key: '3',
    label: 'Thermal lens',
    shortLabel: 'Thermal',
    description: 'Reads heat and infrared light to tell materials apart.',
  },
}

export const DEFAULT_SCANNER_LENS: ScannerLensId = 'visual'

export function isScannerLensId(value: unknown): value is ScannerLensId {
  return (
    typeof value === 'string' &&
    (SCANNER_LENS_IDS as readonly string[]).includes(value)
  )
}

/** Next/previous lens, wrapping around. For keyboard and touch cycling. */
export function cycleScannerLens(
  current: ScannerLensId,
  direction: 1 | -1 = 1,
): ScannerLensId {
  const index = SCANNER_LENS_IDS.indexOf(current)
  const next =
    (index + direction + SCANNER_LENS_IDS.length) % SCANNER_LENS_IDS.length
  return SCANNER_LENS_IDS[next]
}

/** Maps the 1/2/3 keys to a lens, or null for any other key. */
export function lensForKey(key: string): ScannerLensId | null {
  return SCANNER_LENS_IDS.find((id) => SCANNER_LENSES[id].key === key) ?? null
}

/**
 * Lens rule: a component registers only with its own lens. A component
 * without a declared lens (content not yet designed for lenses) accepts any.
 */
export function lensMatchesComponent(
  component: { lens?: ScannerLensId },
  active: ScannerLensId,
): boolean {
  return component.lens === undefined || component.lens === active
}
