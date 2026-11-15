/**
 * Read-only projection of JourneySave for the Cosmic Passport and the
 * navigation screen. Progress, stages and stamps always come from the
 * save; legacy Proposal B seals are surfaced as history, never as an A
 * delivery. No hero/power/passport-v2 state is involved.
 */

import { getDestination, type Destination } from './destinations'
import { ACTIVE_MISSION_IDS, findMission, getMission, type MissionId } from './missions'
import {
  MISSION_STAGE_LABEL,
  getMissionStage,
  type MissionStage,
} from '../store/journeyLogic'
import type { JourneySave, MissionProgress } from '../store/journeySchema'

export type StoryStatus = MissionStage

export interface PassportStory {
  destination: Destination
  missionId: MissionId
  /** Revealed only after the machine has been discovered. */
  machineName: string | null
  status: StoryStatus
  statusLabel: string
  scanned: number
  total: number
  memoryRecovered: boolean
  hasSmartLetter: boolean
  canTransmit: boolean
  reconstructionAvailable: boolean
  stampEarned: boolean
  stampLabel: string | null
  /** Proposal B seal preserved as history. Never an Archive delivery. */
  legacySealAt: number | null
}

export interface PassportView {
  carrierName: string
  carrierId: string
  stories: PassportStory[]
  stamps: number
  transmittedCount: number
  totalStories: number
}

export const STORY_STATUS_LABEL: Record<StoryStatus, string> =
  MISSION_STAGE_LABEL

function carrierIdFor(save: JourneySave | null): string {
  if (!save) return 'CM-00000'
  const seed = (save.createdAt || save.updatedAt || 1) % 100000
  return `CM-${String(seed).padStart(5, '0')}`
}

function storyFor(
  destination: Destination,
  missionId: MissionId,
  progress: MissionProgress | null,
): PassportStory {
  const mission = findMission(missionId)
  const scanned = new Set(progress?.scannedComponentIds ?? []).size
  const total = mission?.components.length ?? 3
  const status = getMissionStage(progress)
  const discovered = Boolean(progress?.discovered || scanned > 0)
  const transmitted = progress?.transmittedAt != null
  const hasSmartLetter = progress?.smartLetterCreatedAt != null

  return {
    destination,
    missionId,
    machineName: discovered && mission ? mission.machineName : null,
    status,
    statusLabel: STORY_STATUS_LABEL[status],
    scanned,
    total,
    memoryRecovered: progress?.memoryRecoveredAt != null,
    hasSmartLetter,
    canTransmit: hasSmartLetter && !transmitted,
    reconstructionAvailable: hasSmartLetter,
    stampEarned: transmitted,
    stampLabel: transmitted && mission ? mission.stampLabel : null,
    legacySealAt: progress?.legacySealAt ?? null,
  }
}

/**
 * One story — and one stamp — per explorer, not per place: Mars holds two
 * explorers (Opportunity and Spirit), so it has two stamps.
 */
export function getPassportView(save: JourneySave | null): PassportView {
  const stories = ACTIVE_MISSION_IDS.map((missionId) =>
    storyFor(
      getDestination(getMission(missionId).destination),
      missionId,
      save?.missions[missionId] ?? null,
    ),
  )
  const transmittedCount = stories.filter((story) => story.stampEarned).length
  return {
    carrierName: save?.playerName ?? 'Cosmic Mail Carrier',
    carrierId: carrierIdFor(save),
    stories,
    stamps: transmittedCount,
    transmittedCount,
    totalStories: stories.length,
  }
}

export function getStoryForMission(
  save: JourneySave | null,
  missionId: MissionId,
): PassportStory | null {
  if (!(ACTIVE_MISSION_IDS as readonly string[]).includes(missionId)) return null
  const mission = getMission(missionId)
  return storyFor(
    getDestination(mission.destination),
    missionId,
    save?.missions[missionId] ?? null,
  )
}

/** A place on the navigation screen and its explorers' stories. */
export interface DestinationSummary {
  stories: PassportStory[]
  /** Every explorer of the place has its story delivered. */
  restored: boolean
  restoredCount: number
  /** Names found so far ("Opportunity · Spirit"), or null if none yet. */
  explorers: string | null
  /** The story the child is working on (first one not delivered yet). */
  current: PassportStory | null
}

export function getDestinationSummary(
  view: PassportView,
  destinationId: Destination['id'],
): DestinationSummary {
  const stories = view.stories.filter(
    (story) => story.destination.id === destinationId,
  )
  const restoredCount = stories.filter((story) => story.stampEarned).length
  const names = stories
    .map((story) => story.machineName)
    .filter((name): name is string => name != null)
  return {
    stories,
    restored: stories.length > 0 && restoredCount === stories.length,
    restoredCount,
    explorers: names.length > 0 ? names.join(' · ') : null,
    current:
      stories.find((story) => !story.stampEarned) ?? stories.at(-1) ?? null,
  }
}

