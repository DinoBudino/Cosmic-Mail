import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/App.css', 'utf8')
const MARKER = 'HUD legibility floor'
const FLOOR_PX = 12.8

/** Gameplay HUD selectors that must stay readable at 720p and 1080p. */
const HUD_SELECTORS = [
  '.pip-speech__skip',
  '.pip-name',
  '.hud-controls',
  '.hud-key',
  '.cosmic-radar__label',
  '.cosmic-radar__note',
  '.cosmic-radar__action',
  '.scanner-hud__count',
  '.scanner-hud__put-away',
  '.scanner-reticle__label',
  '.spirit-interaction__label',
  '.spirit-interaction__action',
  '.touch-hint',
  '.touch-scanner',
  '.scanner-hud__status',
  '.pip-text',
  '.objective-bar__text',
]

function sizeFor(selector: string, source: string): number | null {
  let last: number | null = null
  for (const match of source.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]!.split(',').map((s) => s.trim())
    if (!selectors.includes(selector)) continue
    const size = match[2]!.match(/font-size:\s*([0-9.]+)(rem|px)/)
    if (size) {
      last = parseFloat(size[1]!) * (size[2] === 'rem' ? 16 : 1)
    }
  }
  return last
}

describe('HUD legibility', () => {
  it('has the floor block and keeps every gameplay HUD text at or above 12.8px', () => {
    const start = css.indexOf(MARKER)
    expect(start).toBeGreaterThan(0)
    // Comments would otherwise be glued onto the first selector.
    const after = css.slice(css.indexOf('*/', start) + 2).replace(/\/\*[\s\S]*?\*\//g, '')
    for (const selector of HUD_SELECTORS) {
      const size = sizeFor(selector, after)
      expect(size, selector).not.toBeNull()
      expect(size!, selector).toBeGreaterThanOrEqual(FLOOR_PX)
    }
  })

  it('respects reduced motion for the new guided animations', () => {
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{[^}]*\.cosmic-radar\.is-guided/,
    )
  })

  it('keeps the reticle label and status on a solid pill for contrast', () => {
    const start = css.indexOf('.scanner-reticle__status {')
    expect(start).toBeGreaterThan(0)
    expect(css).toContain('background: rgba(31, 20, 44, 0.78)')
  })
})
