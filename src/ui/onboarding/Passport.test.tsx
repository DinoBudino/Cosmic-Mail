import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createJourney,
  createMissionProgress,
  type MissionProgress,
} from '../../store/journeySchema'
import { Passport } from './Passport'

function showProgress(progress: Partial<MissionProgress>) {
  const save = createJourney('Ada', 1000)
  save.missions.opportunity = {
    ...createMissionProgress(),
    discovered: true,
    ...progress,
  }
  return renderToStaticMarkup(<Passport saveOverride={save} />)
}

describe('Passport progressive disclosure', () => {
  it('shows a simple album before the first search', () => {
    const save = createJourney('Ada', 1000)
    const html = renderToStaticMarkup(<Passport saveOverride={save} />)

    expect(html).toContain('Explorer not yet identified')
    expect(html).toContain('No signal identified yet')
    expect(html).not.toContain('Smart letter prepared')
    expect(html).not.toContain('Delivered to Earth')
  })

  it('shows only fragment progress while investigating', () => {
    const html = showProgress({
      scannedComponentIds: ['opportunity-pancam'],
    })

    expect(html).toContain('Fragments recognized 1/3')
    expect(html).not.toContain('Memory recovered')
    expect(html).not.toContain('Smart letter prepared')
  })

  it('reveals memory, letter and delivery only when they really happen', () => {
    const memory = showProgress({
      scannedComponentIds: [
        'opportunity-pancam',
        'opportunity-rock-abrasion-tool',
        'opportunity-mini-tes',
      ],
      fullScanCompletedAt: 10,
      memoryRecoveredAt: 10,
    })
    expect(memory).toContain('Memory recovered')
    expect(memory).not.toContain('Letter sealed. Watch its story')

    const letter = showProgress({
      scannedComponentIds: [
        'opportunity-pancam',
        'opportunity-rock-abrasion-tool',
        'opportunity-mini-tes',
      ],
      fullScanCompletedAt: 10,
      memoryRecoveredAt: 10,
      smartLetterCreatedAt: 20,
    })
    expect(letter).toContain('Letter sealed. Watch its story')
    expect(letter).toContain('Watch its story')
    expect(letter).not.toContain('Delivered to Earth')

    const delivered = showProgress({
      scannedComponentIds: [
        'opportunity-pancam',
        'opportunity-rock-abrasion-tool',
        'opportunity-mini-tes',
      ],
      fullScanCompletedAt: 10,
      memoryRecoveredAt: 10,
      smartLetterCreatedAt: 20,
      transmittedAt: 30,
      stampEarned: true,
    })
    expect(delivered).toContain('Delivered to Earth')
    expect(delivered).toContain('Opportunity · Mars')
  })
})

describe('tablet clock', () => {
  it('shows the local time as 24 h with two-digit hours', async () => {
    const { clockText } = await import('./tabletClock')
    expect(clockText(new Date(2026, 10, 15, 9, 5))).toBe('09:05')
    expect(clockText(new Date(2026, 10, 15, 0, 0))).toBe('00:00')
    expect(clockText(new Date(2026, 10, 15, 17, 45))).toBe('17:45')
    expect(clockText(new Date(2026, 10, 15, 23, 59))).toBe('23:59')
  })
})
