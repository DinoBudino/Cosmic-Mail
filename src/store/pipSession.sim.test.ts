import { beforeEach, describe, expect, it } from 'vitest'
import {
  CALIBRATE_FIRST_LINE,
  LATER_LINE,
  OFF_TRAIL_LINE,
  SAMPLE_LENS_LINE,
  STEP_ENTRY_LINES,
} from '../data/arrivalProtocol'
import { REPEAT_WINDOW_MS } from '../data/pipDialogPolicy'
import {
  requestProtocolLine,
  resetProtocolNotices,
} from '../game/missionNarrative'
import { useNarrativeStore, type StoredNarrativeLine } from './narrativeStore'

/**
 * Deterministic stand-in for browser measurements: it drives the real
 * narrative store (and therefore the real dialogue policy) with a scripted
 * timeline and reports what PIP would have said. It measures the policy, not
 * a human playthrough: the in-browser numbers still have to be taken by hand.
 */

interface Spoken {
  at: number
  line: StoredNarrativeLine
}

const LINE_SECONDS = 4

function run(
  script: ReadonlyArray<{ at: number; act: (now: number) => void }>,
  durationMs: number,
): Spoken[] {
  const spoken: Spoken[] = []
  let current: StoredNarrativeLine | null = null
  let endsAt = 0
  const events = [...script].sort((a, b) => a.at - b.at)
  let next = 0
  for (let t = 0; t <= durationMs; t += 250) {
    // The playing line ends after a few seconds, like the voice would.
    if (current && t >= endsAt) {
      useNarrativeStore.getState().complete()
    }
    while (next < events.length && events[next]!.at <= t) {
      events[next]!.act(t)
      next += 1
    }
    const now = useNarrativeStore.getState().current
    if (now && now.nonce !== current?.nonce) {
      spoken.push({ at: t, line: now })
      endsAt = t + LINE_SECONDS * 1000
    }
    current = now
  }
  return spoken
}

const enq = (
  id: string,
  text: string,
  priority: 'ambient' | 'hint' | 'mission' | 'archive' | 'discovery',
  extra: object = {},
) => ({
  at: 0,
  act: (now: number) =>
    void useNarrativeStore
      .getState()
      .enqueue({ id, text, priority, once: false, ...extra }, now),
})

function at(ms: number, event: ReturnType<typeof enq>) {
  return { at: ms, act: event.act }
}

function perMinute(spoken: Spoken[]) {
  const buckets = new Map<number, number>()
  for (const { at: t, line } of spoken) {
    if (line.solicited) continue
    const minute = Math.floor(t / 60_000)
    buckets.set(minute, (buckets.get(minute) ?? 0) + 1)
  }
  return [...buckets.values()]
}

function repeatsInsideWindow(spoken: Spoken[]): number {
  let repeats = 0
  for (let i = 0; i < spoken.length; i += 1) {
    for (let j = i + 1; j < spoken.length; j += 1) {
      if (spoken[j]!.at - spoken[i]!.at >= REPEAT_WINDOW_MS) break
      if (spoken[j]!.line.text === spoken[i]!.line.text) repeats += 1
    }
  }
  return repeats
}

describe('PIP session simulation (policy only, not a playthrough)', () => {
  beforeEach(() => {
    useNarrativeStore.getState().reset()
    resetProtocolNotices()
  })

  it('a realistic 4-minute arrival (M0–M6): no ambient, optional chatter ≤ 4 a minute, no repeats', () => {
    const protocol = (line: { id: string; text: string }, ms: number) => ({
      at: ms,
      act: (now: number) => void requestProtocolLine(line, 20_000, now),
    })
    const script = [
      at(0, enq('entered', 'We are here. Follow the signal.', 'mission')),
      at(12_000, enq(STEP_ENTRY_LINES.M1!.id, STEP_ENTRY_LINES.M1!.text, 'mission', { tier: 0 })),
      protocol(OFF_TRAIL_LINE, 30_000),
      protocol(OFF_TRAIL_LINE, 36_000),
      at(45_000, enq(STEP_ENTRY_LINES.M2!.id, STEP_ENTRY_LINES.M2!.text, 'mission', { tier: 0 })),
      protocol(SAMPLE_LENS_LINE, 55_000),
      at(65_000, enq(STEP_ENTRY_LINES.M3!.id, STEP_ENTRY_LINES.M3!.text, 'mission', { tier: 0 })),
      protocol(CALIBRATE_FIRST_LINE, 70_000),
      at(80_000, enq('detected', 'Something is over there.', 'discovery')),
      at(95_000, enq('approached', 'Closer now.', 'discovery')),
      at(105_000, enq('identified', 'An old explorer. Its record is back.', 'discovery')),
      at(130_000, enq('c1', 'First fragment recovered.', 'discovery')),
      at(165_000, enq('c2', 'Second fragment recovered.', 'discovery')),
      at(195_000, enq('c3', 'Third fragment recovered.', 'discovery')),
      at(200_000, enq('ready', 'Ready for the full scan.', 'mission')),
      // Voluntary nudges and ambient tries keep knocking all the time.
      ...Array.from({ length: 12 }, (_, i) =>
        at(20_000 * (i + 1), enq(`amb-${i}`, `Ambient ${i}.`, 'ambient')),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        at(35_000 * (i + 1), enq(`soft-${i}`, `Soft hint ${i}.`, 'hint')),
      ),
    ]
    const spoken = run(script, 240_000)
    // Ambient (P3) is free-exploration only: none of the 12 offered plays.
    expect(spoken.filter((s) => s.line.tier === 3)).toHaveLength(0)
    // Guided protocol and story beats (P0/P1) are exempt; everything else is
    // the optional chatter the brief wants at 4 a minute or fewer.
    const optional = spoken.filter(
      (s) => s.line.tier >= 2 && !s.line.solicited,
    )
    expect(Math.max(0, ...perMinute(optional))).toBeLessThanOrEqual(4)
    expect(repeatsInsideWindow(spoken)).toBe(0)
  })

  it('free exploration (M7): all unsolicited chatter together stays at or under 4 a minute', () => {
    useNarrativeStore.getState().setAmbientAllowed(true)
    const script = [
      ...Array.from({ length: 48 }, (_, i) =>
        at(i * 5_000, enq(`amb-${i}`, `Observation ${i}.`, 'ambient')),
      ),
      ...Array.from({ length: 24 }, (_, i) =>
        at(i * 10_000 + 2_500, enq(`soft-${i}`, `Nudge ${i}.`, 'hint')),
      ),
    ]
    const spoken = run(script, 240_000)
    expect(spoken.length).toBeGreaterThan(0)
    expect(Math.max(...perMinute(spoken))).toBeLessThanOrEqual(4)
    expect(repeatsInsideWindow(spoken)).toBe(0)
  })

  it('a stress run (everything firing every few seconds) never repeats a line in the window', () => {
    useNarrativeStore.getState().setAmbientAllowed(true)
    const script = [
      ...Array.from({ length: 80 }, (_, i) =>
        at(
          i * 3_000,
          enq(`same-${i}`, i % 3 === 0 ? 'Keep going.' : `Remark ${i % 7}.`, 'ambient'),
        ),
      ),
      ...Array.from({ length: 40 }, (_, i) => ({
        at: i * 6_000,
        act: (now: number) => {
          requestProtocolLine(LATER_LINE, 30_000, now)
          requestProtocolLine(OFF_TRAIL_LINE, 25_000, now)
        },
      })),
    ]
    const spoken = run(script, 240_000)
    expect(repeatsInsideWindow(spoken)).toBe(0)
    // No two optional lines closer than the unsolicited gap.
    const optional = spoken.filter((s) => s.line.tier >= 2 && !s.line.solicited)
    for (let i = 1; i < optional.length; i += 1) {
      expect(optional[i]!.at - optional[i - 1]!.at).toBeGreaterThanOrEqual(15_000)
    }
  })

  it('answers every Ask PIP press, even back to back', () => {
    const script = [0, 1_000, 2_000].map((ms) =>
      at(
        ms,
        enq('ask', 'Walk with WASD.', 'hint', { tier: 0, solicited: true }),
      ),
    )
    // The same pending line is not duplicated while it is still playing…
    const first = run(script, 3_000)
    expect(first.length).toBe(1)
    // …but once it ends the player can ask again and get it again.
    useNarrativeStore.getState().reset()
    const again = run(
      [0, 6_000].map((ms) =>
        at(ms, enq('ask', 'Walk with WASD.', 'hint', { tier: 0, solicited: true })),
      ),
      10_000,
    )
    expect(again.length).toBe(2)
  })
})
