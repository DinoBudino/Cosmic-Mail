import { renderToStaticMarkup } from 'react-dom/server'
import { getTraitAbility } from '../../data/traitAbilities'
import { getTrait, type HistoricalExplorer } from '../../data/personalization'
import { AbilityIcon, HeroPortrait, TraitSigil } from './RoutineCheckVisuals'

/**
 * Hero presentation, composed as ONE standalone SVG and projected
 * inside the Cosmic Memory Window (3D circular mesh), so PIP passes
 * in front of it and the round frame clips it. Uses only the
 * verified catalog plus the presentation-only ability metadata.
 */

const EMBEDDED_STYLE = `
.hero-portrait{width:100%;height:100%}
`

function place(markup: string, x: number, y: number, w: number, h: number): string {
  return markup.replace(/^<svg /, `<svg x="${x}" y="${y}" width="${w}" height="${h}" `)
}

/** Greedy word wrap for SVG <text> (no foreignObject: it is not
 *  rasterized inside an <img>). */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

function lines(lines: string[], x: number, lineHeight: number): string {
  return lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`)
    .join('')
}

/**
 * Safe content area inside the round window (viewBox 320×320, circle
 * centre 160,160 radius 160). Everything essential stays in a centred
 * band ~250 units wide and above y≈250, clear of the curved bottom.
 */
export function explorerHologramSvg(hero: HistoricalExplorer): string {
  const trait = getTrait(hero.trait)
  const ability = getTraitAbility(hero.trait)
  const traitLabel = trait.name.toUpperCase()
  const portrait = place(
    renderToStaticMarkup(<HeroPortrait name={hero.name} accent={hero.accent} />),
    130, 40, 60, 60,
  )
  const emblem = place(
    renderToStaticMarkup(<TraitSigil trait={hero.trait} />),
    148, 16, 24, 24,
  )
  // Icon sits to the left of the ability name, so it never crowds the
  // history text or the divider.
  const iconX = 160 - (ability.name.length * 6.6) / 2 - 22
  const abilityIcon = place(
    renderToStaticMarkup(<AbilityIcon trait={hero.trait} />),
    iconX, 230, 14, 14,
  )
  const abilityLines = wrap(ability.description, 44).slice(0, 2)
  // History comes FIRST, then a divider, then the special power.
  const bioLines = wrap(hero.bio, 44).slice(0, 3)
  // Long names ("Katherine Johnson", "Margaret Hamilton") need a
  // slightly smaller size to stay inside the safe width.
  const nameSize = hero.name.length > 17 ? 18 : 20

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet">` +
    `<style>${EMBEDDED_STYLE}</style>` +
    // Soft aura behind the portrait.
    `<circle cx="160" cy="68" r="46" fill="${hero.accent}" fill-opacity=".10"/>` +
    `<circle cx="160" cy="68" r="38" fill="none" stroke="${hero.accent}" stroke-opacity=".35"/>` +
    `<g style="color:${hero.accent}">${emblem}</g>` +
    portrait +
    `<text x="160" y="114" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9"
       letter-spacing="2.6" fill="#FDF4EC" fill-opacity=".55">YOUR HISTORICAL EXPLORER</text>` +
    `<text x="160" y="136" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${nameSize}"
       font-weight="700" fill="#FDF4EC">${hero.name}</text>` +
    `<text x="160" y="152" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9.5"
       letter-spacing="2.4" fill="${hero.accent}" fill-opacity=".95">${traitLabel}</text>` +
    // 3. Real historical contribution (education first).
    `<text x="160" y="170" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9.5"
       fill="#FDF4EC" fill-opacity=".78">${lines(bioLines, 160, 12)}</text>` +
    // 4. Discreet divider between history and the fictional power.
    `<line x1="92" y1="206" x2="228" y2="206" stroke="${hero.accent}" stroke-opacity=".35"/>` +
    `<circle cx="160" cy="206" r="2" fill="${hero.accent}" fill-opacity=".55"/>` +
    // 5. YOUR SPECIAL POWER block.
    `<text x="160" y="220" text-anchor="middle" font-family="system-ui, sans-serif" font-size="8.5"
       letter-spacing="2.4" fill="${hero.accent}" fill-opacity=".9">YOUR SPECIAL POWER</text>` +
    `<g style="color:${hero.accent}">${abilityIcon}</g>` +
    `<text x="160" y="242" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12.5"
       font-weight="700" fill="#FDF4EC">${ability.name}</text>` +
    `<text x="160" y="256" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9.5"
       fill="#FDF4EC" fill-opacity=".75">${lines(abilityLines, 160, 12)}</text>` +
    `</svg>`
  )
}
