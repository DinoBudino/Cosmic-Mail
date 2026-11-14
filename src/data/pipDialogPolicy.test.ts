import { describe, expect, it } from 'vitest'
import {
  MAX_LINE_CHARS,
  REPEAT_WINDOW_MS,
  UNSOLICITED_GAP_MS,
  countSentences,
  createPolicyMemory,
  decideCue,
  fitLine,
  lineProblems,
  rememberCue,
  tierForPriority,
  type PolicyCue,
} from './pipDialogPolicy'

const cue = (over: Partial<PolicyCue> = {}): PolicyCue => ({
  text: 'A short line.',
  tier: 1,
  solicited: false,
  ...over,
})
const fresh = createPolicyMemory()

describe('tiers', () => {
  it('maps the narrative priorities onto P0–P3', () => {
    expect(tierForPriority('archive')).toBe(0)
    expect(tierForPriority('mission')).toBe(1)
    expect(tierForPriority('discovery')).toBe(1)
    expect(tierForPriority('hint')).toBe(2)
    expect(tierForPriority('ambient')).toBe(3)
  })
})

describe('line limits', () => {
  it('counts sentences and flags long or multi-sentence lines', () => {
    expect(countSentences('One. Two! Three?')).toBe(3)
    expect(lineProblems('Short and fine.')).toEqual([])
    expect(lineProblems('One. Two. Three.')).toContain('too-many-sentences')
    expect(lineProblems('x'.repeat(MAX_LINE_CHARS + 1))).toContain('too-long')
  })

  it('fits an over-long line without cutting a word in half', () => {
    const long = 'First sentence is fine. Second one is fine too. Third is extra.'
    const fitted = fitLine(long)
    expect(lineProblems(fitted)).toEqual([])
    expect(fitted).toBe('First sentence is fine. Second one is fine too.')
    const wall = 'word '.repeat(80).trim()
    const cut = fitLine(wall)
    expect(cut.length).toBeLessThanOrEqual(MAX_LINE_CHARS)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut.slice(0, -1).split(' ').every((w) => w === 'word')).toBe(true)
  })

  it('leaves a compliant line untouched', () => {
    expect(fitLine('Radar online. Follow the trail.')).toBe(
      'Radar online. Follow the trail.',
    )
  })
})

describe('one voice at a time', () => {
  it('plays immediately when PIP is quiet', () => {
    expect(decideCue(fresh, null, 0, cue(), 0).action).toBe('play')
  })

  it('a higher tier preempts; an equal or lower one queues or drops', () => {
    expect(decideCue(fresh, { tier: 2 }, 0, cue({ tier: 0 }), 0).action).toBe(
      'preempt',
    )
    expect(decideCue(fresh, { tier: 1 }, 0, cue({ tier: 1 }), 0).action).toBe(
      'queue',
    )
    expect(decideCue(fresh, { tier: 0 }, 0, cue({ tier: 1 }), 0).action).toBe(
      'queue',
    )
  })

  it('drops optional lines (P2/P3) while something is playing or queued', () => {
    const d = decideCue(fresh, { tier: 1 }, 0, cue({ tier: 2 }), 0)
    expect(d).toEqual({ action: 'drop', reason: 'busy' })
    expect(decideCue(fresh, null, 1, cue({ tier: 3 }), 0).action).toBe('drop')
  })
})

describe('frequency and repetition', () => {
  it('allows one unsolicited low-tier line per gap', () => {
    const memory = rememberCue(fresh, cue({ tier: 3, text: 'Ambient one.' }), 1000)
    const soon = decideCue(
      memory,
      null,
      0,
      cue({ tier: 3, text: 'Ambient two.' }),
      1000 + UNSOLICITED_GAP_MS - 1,
    )
    expect(soon).toEqual({ action: 'drop', reason: 'gap' })
    const later = decideCue(
      memory,
      null,
      0,
      cue({ tier: 3, text: 'Ambient two.' }),
      1000 + UNSOLICITED_GAP_MS,
    )
    expect(later.action).toBe('play')
  })

  it('never throttles story beats, scan feedback or solicited lines', () => {
    const memory = rememberCue(fresh, cue({ tier: 3 }), 1000)
    expect(decideCue(memory, null, 0, cue({ tier: 0, text: 'B' }), 1001).action).toBe('play')
    expect(decideCue(memory, null, 0, cue({ tier: 1, text: 'C' }), 1001).action).toBe('play')
    expect(
      decideCue(memory, null, 0, cue({ tier: 2, text: 'D', solicited: true }), 1001)
        .action,
    ).toBe('play')
  })

  it('does not repeat the same line inside the window', () => {
    const memory = rememberCue(fresh, cue({ text: 'Same.' }), 1000)
    expect(
      decideCue(memory, null, 0, cue({ text: 'Same.' }), 1000 + REPEAT_WINDOW_MS - 1),
    ).toEqual({ action: 'drop', reason: 'repeat' })
    expect(
      decideCue(memory, null, 0, cue({ text: 'Same.' }), 1000 + REPEAT_WINDOW_MS)
        .action,
    ).toBe('play')
  })

  it('lets the player ask for the same answer again', () => {
    const asked = cue({ tier: 0, solicited: true, text: 'Walk with WASD.' })
    const memory = rememberCue(fresh, asked, 1000)
    expect(decideCue(memory, null, 0, asked, 2000).action).toBe('play')
  })

  it('forgets old repeat memory', () => {
    let memory = rememberCue(fresh, cue({ text: 'Old.' }), 0)
    memory = rememberCue(memory, cue({ text: 'New.' }), 200_000)
    expect(Object.keys(memory.recent)).toEqual(['New.'])
  })
})
