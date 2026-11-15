import { describe, expect, it } from 'vitest'
import {
  CALIBRATE_FIRST_LINE,
  INSPECT_FIRST_LINE,
  LATER_LINE,
  OFF_TRAIL_LINE,
  SCANNER_LOCKED_LINE,
  STATION_STAY_LINE,
  PRACTICE_STAY_LINE,
  PRESS_Q_LINE,
  TAP_SCANNER_LINE,
  STEP_ENTRY_LINES,
  getProtocolHint,
} from './arrivalProtocol'
import { ENVIRONMENTAL_SITES } from './environmentalSites'
import {
  MAX_ENV_WORDS,
  countWords,
  lineProblems,
} from './pipDialogPolicy'
import { PIP_VOICE_LINE_CATALOG } from './pipVoiceCatalog'

/**
 * Recorded lines that predate the dialogue policy and have more than two
 * short sentences. Their audio is keyed by exact text, so rewording them
 * means re-recording: they are listed here on purpose and this list must
 * only ever shrink. Anything new has to comply.
 */
const LEGACY_RECORDED_OVER_SENTENCES = new Set<string>([])

/** Detail lines are not spoken by PIP any more (reading card / passport). */
const NOT_SPOKEN_ANY_MORE = /^mars-env-.*-(detail|quick)$/

describe('PIP content limits', () => {
  it('keeps every spoken recorded line within the limits, except the listed legacy ones', () => {
    const offenders = PIP_VOICE_LINE_CATALOG.filter(
      (line) =>
        !NOT_SPOKEN_ANY_MORE.test(line.key) &&
        lineProblems(line.text).length > 0 &&
        !LEGACY_RECORDED_OVER_SENTENCES.has(line.key),
    ).map((line) => line.key)
    expect(offenders).toEqual([])
  })

  it('only allows legacy exceptions for the sentence count, never for length', () => {
    for (const key of LEGACY_RECORDED_OVER_SENTENCES) {
      const line = PIP_VOICE_LINE_CATALOG.find((l) => l.key === key)
      expect(line, key).toBeDefined()
      expect(lineProblems(line!.text)).not.toContain('too-long')
    }
  })

  it('keeps every protocol, reconstruction and calibration line compliant', () => {
    const lines = [
      ...Object.values(STEP_ENTRY_LINES).map((l) => l!.text),
      SCANNER_LOCKED_LINE.text,
      OFF_TRAIL_LINE.text,
      LATER_LINE.text,
      INSPECT_FIRST_LINE.text,
      CALIBRATE_FIRST_LINE.text,
      STATION_STAY_LINE.text,
      PRACTICE_STAY_LINE.text,
      PRESS_Q_LINE.text,
      TAP_SCANNER_LINE.text,
      ...(['M0', 'M1', 'M2', 'M3'] as const).flatMap((step) =>
        [false, true].map((touch) => getProtocolHint(step, touch)!),
      ),
    ]
    for (const text of lines) expect(lineProblems(text), text).toEqual([])
  })

  it('limits the only environmental comment PIP makes to 15 words', () => {
    for (const site of ENVIRONMENTAL_SITES) {
      expect(countWords(site.shortLine), site.id).toBeLessThanOrEqual(
        MAX_ENV_WORDS,
      )
      expect(lineProblems(site.shortLine), site.id).toEqual([])
    }
  })

  it('does not slip the unverified geology claims back into spoken env lines', () => {
    for (const site of ENVIRONMENTAL_SITES) {
      expect(site.shortLine.toLowerCase()).not.toMatch(
        /basalt|ripple|dune|lava|water/,
      )
    }
  })
})
