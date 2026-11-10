import { describe, expect, it } from 'vitest'
import { HISTORICAL_EXPLORERS } from '../data/personalization'
import { audioKeyForLine, PIP_VOICES, resolveVoiceId, SUBTITLE_ONLY_LINES } from './pipVoice'

describe('recorded PIP voices', () => {
  it('exposes four selectable voices', () => {
    expect(PIP_VOICES.map((voice) => voice.id)).toEqual(['heart', 'sky', 'lily', 'michael'])
  })

  it('resolves a known voice id and falls back to Heart', () => {
    expect(resolveVoiceId('michael')).toBe('michael')
    expect(resolveVoiceId(null)).toBe('heart')
    expect(resolveVoiceId('amy')).toBe('heart')
    expect(resolveVoiceId('')).toBe('heart')
  })

  it('maps every PIP line to its recording key', () => {
    expect(audioKeyForLine('Wow! Valley of Echoes! Look, old rover tracks!')).toBe('opportunity')
    expect(audioKeyForLine('Hush now! Silent Plains. Listen with me!')).toBe('insight')
    expect(audioKeyForLine('First Flight Dunes! Whoa. The sky is so wide here.')).toBe('ingenuity')
    expect(audioKeyForLine('Ancient Lands. Whoa! This place feels old.')).toBe('viking1')
    expect(audioKeyForLine('Hi! I am PIP, your mail companion.')).toBe('welcome')
    // Cinematic intro lines (recorded, spoken by Intro.tsx).
    expect(audioKeyForLine("Hi! I'm PIP, your cabin buddy. Welcome aboard Cosmic Mail!")).toBe('cabin-intro-1')
    expect(audioKeyForLine('Some of their missions have ended.')).toBe('cabin-intro-4')
    expect(audioKeyForLine("You'll travel across space and deliver letters to these forgotten explorers. Will you help me?")).toBe('cabin-intro-8')
    expect(audioKeyForLine("Before we begin, let's discover your explorer spirit.")).toBe('cabin-intro-10')
    expect(audioKeyForLine('Look, carrier — your Cosmic Mail passport is ready!')).toBe('cabin-hub-0')
    expect(audioKeyForLine('It holds your name, your power, your hero and your stamps.')).toBe('cabin-hub-1')
    expect(audioKeyForLine('And this green screen is navigation. Moon and Deep Space are still sleeping — Mars is ready.')).toBe('cabin-hub-2')
    expect(
      audioKeyForLine(
        'When you land, find the silent machines and deliver their letters. When you are ready, tap the radar screen and choose.',
      ),
    ).toBe('cabin-hub-3')
    expect(audioKeyForLine('All set, carrier! Press the red button to take off!')).toBe('cabin-all-set')
    expect(
      audioKeyForLine(
        'Warning! My hero archive took a hit entering Mars. I only remember your current hero — the others are lost as memory fragments near the silent machines!',
      ),
    ).toBe('cabin-launch-memory')
    expect(audioKeyForLine('I became the first American woman in space in 1983.')).toBe('cabin-memory-sally')
    expect(audioKeyForLine('I helped people ask big questions about the universe.')).toBe('cabin-memory-carl')
  })

  it('returns null for lines without a recording', () => {
    expect(audioKeyForLine('Some future line')).toBeNull()
  })

  it('keeps both explorer-step lines in sync with every hero shown in the carousel', () => {
    // History line + power line, each with its OWN recording, so the
    // voice always matches the character visible in the window.
    const keys = new Set<string>()
    for (const hero of HISTORICAL_EXPLORERS) {
      for (const line of [hero.meetLine, hero.powerLine]) {
        expect(line.length).toBeGreaterThan(0)
        const key = audioKeyForLine(line)
        expect(key).not.toBeNull()
        expect(SUBTITLE_ONLY_LINES.has(line)).toBe(false)
        keys.add(key!)
      }
    }
    expect(keys.size).toBe(HISTORICAL_EXPLORERS.length * 2)
  })
})
