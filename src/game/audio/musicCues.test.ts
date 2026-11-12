import { describe, expect, it } from 'vitest'
import { INTRO_BEATS } from '../../data/onboardingNarrative'
import {
  AMBIENCE_CUES,
  MUSIC_CUES,
  sceneAmbienceFor,
  sceneMusicFor,
  type SceneMusicInput,
} from './musicCues'

const faultBeat = INTRO_BEATS.findIndex((beat) => beat.hologram === 'losing1')
const hopeBeat = INTRO_BEATS.findIndex((beat) => beat.moment === 'hope')

function scene(overrides: Partial<SceneMusicInput> = {}): SceneMusicInput {
  return {
    phase: 'menu',
    dialogueIndex: 0,
    destination: 'mars',
    archiveView: 'none',
    allMissionsComplete: false,
    finalQuoteShown: false,
    ...overrides,
  }
}

describe('scene music', () => {
  it('uses the menu identity for the title and the first intro beats', () => {
    expect(sceneMusicFor(scene())).toBe('menu')
    expect(sceneMusicFor(scene({ phase: 'intro', dialogueIndex: 0 }))).toBe(
      'intro',
    )
  })

  it('changes atmosphere exactly when the Archive starts losing records', () => {
    expect(
      sceneMusicFor(
        scene({ phase: 'intro', dialogueIndex: faultBeat - 1 }),
      ),
    ).toBe('intro')
    expect(
      sceneMusicFor(scene({ phase: 'intro', dialogueIndex: faultBeat })),
    ).toBe('archiveFault')
  })

  it('moves from tension to hope without an abrupt happy cut', () => {
    expect(
      sceneMusicFor(scene({ phase: 'intro', dialogueIndex: hopeBeat - 1 })),
    ).toBe('archiveFault')
    expect(
      sceneMusicFor(scene({ phase: 'intro', dialogueIndex: hopeBeat })),
    ).toBe('hope')
  })

  it('maps registration and hub to the cabin bed', () => {
    expect(sceneMusicFor(scene({ phase: 'registration' }))).toBe('cabin')
    expect(sceneMusicFor(scene({ phase: 'hub' }))).toBe('cabin')
  })

  it('uses the finale only after every mission is transmitted', () => {
    expect(
      sceneMusicFor(
        scene({ phase: 'hub', allMissionsComplete: true, finalQuoteShown: false }),
      ),
    ).toBe('finale')
    expect(
      sceneMusicFor(
        scene({ phase: 'hub', allMissionsComplete: true, finalQuoteShown: true }),
      ),
    ).toBe('cabin')
  })

  it('maps launch and each destination bed', () => {
    expect(sceneMusicFor(scene({ phase: 'launching' }))).toBe('launch')
    expect(sceneMusicFor(scene({ phase: 'playing', destination: 'mars' }))).toBe(
      'mars',
    )
    expect(sceneMusicFor(scene({ phase: 'playing', destination: 'moon' }))).toBe(
      'moon',
    )
    expect(
      sceneMusicFor(scene({ phase: 'playing', destination: 'deep-space' })),
    ).toBe('deepSpace')
  })

  it('lets Archive overlays take priority over the planet bed', () => {
    expect(
      sceneMusicFor(scene({ phase: 'playing', archiveView: 'full-scan' })),
    ).toBe('memory')
    expect(
      sceneMusicFor(scene({ phase: 'playing', archiveView: 'smart-letter' })),
    ).toBe('smartLetter')
    expect(
      sceneMusicFor(scene({ phase: 'playing', archiveView: 'reconstruction' })),
    ).toBe('reconstruction')
  })

  it('has no lunar wind and no cabin computer-noise bed', () => {
    expect(sceneAmbienceFor({ phase: 'menu', destination: 'mars' })).toBeNull()
    expect(
      sceneAmbienceFor({ phase: 'playing', destination: 'moon' }),
    ).toBeNull()
    expect(
      sceneAmbienceFor({ phase: 'playing', destination: 'mars' }),
    ).toBe('marsWind')
    expect(
      sceneAmbienceFor({ phase: 'playing', destination: 'deep-space' }),
    ).toBe('deepSpaceDrone')
    expect(
      sceneAmbienceFor({ phase: 'hub', destination: 'mars' }),
    ).toBeNull()
    expect(
      sceneAmbienceFor({ phase: 'intro', destination: 'mars' }),
    ).toBeNull()
  })

  it('points every cue at a declared manifest asset', () => {
    for (const cue of Object.values(MUSIC_CUES)) {
      expect(cue.assetId).toMatch(/^music\./)
      expect(cue.volume).toBeGreaterThan(0)
      expect(cue.fadeMs).toBeGreaterThanOrEqual(800)
    }
    for (const cue of Object.values(AMBIENCE_CUES)) {
      expect(cue.assetId).toMatch(/^ambience\./)
    }
  })
})
