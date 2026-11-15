import { getArchiveCue, type NarrativeProgress } from './missionNarrative'
import type { MissionDefinition } from './missions'
import { pipLine } from './pipVoiceCatalog'

/**
 * PIP inside the Cosmic Album right after an explorer is complete. The
 * album (not a separate tablet) is where its story is sealed, watched and
 * sent to Earth, and PIP walks the child through it:
 *
 *   intro (first time) → Seal the letter → Watch its story → done
 *
 * Each step names the one element PIP points at. Until the story is on
 * its way, tabs and the X stay locked so the child can't wander off
 * mid-ceremony (the story is the way forward, as in the old tablet).
 */

export type AlbumGuideTarget = 'card' | 'seal' | 'story' | 'close'

export interface AlbumGuideStep {
  /** Stable id: the album speaks each line once per step. */
  id: string
  text: string
  target: AlbumGuideTarget
  /** Tabs, X, Escape and the backdrop are locked. */
  locked: boolean
}

export interface AlbumGuideInput {
  mission: MissionDefinition
  progress: NarrativeProgress | null
  /** No other story has reached Earth yet: PIP explains everything. */
  firstTime: boolean
  /** The first-time intro line has already been shown. */
  introDone: boolean
}

export function getAlbumGuideStep({
  mission,
  progress,
  firstTime,
  introDone,
}: AlbumGuideInput): AlbumGuideStep | null {
  const cue = getArchiveCue(mission, progress)
  switch (cue.kind) {
    case 'memory':
      if (firstTime && !introDone) {
        return {
          id: `${mission.id}:album:intro`,
          text: pipLine('album-guide-intro'),
          target: 'card',
          locked: true,
        }
      }
      return { id: cue.id, text: cue.text, target: 'seal', locked: true }
    case 'letter':
      return { id: cue.id, text: cue.text, target: 'story', locked: true }
    case 'transmitted':
      return {
        id: `${mission.id}:album:done`,
        text: firstTime ? pipLine('album-guide-done') : cue.text,
        target: 'close',
        locked: false,
      }
    default:
      return null
  }
}

/** First time = no other explorer's story has been sent home yet. */
export function isFirstAlbumDelivery(
  missions: Readonly<Record<string, { transmittedAt?: number | null } | undefined>>,
  focusId: string,
): boolean {
  return !Object.entries(missions).some(
    ([id, progress]) => id !== focusId && progress?.transmittedAt != null,
  )
}
