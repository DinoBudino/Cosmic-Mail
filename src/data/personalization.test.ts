import { describe, expect, it } from 'vitest'
import {
  computeTrait,
  DISCOVERY_QUESTIONS,
  explorersForTrait,
  getHeroForTrait,
  HISTORICAL_EXPLORERS,
  INTRO_LINES,
  introMomentForLine,
  isValidExplorerName,
  sanitizeExplorerName,
  TRAITS,
} from './personalization'

describe('personalization data', () => {
  it('has four questions with five choices covering every trait', () => {
    expect(DISCOVERY_QUESTIONS).toHaveLength(4)
    const allTraits = new Set(TRAITS.map((t) => t.id))
    for (const question of DISCOVERY_QUESTIONS) {
      expect(question.choices).toHaveLength(5)
      expect(new Set(question.choices.map((c) => c.trait))).toEqual(allTraits)
      expect(question.question.length).toBeGreaterThan(0)
      expect(question.pipIntro.length).toBeGreaterThan(0)
    }
  })

  it('ships five traits and exactly one hero per trait (hero = power)', () => {
    expect(TRAITS).toHaveLength(5)
    expect(HISTORICAL_EXPLORERS).toHaveLength(5)
    const seenTraits = new Set<string>()
    for (const trait of TRAITS) {
      const pair = explorersForTrait(trait.id)
      expect(pair).toHaveLength(1)
      expect(getHeroForTrait(trait.id).trait).toBe(trait.id)
      const hero = pair[0]!
      expect(seenTraits.has(hero.trait)).toBe(false)
      seenTraits.add(hero.trait)
      // Genre is informational only, always present on the card.
      expect(['girl', 'boy']).toContain(hero.gender)
      expect(hero.bio.length).toBeGreaterThan(0)
      expect(hero.memoryLine.length).toBeGreaterThan(0)
      expect(hero.meetLine.length).toBeGreaterThan(0)
      // Editorial rule: hero presentation never names an agency or
      // institutional affiliation.
      for (const text of [hero.bio, hero.meetLine]) {
        expect(text.toLowerCase()).not.toContain('nasa')
        expect(text.toLowerCase()).not.toContain('agency')
      }
    }
    expect(seenTraits.size).toBe(5)
    // Brave is represented by Sally Ride (Valentina was replaced).
    expect(getHeroForTrait('brave').id).toBe('sally-ride')
    expect(getHeroForTrait('brave').name).toBe('Sally Ride')
  })

  it('introduces the abandoned-but-not-forgotten premise before the test', () => {
    // Five cinematic moments over nine subtitle lines.
    expect(INTRO_LINES).toHaveLength(9)
    const text = INTRO_LINES.join(' ').toLowerCase()
    expect(text).toContain('moon')
    expect(text).toContain('mars')
    expect(text).toContain('letter')
    expect(text).toContain('remembered')
    expect(text).toContain('explorer spirit')
  })

  it('maps subtitle lines to the five cinematic moments', () => {
    expect(introMomentForLine(0)).toBe('welcome')
    expect(introMomentForLine(1)).toBe('explorers')
    expect(introMomentForLine(2)).toBe('explorers')
    expect(introMomentForLine(3)).toBe('forgotten')
    expect(introMomentForLine(4)).toBe('forgotten')
    expect(introMomentForLine(5)).toBe('invitation')
    expect(introMomentForLine(6)).toBe('invitation')
    expect(introMomentForLine(7)).toBe('reflection')
    expect(introMomentForLine(8)).toBe('reflection')
  })
})

describe('computeTrait', () => {
  it('picks the majority trait', () => {
    expect(computeTrait(['brave', 'brave', 'careful', 'reflective', 'observant'])).toBe('brave')
  })

  it('breaks ties by recency, so every trait is reachable', () => {
    // Last answer wins a tie (recency), not a fixed order.
    expect(computeTrait(['careful', 'observant'])).toBe('observant')
    expect(computeTrait(['observant', 'careful'])).toBe('careful')
    expect(computeTrait(['brave', 'observant', 'methodical', 'careful'])).toBe('careful')
    expect(computeTrait(['brave', 'observant', 'methodical', 'reflective'])).toBe('reflective')
    expect(computeTrait(['observant', 'methodical', 'reflective', 'brave'])).toBe('brave')
    expect(computeTrait([])).toBe('brave')
  })

  it('still prefers a clear majority over recency', () => {
    expect(computeTrait(['observant', 'brave', 'brave', 'careful'])).toBe('brave')
  })
})

describe('explorer name', () => {
  it('sanitizes and validates names', () => {
    expect(sanitizeExplorerName('  Ada   Lovelace  ')).toBe('Ada Lovelace')
    expect(sanitizeExplorerName('A very very very long name here')).toHaveLength(20)
    expect(isValidExplorerName('Bo')).toBe(true)
    expect(isValidExplorerName(' x ')).toBe(false)
    expect(isValidExplorerName('   ')).toBe(false)
  })
})
