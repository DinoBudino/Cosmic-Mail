import { describe, expect, it } from 'vitest'
import { introHologramSvg } from './introHologramTexture'
import type { IntroHologramState } from '../../data/onboardingNarrative'

const STATES: IntroHologramState[] = [
  'mail',
  'stable',
  'losing1',
  'losing3',
  'fragmented',
  'recovering',
  'offline',
  'memory',
  'forgotten',
  'locations',
  'route',
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
      'Many anonymous archive files connected',
    )
    expect(introHologramSvg('fragmented')).toContain(
      'lose their connections and fragment',
    )
    expect(introHologramSvg('memory')).toContain('memory banks')
    expect(introHologramSvg('locations')).toContain('two remembered places')
    expect(introHologramSvg('dossier')).toContain('signals gone quiet')
    expect(introHologramSvg('letter')).toContain('smart letter')
  })

  it('gives every beat its own distinct projection', () => {
    const frames = STATES.map((state) => introHologramSvg(state))
    expect(new Set(frames).size).toBe(STATES.length)
  })

  it('never reveals a historical machine identity', () => {
    for (const state of STATES) {
      expect(introHologramSvg(state)).not.toMatch(/Surveyor|Spirit|Pioneer/i)
    }
  })
})
