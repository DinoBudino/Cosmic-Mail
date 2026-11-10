import { describe, expect, it } from 'vitest'
import { TRAITS } from './personalization'
import { getTraitAbility, TRAIT_ABILITIES } from './traitAbilities'

describe('trait abilities (presentation metadata)', () => {
  it('defines exactly one ability per trait', () => {
    expect(Object.keys(TRAIT_ABILITIES)).toHaveLength(5)
    const ids = new Set<string>()
    for (const trait of TRAITS) {
      const ability = getTraitAbility(trait.id)
      expect(ability.name.length).toBeGreaterThan(0)
      expect(ability.description.length).toBeGreaterThan(0)
      expect(ids.has(ability.id)).toBe(false)
      ids.add(ability.id)
    }
    expect(ids.size).toBe(5)
  })

  it('keeps the approved names for each power', () => {
    expect(getTraitAbility('brave').name).toBe('Second Chance')
    expect(getTraitAbility('observant').name).toBe('Explorer Vision')
    expect(getTraitAbility('methodical').name).toBe('Mission Plan')
    expect(getTraitAbility('careful').name).toBe('Safety Check')
    expect(getTraitAbility('reflective').name).toBe('Time to Think')
  })
})
