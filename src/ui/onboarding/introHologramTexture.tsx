import { renderToStaticMarkup } from 'react-dom/server'
import type { IntroMoment } from '../../data/personalization'
import { EnvelopeHologram, HoloDestination, RoverSilhouette, SpiritConstellation } from './IntroVisuals'

/**
 * Cinematic intro holograms, composed into ONE standalone SVG per
 * moment and projected inside the Cosmic Memory Window as a 3D
 * circular mesh. Rendering in 3D (instead of a DOM overlay) is what
 * makes PIP pass IN FRONT of the projection, and the circle geometry
 * clips anything that would escape the window frame.
 */

const EMBEDDED_STYLE = `
.holo-star{opacity:.85}
.holo-float,.holo-shine,.holo-orbit{animation:none}
.rover-light{opacity:.12}
.constellation-lines{stroke-dasharray:3 4}
`

function place(markup: string, x: number, y: number, w: number, h: number): string {
  return markup.replace(/^<svg /, `<svg x="${x}" y="${y}" width="${w}" height="${h}" `)
}

function destinationsRow(): string {
  const moon = place(renderToStaticMarkup(<HoloDestination kind="moon" label="Moon" />), 6, 92, 100, 100)
  const mars = place(renderToStaticMarkup(<HoloDestination kind="mars" label="Mars" />), 110, 92, 100, 100)
  const deep = place(renderToStaticMarkup(<HoloDestination kind="deep" label="Deep Space" />), 214, 92, 100, 100)
  const labels = `
    <g font-family="system-ui, sans-serif" font-size="12" letter-spacing="3" fill="#FDF4EC" fill-opacity=".75" text-anchor="middle">
      <text x="56" y="214">MOON</text>
      <text x="160" y="214">MARS</text>
      <text x="264" y="214">DEEP SPACE</text>
    </g>`
  return moon + mars + deep + labels
}

function forgottenScene(): string {
  const rover = place(renderToStaticMarkup(<RoverSilhouette />), 40, 26, 240, 175)
  // Keep the phrase well inside the 320-wide safe area of the round
  // window: ~29 glyphs at 11px + 2px tracking fit with margin.
  const phrase = `
    <text x="160" y="236" text-anchor="middle" font-family="Georgia, serif" font-size="11"
      letter-spacing="2" fill="#FFD9A8">ABANDONED, BUT NOT FORGOTTEN</text>`
  return rover + phrase
}

function invitationScene(): string {
  return place(renderToStaticMarkup(<EnvelopeHologram facing />), 66, 66, 188, 148)
}

function reflectionScene(): string {
  return place(renderToStaticMarkup(<SpiritConstellation />), 34, 52, 252, 200)
}

const SCENES: Record<Exclude<IntroMoment, 'welcome'>, () => string> = {
  explorers: destinationsRow,
  forgotten: forgottenScene,
  invitation: invitationScene,
  reflection: reflectionScene,
}

/** Standalone SVG (512x512) for the given intro moment, or null for
 *  Welcome (no hologram: PIP is the only focus). */
export function introHologramSvg(moment: IntroMoment): string | null {
  if (moment === 'welcome') return null
  const inner = SCENES[moment]()
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet">` +
    `<style>${EMBEDDED_STYLE}</style>${inner}</svg>`
  )
}
