import { describe, expect, it } from 'vitest'
import {
  computeTrait,
  DISCOVERY_QUESTIONS,
  explorersForTrait,
  HISTORICAL_EXPLORERS,
  isValidExplorerName,
  MISSION_MODULES,
  sanitizeExplorerName,
  TRAITS,
} from './personalization'

describe('personalization data', () => {
  it('has five questions with five choices covering every trait', () => {
    expect(DISCOVERY_QUESTIONS).toHaveLength(4)
    const allTraits = new Set(TRAITS.map((t) => t.id))
    for (const question of DISCOVERY_QUESTIONS) {
      expect(question.choices).toHaveLength(5)
      expect(new Set(question.choices.map((c) => c.trait))).toEqual(allTraits)
      expect(question.question.length).toBeGreaterThan(0)
      expect(question.pipIntro.length).toBeGreaterThan(0)
    }
  })

  it('ships five traits, two explorers per trait and four modules', () => {
    expect(TRAITS).toHaveLength(5)
    expect(HISTORICAL_EXPLORERS).toHaveLength(10)
    for (const trait of TRAITS) {
      const pair = explorersForTrait(trait.id)
      expect(pair).toHaveLength(2)
      // Every pair is one girl and one boy.
      expect(new Set(pair.map((explorer) => explorer.gender))).toEqual(new Set(['girl', 'boy']))
    }
    expect(MISSION_MODULES).toHaveLength(4)
    expect(MISSION_MODULES.map((m) => m.id)).toEqual([
      'meteor-shield',
      'explorer-visor',
      'wrist-checklist',
      'mission-clock',
    ])
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
