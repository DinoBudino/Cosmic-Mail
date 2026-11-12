import { describe, expect, it } from 'vitest'
import { introHologramSvg } from './introHologramTexture'
import type { IntroHologramState } from '../../data/onboardingNarrative'

const STATES: IntroHologramState[] = [
  'stable',
  'losing1',
  'losing2',
  'losing3',
  'fragmented',
  'recovering',
  'hint',
  'dossier',
  'letter',
]

describe('intro hologram frames', () => {
  it('renders no projection for the opening welcome beat', () => {
    expect(introHologramSvg('none')).toBeNull()
  })

  it('renders a standalone 320x320 SVG for every visual state', () => {
    for (const state of STATES) {
      const svg = introHologramSvg(state)
      expect(svg).not.toBeNull()
      expect(svg).toContain('viewBox="0 0 320 320"')
      expect(svg).toContain('width="512"')
      expect(svg).toContain('height="512"')
    }
  })

  it('communicates stable, failed and recovered states differently', () => {
    expect(introHologramSvg('stable')).toContain(
      'Three anonymous archive files connected',
    )
    expect(introHologramSvg('fragmented')).toContain(
      'lose their connections and fragment',
    )
    expect(introHologramSvg('hint')).toContain('location clue')
    expect(introHologramSvg('letter')).toContain('smart letter')
  })

  it('never reveals a historical machine identity', () => {
    for (const state of STATES) {
      expect(introHologramSvg(state)).not.toMatch(/Surveyor|Spirit|Pioneer/i)
    }
  })
})
