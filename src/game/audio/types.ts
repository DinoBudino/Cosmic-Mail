export type AudioCategory = 'music' | 'ambience' | 'sfx'
export type AudioBus = 'music' | 'ambience' | 'sfx' | 'voice'

export type ContentIdRisk = 'none' | 'registered' | 'unknown'

export interface AudioLicense {
  name: string
  url: string
  attributionRequired: boolean
  notes?: string
}

export interface AudioSource {
  provider: string
  title: string
  author: string
  url: string
  contentIdRisk: ContentIdRisk
  consultedAt: string
}

export interface AudioAsset {
  id: string
  /** Path relative to the public root, without a leading slash. */
  src: string
  category: AudioCategory
  bus: AudioBus
  /** Base gain applied before the user's channel volume. */
  volume: number
  loop: boolean
  /** 1..10; higher priority assets may pre-empt lower-priority beds. */
  priority: number
  license: AudioLicense
  source: AudioSource
  tags?: readonly string[]
}
