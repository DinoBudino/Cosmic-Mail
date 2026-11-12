import { describe, expect, it } from 'vitest'
import {
  DESTINATIONS,
  destinationPlanetKind,
  getDestination,
} from './destinations'

describe('destinations', () => {
  it('lists Moon, Mars and Deep Space in order', () => {
    expect(DESTINATIONS.map((entry) => entry.id)).toEqual([
      'moon',
      'mars',
      'deep-space',
    ])
  })

  it('only enables Mars in this block', () => {
    expect(getDestination('mars').available).toBe(true)
    expect(getDestination('moon').available).toBe(false)
    expect(getDestination('deep-space').available).toBe(false)
  })

  it('keeps machine identities out of navigation clues', () => {
    for (const destination of DESTINATIONS) {
      expect(destination.clue).not.toMatch(/Surveyor|Spirit|Pioneer/i)
    }
  })

  it('maps saved destinations to backdrop planet kinds', () => {
    expect(destinationPlanetKind('mars')).toBe('mars')
    expect(destinationPlanetKind('moon')).toBe('moon')
    expect(destinationPlanetKind('deep-space')).toBe('deep-space')
    expect(destinationPlanetKind(null)).toBe('earth')
    expect(destinationPlanetKind('earth')).toBe('earth')
  })
})
