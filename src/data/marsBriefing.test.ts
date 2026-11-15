import { describe, expect, it } from 'vitest'
import {
  BRIEFING_STEPS,
  briefingStep,
  getBriefingTexts,
  isLastBriefingStep,
  learnedTools,
  nextBriefingIndex,
} from './marsBriefing'
import {
  INITIAL_PROTOCOL_FLAGS,
  isRadarVisible,
  needsArrivalBriefing,
} from './arrivalProtocol'
import { lineProblems } from './pipDialogPolicy'
import { getMission } from './missions'

const indexOf = (id: string) => BRIEFING_STEPS.findIndex((step) => step.id === id)

describe('Mars arrival briefing', () => {
  it('cheers, mentions the signal and presents the radar before the tutorial', () => {
    expect(BRIEFING_STEPS.slice(0, 3).map((step) => step.id)).toEqual(['arrival', 'signal', 'radar'])
    expect(briefingStep(indexOf('arrival')).showRadar).toBe(false)
    expect(briefingStep(indexOf('radar')).showRadar).toBe(true)
    expect(briefingStep(indexOf('arrival')).expression).toBe('celebrating')
  })

  it('teaches the radar first, then the scanner, opening each card himself', () => {
    const tools = indexOf('tools')
    expect(briefingStep(tools).focus).toBe('radar')
    // Tapping the other card does nothing; the button opens PIP's card.
    expect(nextBriefingIndex(tools, { kind: 'card', tool: 'scanner' })).toBe(tools)
    const radarDetail = nextBriefingIndex(tools, { kind: 'button' })
    expect(briefingStep(radarDetail).id).toBe('radar-detail')
    // Tapping the card PIP points at is a shortcut to the same place.
    expect(nextBriefingIndex(tools, { kind: 'card', tool: 'radar' })).toBe(radarDetail)
    const toolsScanner = nextBriefingIndex(radarDetail, { kind: 'button' })
    expect(briefingStep(toolsScanner).focus).toBe('scanner')
    expect(learnedTools(toolsScanner)).toEqual(['radar'])
    const scannerDetail = nextBriefingIndex(toolsScanner, { kind: 'button' })
    expect(briefingStep(scannerDetail).id).toBe('scanner-detail')
    const ready = nextBriefingIndex(scannerDetail, { kind: 'button' })
    expect(learnedTools(ready)).toEqual(['radar', 'scanner'])
    expect(isLastBriefingStep(ready)).toBe(true)
  })

  it('never asks the child to tap a card to follow the tutorial', () => {
    for (const step of BRIEFING_STEPS) {
      expect(step.cta, step.id).toBeTruthy()
      expect(step.line, step.id).not.toMatch(/\b(tap|click|press)\b/i)
    }
  })

  it('fills the progress bar as the tutorial advances', () => {
    const bar = BRIEFING_STEPS.filter((step) => step.view !== 'pip').map((step) => step.progress)
    for (let at = 1; at < bar.length; at += 1) expect(bar[at]).toBeGreaterThanOrEqual(bar[at - 1]!)
    expect(bar.at(-1)).toBe(1)
  })

  it('keeps every PIP line short and never names the explorer', () => {
    const mission = getMission('spirit')
    for (const step of BRIEFING_STEPS) expect(lineProblems(step.line), step.id).toEqual([])
    for (const text of getBriefingTexts()) {
      expect(text.toLowerCase()).not.toContain(mission.machineName.toLowerCase())
    }
  })

  it('runs only on a fresh landing, until the child finishes it', () => {
    const fresh = { progress: null, flags: INITIAL_PROTOCOL_FLAGS, priorFieldWork: false }
    expect(needsArrivalBriefing(fresh)).toBe(true)
    expect(needsArrivalBriefing({ ...fresh, flags: { ...INITIAL_PROTOCOL_FLAGS, briefed: true } })).toBe(false)
    expect(needsArrivalBriefing({ ...fresh, priorFieldWork: true })).toBe(false)
  })

  it('shows the radar from the landing once PIP has presented it', () => {
    expect(isRadarVisible('M0')).toBe(false)
    expect(isRadarVisible('M0', { radarShown: true })).toBe(true)
    expect(isRadarVisible('M1')).toBe(true)
  })
})
