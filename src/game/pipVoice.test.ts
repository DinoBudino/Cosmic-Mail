import { describe, expect, it } from 'vitest'
import { audioKeyForLine, PIP_VOICES, resolveVoiceId } from './pipVoice'

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
    expect(audioKeyForLine('This is your passport, carrier — your name, your spirit, your stamps.')).toBe('cabin-hub-1')
    expect(audioKeyForLine('And this green screen is navigation. Moon and Deep Space are still sleeping — Mars is ready.')).toBe('cabin-hub-2')
    expect(audioKeyForLine('When you are ready, tap the radar screen and choose.')).toBe('cabin-hub-3')
    expect(audioKeyForLine('All set, carrier! Press the red button to take off!')).toBe('cabin-all-set')
  })

  it('returns null for lines without a recording', () => {
    expect(audioKeyForLine('Some future line')).toBeNull()
  })
})
