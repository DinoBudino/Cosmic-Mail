import { describe, expect, it } from 'vitest'
import { getAlbumGuideStep, isFirstAlbumDelivery } from './albumGuide'
import { getMission } from './missions'
import { pipLine } from './pipVoiceCatalog'

const mission = getMission('opportunity')
const parts = mission.components.map((component) => component.id)
const memory = {
  discovered: true,
  scannedComponentIds: parts,
  fullScanCompletedAt: 1,
  memoryRecoveredAt: 1,
}
const sealed = { ...memory, smartLetterCreatedAt: 2 }
const sent = { ...sealed, transmittedAt: 3 }

describe('album guide', () => {
  it('introduces the album the first time, then points at Seal the letter', () => {
    const intro = getAlbumGuideStep({ mission, progress: memory, firstTime: true, introDone: false })
    expect(intro).toMatchObject({ target: 'card', locked: true, text: pipLine('album-guide-intro') })
    const seal = getAlbumGuideStep({ mission, progress: memory, firstTime: true, introDone: true })
    expect(seal).toMatchObject({ target: 'seal', locked: true })
    expect(seal!.text).toMatch(/Seal the letter/)
  })

  it('skips the intro once a story has already reached Earth', () => {
    const step = getAlbumGuideStep({ mission, progress: memory, firstTime: false, introDone: false })
    expect(step?.target).toBe('seal')
  })

  it('points at Watch its story once sealed, still locked', () => {
    const step = getAlbumGuideStep({ mission, progress: sealed, firstTime: true, introDone: true })
    expect(step).toMatchObject({ target: 'story', locked: true })
    expect(step!.text).toMatch(/Watch its story/)
  })

  it('unlocks the album after the story is sent', () => {
    const first = getAlbumGuideStep({ mission, progress: sent, firstTime: true, introDone: true })
    expect(first).toMatchObject({ target: 'close', locked: false, text: pipLine('album-guide-done') })
    const later = getAlbumGuideStep({ mission, progress: sent, firstTime: false, introDone: true })
    expect(later).toMatchObject({ target: 'close', locked: false, text: mission.completionStory })
  })

  it('does not guide an explorer whose memory is not back yet', () => {
    const step = getAlbumGuideStep({
      mission,
      progress: { discovered: true, scannedComponentIds: parts.slice(0, 1) },
      firstTime: true,
      introDone: false,
    })
    expect(step).toBeNull()
  })

  it('is the first delivery only while no other story was sent', () => {
    expect(isFirstAlbumDelivery({ opportunity: { transmittedAt: 5 } }, 'opportunity')).toBe(true)
    expect(isFirstAlbumDelivery({ spirit: { transmittedAt: 5 } }, 'opportunity')).toBe(false)
    expect(isFirstAlbumDelivery({ spirit: { transmittedAt: null } }, 'opportunity')).toBe(true)
  })
})
