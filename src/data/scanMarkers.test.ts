import { describe, expect, it } from 'vitest'
import { SPIRIT_SCAN_ANCHORS } from './spiritSite'
import { getMission } from './missions'
import {
  LENS_PIP_COOLDOWN_MS,
  canSpeakLensHint,
  lensFeedbackChannel,
  shouldPulseCorrectLens,
  wrongLensPanelLine,
} from './lensFeedback'
import {
  fragmentLabel,
  getMarkerViews,
  getNextMarkerNumber,
} from './scanMarkers'

const ids = SPIRIT_SCAN_ANCHORS.map((a) => a.componentId)

describe('scan markers', () => {
  it('numbers every mission component exactly once, from data', () => {
    const missionIds = getMission('spirit').components.map((c) => c.id)
    expect([...ids].sort()).toEqual([...missionIds].sort())
    expect(getMarkerViews(ids, [], null).map((m) => m.number)).toEqual([1, 2, 3])
  })

  it('marks pending / next / aimed / recorded', () => {
    expect(getMarkerViews(ids, [], null).map((m) => m.state)).toEqual([
      'next',
      'pending',
      'pending',
    ])
    expect(getMarkerViews(ids, [ids[0]!], ids[2]!).map((m) => m.state)).toEqual([
      'recorded',
      'next',
      'aimed',
    ])
    expect(
      getMarkerViews(ids, [...ids], null).every((m) => m.state === 'recorded'),
    ).toBe(true)
  })

  it('aiming the next marker shows it as aimed, not next', () => {
    expect(getMarkerViews(ids, [], ids[0]!)[0]!.state).toBe('aimed')
  })

  it('suggests 1 → 2 → 3 without blocking another order', () => {
    expect(getNextMarkerNumber(ids, [])).toBe(1)
    expect(getNextMarkerNumber(ids, [ids[1]!])).toBe(1)
    expect(getNextMarkerNumber(ids, [ids[0]!, ids[1]!])).toBe(3)
    expect(getNextMarkerNumber(ids, [...ids])).toBeNull()
  })

  it('never names a part before it is recorded', () => {
    const mission = getMission('spirit')
    for (const id of ids) {
      const label = fragmentLabel(ids, id).toLowerCase()
      for (const component of mission.components) {
        expect(label).not.toContain(component.shortName.toLowerCase())
      }
      expect(label).toMatch(/^fragment [123]$/)
    }
  })
})

describe('lens feedback ladder', () => {
  it('is panel only, then one PIP line, then a pulse', () => {
    expect(lensFeedbackChannel(1)).toBe('panel')
    expect(lensFeedbackChannel(2)).toBe('pip')
    expect(lensFeedbackChannel(3)).toBe('pulse')
    expect(lensFeedbackChannel(9)).toBe('pulse')
  })

  it('pulses the correct lens only from the third miss', () => {
    expect(shouldPulseCorrectLens(2)).toBe(false)
    expect(shouldPulseCorrectLens(3)).toBe(true)
  })

  it('keeps a cooldown between PIP lens hints', () => {
    expect(canSpeakLensHint(null, 5)).toBe(true)
    expect(canSpeakLensHint(1000, 1000 + LENS_PIP_COOLDOWN_MS - 1)).toBe(false)
    expect(canSpeakLensHint(1000, 1000 + LENS_PIP_COOLDOWN_MS)).toBe(true)
  })

  it('uses one short fixed panel line naming only the current lens', () => {
    const line = wrongLensPanelLine('Fragment 1', 'Visual lens')
    expect(line).toBe('Fragment 1 · Visual lens finds nothing here')
    expect(line.length).toBeLessThan(60)
  })
})
