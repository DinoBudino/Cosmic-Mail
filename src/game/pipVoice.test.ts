/// <reference types="node" />
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HUB_ASSIGNMENT_LINE,
  HUB_RETURNING_LINE,
  HUB_TOUR_LINES,
  INTRO_BEATS,
  LAUNCH_CABIN_LINE,
  REGISTRATION_LINE,
  ROUTE_READY_LINE,
} from '../data/onboardingNarrative'
import { getMission } from '../data/missions'
import { PIP_VOICE_LINE_CATALOG } from '../data/pipVoiceCatalog'
import {
  ONBOARDING_VOICE_LINES,
  PIP_VOICES,
  SUBTITLE_ONLY_LINES,
  audioKeyForLine,
  resolveVoiceId,
} from './pipVoice'

const ONBOARDING_TEXTS = [
  ...INTRO_BEATS.map((beat) => beat.line),
  REGISTRATION_LINE,
  HUB_ASSIGNMENT_LINE,
  ...HUB_TOUR_LINES,
  HUB_RETURNING_LINE,
  ROUTE_READY_LINE,
  LAUNCH_CABIN_LINE,
]

describe('recorded PIP voices', () => {
  it('exposes the four selectable voices', () => {
    expect(PIP_VOICES.map((voice) => voice.id)).toEqual([
      'heart',
      'sky',
      'lily',
      'michael',
    ])
  })

  it('resolves a known voice id and falls back to Heart', () => {
    expect(resolveVoiceId('michael')).toBe('michael')
    expect(resolveVoiceId(null)).toBe('heart')
    expect(resolveVoiceId('amy')).toBe('heart')
    expect(resolveVoiceId('')).toBe('heart')
  })

  it('keeps the Mars landmark recordings mapped', () => {
    expect(
      audioKeyForLine('Wow! Valley of Echoes! Look, old rover tracks!'),
    ).toBe('opportunity')
    expect(audioKeyForLine('Hush now! Silent Plains. Listen with me!')).toBe(
      'insight',
    )
    expect(
      audioKeyForLine('First Flight Dunes! Whoa. The sky is so wide here.'),
    ).toBe('ingenuity')
    expect(audioKeyForLine('Ancient Lands. Whoa! This place feels old.')).toBe(
      'viking1',
    )
  })

  it('maps every onboarding line to its own recorded key', () => {
    for (const text of ONBOARDING_TEXTS) {
      const key = audioKeyForLine(text)
      expect(key).not.toBeNull()
      expect(key).toMatch(
        /^(intro-\d{2}|registration|hub-assignment|hub-tour-\d{1,2}|hub-return|route-ready|launch-cabin)$/,
      )
    }
    expect(new Set(ONBOARDING_VOICE_LINES.map((line) => line.key)).size).toBe(
      ONBOARDING_VOICE_LINES.length,
    )
    expect(
      new Set(ONBOARDING_VOICE_LINES.map((line) => line.text)).size,
    ).toBe(ONBOARDING_VOICE_LINES.length)
  })

  it('never maps the onboarding script to a retired landmark key', () => {
    for (const text of ONBOARDING_TEXTS) {
      expect(['opportunity', 'insight', 'ingenuity', 'viking1']).not.toContain(
        audioKeyForLine(text),
      )
      expect(SUBTITLE_ONLY_LINES.has(text)).toBe(false)
    }
  })

  it('ships both natural takes for every recorded line in all voices', () => {
    for (const line of ONBOARDING_VOICE_LINES) {
      for (const voice of PIP_VOICES) {
        for (const take of [1, 2]) {
          const file = join(
            process.cwd(),
            'public',
            'audio',
            'pip',
            voice.id,
            `${line.key}${take}.mp3`,
          )
          expect(existsSync(file), file).toBe(true)
        }
      }
    }
  })

  it('has a recording for every essential Mars (Opportunity) narrative beat', () => {
    const mission = getMission('opportunity')
    const narrative = mission.narrative
    if (!narrative) throw new Error('Opportunity narrative is missing')
    const texts = [
      narrative.entered,
      narrative.detected,
      narrative.approached,
      narrative.identified,
      narrative.scannerPromptDesktop,
      narrative.scannerPromptTouch,
      narrative.approachedTouch,
      narrative.completed,
      narrative.memoryRecovered,
      narrative.letterPrepared,
      narrative.returnToShip,
      narrative.hintOrientation,
      narrative.hintContext,
      narrative.genericHint,
      ...narrative.ambient,
      narrative.revisitInProgress,
      narrative.revisitLetterReady,
      narrative.revisitTransmitted,
      mission.completionStory,
      ...mission.components.flatMap((component) => [
        component.pipLine,
        component.pipHint ?? '',
        component.pipDirectHint ?? '',
      ]),
    ].filter((text) => text.length > 0)

    for (const text of texts) {
      expect(audioKeyForLine(text), text).not.toBeNull()
    }
  })

  it('maps every Mars exploration line to its own recorded key', () => {
    const marsLines = PIP_VOICE_LINE_CATALOG.filter(
      (line) => line.category === 'mars',
    )
    expect(marsLines.length).toBeGreaterThan(20)
    for (const line of marsLines) {
      expect(audioKeyForLine(line.text)).toBe(line.key)
      expect(line.text).not.toMatch(/^\s*$/)
    }
    expect(new Set(marsLines.map((line) => line.key)).size).toBe(
      marsLines.length,
    )
    expect(new Set(marsLines.map((line) => line.text)).size).toBe(
      marsLines.length,
    )
  })
})
