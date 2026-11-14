import { describe, expect, it } from 'vitest'
import { getMission } from './missions'
import {
  SCANNER_LENS_IDS,
  SCANNER_LENSES,
  cycleScannerLens,
  isScannerLensId,
  lensForKey,
  lensMatchesComponent,
} from './scannerLenses'
import { SPIRIT_DISTRACTOR_ANCHORS, SPIRIT_SCAN_ANCHORS } from './spiritSite'
import { findComponent } from './missions'

describe('scanner lens rules', () => {
  it('maps keys 1/2/3 to distinct lenses and ignores other keys', () => {
    expect(lensForKey('1')).toBe('visual')
    expect(lensForKey('2')).toBe('contact')
    expect(lensForKey('3')).toBe('thermal')
    expect(lensForKey('4')).toBeNull()
    expect(lensForKey('q')).toBeNull()
    expect(
      new Set(SCANNER_LENS_IDS.map((id) => SCANNER_LENSES[id].key)).size,
    ).toBe(SCANNER_LENS_IDS.length)
  })

  it('cycles forwards and backwards with wrap-around', () => {
    expect(cycleScannerLens('visual')).toBe('contact')
    expect(cycleScannerLens('thermal')).toBe('visual')
    expect(cycleScannerLens('visual', -1)).toBe('thermal')
    expect(isScannerLensId('contact')).toBe(true)
    expect(isScannerLensId('radar')).toBe(false)
  })

  it('accepts a component only with its own lens', () => {
    expect(lensMatchesComponent({ lens: 'contact' }, 'contact')).toBe(true)
    expect(lensMatchesComponent({ lens: 'contact' }, 'visual')).toBe(false)
    // Content without a declared lens is not gated.
    expect(lensMatchesComponent({}, 'thermal')).toBe(true)
  })
})

describe('Spirit lens content', () => {
  const mission = getMission('spirit')

  it('binds each instrument to the lens matching its real function', () => {
    expect(findComponent('spirit', 'spirit-pancam')?.lens).toBe('visual')
    expect(findComponent('spirit', 'spirit-rock-abrasion-tool')?.lens).toBe(
      'contact',
    )
    expect(findComponent('spirit', 'spirit-mini-tes')?.lens).toBe('thermal')
  })

  it('has lens hints that never reveal the lens before the direct level', () => {
    for (const component of mission.components) {
      expect(component.lensHints).toBeDefined()
      expect(component.lensHints!.context).not.toMatch(/lens|\(\d\)/i)
      expect(component.lensHints!.direct).toMatch(/lens/i)
    }
  })

  it('keeps distractors source-checked, sourced and never progress components', () => {
    const componentIds = new Set(mission.components.map((c) => c.id))
    expect(mission.distractors?.length).toBeGreaterThanOrEqual(2)
    for (const distractor of mission.distractors ?? []) {
      expect(distractor.validation).toBe('source-checked')
      expect(distractor.sources.length).toBeGreaterThan(0)
      expect(distractor.sources.every((s) => s.url.startsWith('https://'))).toBe(
        true,
      )
      expect(componentIds.has(distractor.id)).toBe(false)
      expect(distractor.pipNote.length).toBeGreaterThan(0)
    }
    expect(mission.distractors?.map((d) => d.id).sort()).toEqual(
      SPIRIT_DISTRACTOR_ANCHORS.map((a) => a.distractorId).sort(),
    )
  })

  it('does not claim unverified rover facts', () => {
    const text = JSON.stringify(mission.distractors)
    expect(text).not.toMatch(/rocker|bogie|high-gain/i)
  })

  it('keeps distractor hit boxes clear of component anchors', () => {
    for (const d of SPIRIT_DISTRACTOR_ANCHORS) {
      for (const c of SPIRIT_SCAN_ANCHORS) {
        const overlaps = [0, 1, 2].every((axis) => {
          const dMin = d.position[axis] + d.hitOffset[axis] - d.hitSize[axis] / 2
          const dMax = d.position[axis] + d.hitOffset[axis] + d.hitSize[axis] / 2
          const cMin = c.position[axis] + c.hitOffset[axis] - c.hitSize[axis] / 2
          const cMax = c.position[axis] + c.hitOffset[axis] + c.hitSize[axis] / 2
          return dMin < cMax && dMax > cMin
        })
        expect(overlaps, `${d.distractorId} overlaps ${c.componentId}`).toBe(false)
      }
    }
  })
})
