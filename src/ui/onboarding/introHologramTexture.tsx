import { renderToStaticMarkup } from 'react-dom/server'
import type { IntroHologramState, IntroPipPanel } from '../../data/onboardingNarrative'
import { ArchiveBoard, PipPanelHologram } from './IntroVisuals'

/**
 * Cinematic intro holograms, composed into one standalone SVG per frame
 * and projected inside the Cosmic Memory Window. The state and variant
 * come from the narrative beat sheet, so dialogue, PIP's expression and
 * the projection cannot drift apart.
 */

function place(markup: string): string {
  return markup.replace(/^<svg /, '<svg x="0" y="0" ')
}

const cache = new Map<string, string>()

/**
 * Standalone SVG (320x320) for the given beat frame, or null for no
 * projection. `variant` 0 is the settled frame of the state.
 */
export function introHologramSvg(
  state: IntroHologramState,
  variant = 0,
): string | null {
  if (state === 'none') return null
  const key = `${state}:${variant}`
  const cached = cache.get(key)
  if (cached) return cached

  const inner = place(renderToStaticMarkup(<ArchiveBoard state={state} variant={variant} />))
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet">` +
    inner +
    `</svg>`
  cache.set(key, svg)
  return svg
}

/** Standalone SVG (240x150) for the small panel PIP projects beside him. */
export function pipPanelSvg(panel: IntroPipPanel): string {
  const markup = renderToStaticMarkup(<PipPanelHologram panel={panel} />)
  return markup.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ')
}
