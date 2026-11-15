import { describe, expect, it } from 'vitest'
import { formatCoordinates, getSiteTitle } from './siteTitle'

describe('landing-site title card', () => {
  it('names the landing place, never the explorer', () => {
    const title = getSiteTitle('mars', 'spirit')
    expect(title?.place).toBe('Gusev Crater')
    expect(title?.eyebrow).toBe('Landing site · Mars')
    expect(JSON.stringify(title)).not.toMatch(/spirit/i)
  })

  it('shows real coordinates with N/S and E/W', () => {
    expect(formatCoordinates(-14.57, 175.47)).toBe('14.57° S · 175.47° E')
    // Meridiani Planum: 354.47° E is 5.53° W.
    expect(formatCoordinates(-1.95, 354.47)).toBe('1.95° S · 5.53° W')
    expect(getSiteTitle('mars', 'viking-1')?.coordinates).toBe('22.48° N · 47.94° W')
  })

  it('covers the Moon sites', () => {
    expect(getSiteTitle('moon', 'apollo-11')?.place).toBe('Sea of Tranquility')
    expect(getSiteTitle('moon', 'surveyor-3')?.eyebrow).toBe('Landing site · The Moon')
  })
})
