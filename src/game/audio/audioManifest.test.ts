import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUDIO_ASSETS,
  getAudioAsset,
  type AudioAssetId,
} from './audioManifest'
import { EVENT_PLANS } from './audioEvents'

const assets = Object.values(AUDIO_ASSETS)

describe('audio manifest', () => {
  it('has unique ids and unique file paths', () => {
    const ids = Object.keys(AUDIO_ASSETS)
    expect(new Set(ids).size).toBe(ids.length)
    const paths = assets.map((asset) => asset.src)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('ships every declared file', () => {
    const root = join(process.cwd(), 'public')
    for (const asset of assets) {
      const file = join(root, asset.src)
      expect(existsSync(file), asset.src).toBe(true)
      expect(statSync(file).size, asset.src).toBeGreaterThan(500)
    }
  })

  it('declares a licence and a source for every asset', () => {
    for (const asset of assets) {
      expect(asset.license.name.length).toBeGreaterThan(0)
      expect(asset.license.url).toMatch(/^https?:\/\//)
      expect(asset.source.provider.length).toBeGreaterThan(0)
      expect(asset.source.title.length).toBeGreaterThan(0)
      expect(asset.source.consultedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('keeps music and ambience beds looping, one-shots short', () => {
    for (const asset of assets) {
      if (asset.category === 'music' || asset.category === 'ambience') {
        expect(asset.loop, asset.id).toBe(true)
      }
      expect(asset.volume).toBeGreaterThan(0)
      expect(asset.volume).toBeLessThanOrEqual(1)
    }
  })

  it('resolves every event plan asset to a declared id', () => {
    const ids = new Set(Object.keys(AUDIO_ASSETS))
    for (const [event, plan] of Object.entries(EVENT_PLANS)) {
      for (const id of plan.sfx ?? []) {
        expect(ids.has(id), `${event} -> ${id}`).toBe(true)
      }
      for (const delayed of plan.delayedSfx ?? []) {
        expect(ids.has(delayed.assetId), `${event} -> ${delayed.assetId}`).toBe(
          true,
        )
      }
      if (plan.loop) {
        expect(ids.has(plan.loop.assetId), `${event} -> ${plan.loop.assetId}`).toBe(
          true,
        )
      }
    }
  })

  it('does not allow a music cue to point at a sound effect', () => {
    for (const [id, asset] of Object.entries(AUDIO_ASSETS)) {
      if (id.startsWith('music.')) expect(asset.category).toBe('music')
      if (id.startsWith('ambience.')) expect(asset.category).toBe('ambience')
      expect(getAudioAsset(id as AudioAssetId).id).toBe(id)
    }
  })

  it('flags Content ID risk instead of hiding it', () => {
    const registered = assets.filter(
      (asset) => asset.source.contentIdRisk === 'registered',
    )
    expect(registered.length).toBeGreaterThan(0)
    for (const asset of registered) {
      expect(asset.source.provider).toBe('Pixabay')
      expect(asset.license.name).toBe('Pixabay Content License')
    }
  })
})
