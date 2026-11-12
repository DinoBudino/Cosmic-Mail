import { INTRO_BEATS } from '../../data/onboardingNarrative'
import type { DestinationId } from '../../data/missions'
import type { AudioAssetId } from './audioManifest'

export type MusicCueId =
  | 'menu'
  | 'intro'
  | 'cabin'
  | 'archiveFault'
  | 'hope'
  | 'launch'
  | 'mars'
  | 'moon'
  | 'deepSpace'
  | 'memory'
  | 'smartLetter'
  | 'transmission'
  | 'finale'
  | 'reconstruction'

export type AmbienceCueId = 'marsWind' | 'deepSpaceDrone'

export interface MusicCue {
  assetId: AudioAssetId
  volume: number
  fadeMs: number
}

export interface AmbienceCue {
  assetId: AudioAssetId
  volume: number
  fadeMs: number
}

export const MUSIC_CUES: Record<MusicCueId, MusicCue> = {
  menu: { assetId: 'music.menuAdventure', volume: 1, fadeMs: 1800 },
  // Shares the menu asset so the arrival/archive beats do not restart the track.
  intro: { assetId: 'music.menuAdventure', volume: 0.92, fadeMs: 1200 },
  cabin: { assetId: 'music.cabin', volume: 1, fadeMs: 1600 },
  archiveFault: { assetId: 'music.archiveFault', volume: 1, fadeMs: 900 },
  hope: { assetId: 'music.hope', volume: 1, fadeMs: 2200 },
  launch: { assetId: 'music.launchGalaxy', volume: 1, fadeMs: 1400 },
  mars: { assetId: 'music.mars', volume: 1, fadeMs: 2400 },
  moon: { assetId: 'music.moon', volume: 1, fadeMs: 2400 },
  deepSpace: { assetId: 'music.deepSpace', volume: 1, fadeMs: 2600 },
  memory: { assetId: 'music.memory', volume: 1, fadeMs: 1200 },
  smartLetter: { assetId: 'music.hope', volume: 0.82, fadeMs: 1800 },
  transmission: { assetId: 'music.transmission', volume: 1, fadeMs: 1200 },
  finale: { assetId: 'music.hope', volume: 1, fadeMs: 2600 },
  reconstruction: { assetId: 'music.memory', volume: 0.8, fadeMs: 1600 },
}

export const AMBIENCE_CUES: Record<AmbienceCueId, AmbienceCue> = {
  marsWind: { assetId: 'ambience.mars', volume: 1, fadeMs: 2400 },
  deepSpaceDrone: { assetId: 'ambience.deepSpace', volume: 1, fadeMs: 2600 },
}

export type ScenePhase =
  | 'menu'
  | 'intro'
  | 'registration'
  | 'hub'
  | 'launching'
  | 'playing'

export type SceneArchiveView =
  | 'none'
  | 'full-scan'
  | 'smart-letter'
  | 'reconstruction'

export interface SceneMusicInput {
  phase: ScenePhase
  dialogueIndex: number
  destination: DestinationId
  archiveView: SceneArchiveView
  allMissionsComplete: boolean
  finalQuoteShown: boolean
}

const FIRST_FAULT_BEAT = Math.max(
  0,
  INTRO_BEATS.findIndex((beat) => beat.hologram === 'losing1'),
)
const HOPE_BEAT = Math.max(
  0,
  INTRO_BEATS.findIndex((beat) => beat.moment === 'hope'),
)

/** The single source of truth for which music cue belongs to a scene. */
export function sceneMusicFor(input: SceneMusicInput): MusicCueId {
  if (input.phase === 'menu') return 'menu'

  if (input.phase === 'intro') {
    if (input.dialogueIndex >= HOPE_BEAT) return 'hope'
    if (input.dialogueIndex >= FIRST_FAULT_BEAT) return 'archiveFault'
    return 'intro'
  }

  if (input.phase === 'registration' || input.phase === 'hub') {
    if (input.allMissionsComplete && !input.finalQuoteShown) return 'finale'
    return 'cabin'
  }

  if (input.phase === 'launching') return 'launch'

  // Playing. Archive overlays take priority over the ambient planet bed.
  if (input.archiveView === 'full-scan') return 'memory'
  if (input.archiveView === 'smart-letter') return 'smartLetter'
  if (input.archiveView === 'reconstruction') return 'reconstruction'

  if (input.destination === 'moon') return 'moon'
  if (input.destination === 'deep-space') return 'deepSpace'
  return 'mars'
}

export interface SceneAmbienceInput {
  phase: ScenePhase
  destination: DestinationId
}

/**
 * Lunar scenes intentionally have no wind bed: the Moon has no
 * atmosphere, so only the music and suit/scanner sounds remain.
 */
export function sceneAmbienceFor(
  input: SceneAmbienceInput,
): AmbienceCueId | null {
  // Onboarding and the cabin use music only: the old computer-noise bed
  // sounded like a keyboard and competed with the soundtrack.
  if (input.phase !== 'playing') return null
  if (input.destination === 'moon') return null
  if (input.destination === 'deep-space') return 'deepSpaceDrone'
  return 'marsWind'
}
