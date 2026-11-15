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
    expect(html).toContain('Search pending')
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
    expect(memory).not.toContain('Smart letter ready to transmit')

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
    expect(letter).toContain('Smart letter ready to transmit')
    expect(letter).toContain('Awaiting delivery')
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
