import { describe, expect, it } from 'vitest'
import { destinationPlanetKind } from './zones'

describe('destinationPlanetKind', () => {
  it('defaults to Earth with no recorded mission', () => {
    expect(destinationPlanetKind(null)).toBe('earth')
    expect(destinationPlanetKind(undefined)).toBe('earth')
    expect(destinationPlanetKind('earth')).toBe('earth')
    expect(destinationPlanetKind('unknown')).toBe('earth')
  })

  it('maps each zone to its planet', () => {
    expect(destinationPlanetKind('mars')).toBe('mars')
    expect(destinationPlanetKind('moon')).toBe('moon')
    expect(destinationPlanetKind('deep-space')).toBe('deep-space')
  })
})
