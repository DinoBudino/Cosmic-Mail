import { describe, expect, it } from 'vitest'
import { introHologramSvg, pipPanelSvg } from './introHologramTexture'
import {
  INTRO_BEATS,
  introHologramTimeline,
  type IntroHologramState,
} from '../../data/onboardingNarrative'
import { DESTINATIONS } from '../../data/destinations'

const STATES: IntroHologramState[] = [
  'mail',
  'stable',
  'losing1',
  'losing3',
  'solarAlert',
  'solarStorm',
  'stormImpact',
  'syncError',
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

/** Every still the intro can project, from the beat sheet. */
const ALL_FRAMES = INTRO_BEATS.flatMap((_, i) => introHologramTimeline(i)).filter(
  (frame) => frame.state !== 'none',
)

const visibleText = (svg: string | null) =>
  (svg ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('intro hologram frames', () => {
  it('renders no projection for the opening welcome beat', () => {
    expect(introHologramSvg('none')).toBeNull()
  })

  it('renders a standalone 320x320 SVG for every state and every animation step', () => {
    for (const state of STATES) {
      const svg = introHologramSvg(state)
      expect(svg, state).not.toBeNull()
      expect(svg).toContain('viewBox="0 0 320 320"')
      expect(svg).toContain('width="512"')
      expect(svg).toContain('height="512"')
    }
    for (const frame of ALL_FRAMES) {
      expect(introHologramSvg(frame.state, frame.variant), `${frame.state}:${frame.variant}`).toMatch(
        /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/,
      )
    }
  })

  it('gives every animation step its own picture', () => {
    const keys = [...new Set(ALL_FRAMES.map((frame) => `${frame.state}:${frame.variant}`))]
    const pictures = keys.map((key) => {
      const [state, variant] = key.split(':')
      return introHologramSvg(state as IntroHologramState, Number(variant))
    })
    expect(new Set(pictures).size).toBe(keys.length)
  })

  it('communicates stable, failed and recovered states differently', () => {
    expect(introHologramSvg('stable')).toContain('Many anonymous archive files connected')
    expect(introHologramSvg('fragmented')).toContain('break into geometric pieces')
    expect(introHologramSvg('memory')).toContain('memory banks')
    expect(introHologramSvg('locations')).toContain('two approximate signal areas')
    expect(introHologramSvg('dossier')).toContain('signals gone quiet')
    expect(introHologramSvg('letter', 5)).toContain('smart letter')
  })

  it('shows the solar alert and Archive warnings in words, one level at a time', () => {
    const alert = visibleText(introHologramSvg('solarAlert'))
    expect(alert).toContain('EXTREME SOLAR')
    expect(alert).toContain('ACTIVITY DETECTED')
    expect(alert).toContain('COSMIC ARCHIVE CONNECTION UNSTABLE')
    // The diagnostic runs before the alert appears.
    expect(visibleText(introHologramSvg('solarAlert', 2))).not.toContain('EXTREME')

    const sync = visibleText(introHologramSvg('syncError'))
    expect(sync).toContain('COMMUNICATION LINK LOST')
    expect(sync).toContain('ARCHIVE SYNC INTERRUPTED')
    expect(visibleText(introHologramSvg('syncError', 3))).not.toContain('LINK LOST')
    expect(visibleText(introHologramSvg('fragmented'))).toContain('MEMORY RECORDS INCOMPLETE')
    expect(visibleText(introHologramSvg('offline'))).toContain('RECOVERY ATTEMPT FAILED')
  })

  it('projects the storm as recorded, sped-up science data', () => {
    const storm = introHologramSvg('solarStorm')!
    expect(storm).toContain('coronal mass ejection')
    expect(visibleText(storm)).toContain('RECORDED SOLAR DATA · SPED UP')
    expect(visibleText(storm)).toContain('CORONAL MASS EJECTION')
    expect(visibleText(introHologramSvg('stormImpact'))).toContain('AFFECTED')
    // The calm Sun comes first: no ejection before the eruption step.
    expect(visibleText(introHologramSvg('solarStorm', 3))).not.toContain('CORONAL')
  })

  it('keeps backup signals after the failed recovery', () => {
    expect(visibleText(introHologramSvg('offline'))).toContain('BACKUP SIGNALS')
  })

  it('marks the two signal areas from the real destinations as approximate', () => {
    const route = visibleText(introHologramSvg('route'))
    for (const destination of DESTINATIONS) {
      expect(route).toContain(destination.name.toUpperCase())
    }
    expect(route).toContain('approx. signal')
    expect(route).toContain('PENDING')
  })

  it('labels the letter animation as a preview, never as real progress', () => {
    for (const variant of [0, 1, 2, 3, 4]) {
      expect(visibleText(introHologramSvg('letter', variant))).toContain('PREVIEW')
    }
  })

  it('renders PIP side panels with words for every status', () => {
    const diagnostic = visibleText(pipPanelSvg('diagnostic'))
    expect(diagnostic).toContain('MAILWING DIAGNOSTIC')
    expect(diagnostic).toContain('EXTREME')
    const memory = visibleText(pipPanelSvg('memoryCheck'))
    expect(memory).toContain('PIP MEMORY CHECK')
    expect(memory).toContain('FRAGMENTED')
    expect(memory).toContain('OK')
  })

  it('never reveals a historical machine identity or real-world logos', () => {
    for (const frame of ALL_FRAMES) {
      expect(introHologramSvg(frame.state, frame.variant)).not.toMatch(
        /Surveyor|Spirit|Opportunity|Pioneer|NASA|SOHO/i,
      )
    }
  })
})
