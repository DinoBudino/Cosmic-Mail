import { renderToStaticMarkup } from 'react-dom/server'
import type { IntroHologramState } from '../../data/onboardingNarrative'
import { ArchiveBoard, EnvelopeHologram } from './IntroVisuals'

/**
 * Cinematic intro holograms, composed into one standalone SVG per beat and
 * projected inside the Cosmic Memory Window. The state comes from the
 * narrative beat sheet, so dialogue, PIP's expression and the projection
 * cannot drift apart.
 */

function place(markup: string): string {
  return markup.replace(/^<svg /, '<svg x="0" y="0" ')
}

function archiveScene(state: IntroHologramState): string {
  return place(renderToStaticMarkup(<ArchiveBoard state={state} />))
}

function invitationScene(): string {
  return place(renderToStaticMarkup(<EnvelopeHologram facing />))
}

/** Standalone SVG (320x320) for the given beat, or null for no projection. */
export function introHologramSvg(
  state: IntroHologramState,
): string | null {
  if (state === 'none') return null

  const inner = state === 'letter' ? invitationScene() : archiveScene(state)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet">` +
    inner +
    `</svg>`
  )
}
