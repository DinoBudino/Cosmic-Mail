import { describe, expect, it } from 'vitest'
import {
  DESTINATIONS,
  destinationPlanetKind,
  getDestination,
} from './destinations'

describe('destinations', () => {
  it('lists only the Moon and Mars, in order', () => {
    expect(DESTINATIONS.map((entry) => entry.id)).toEqual([
      'moon',
      'mars',
    ])
  })

  it('enables both the Moon and Mars', () => {
    expect(getDestination('mars').available).toBe(true)
    expect(getDestination('moon').available).toBe(true)
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
