/**
 * Read-only projection of JourneySave for the Cosmic Passport and the
 * navigation screen. Progress, stages and stamps always come from the
 * save; legacy Proposal B seals are surfaced as history, never as an A
 * delivery. No hero/power/passport-v2 state is involved.
 */

import { DESTINATIONS, type Destination } from './destinations'
import { findMission, type MissionId } from './missions'
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
  progress: MissionProgress | null,
): PassportStory {
  const mission = findMission(destination.missionId)
  const scanned = new Set(progress?.scannedComponentIds ?? []).size
  const total = mission?.components.length ?? 3
  const status = getMissionStage(progress)
  const discovered = Boolean(progress?.discovered || scanned > 0)
  const transmitted = progress?.transmittedAt != null
  const hasSmartLetter = progress?.smartLetterCreatedAt != null

  return {
    destination,
    missionId: destination.missionId,
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

export function getPassportView(save: JourneySave | null): PassportView {
  const stories = DESTINATIONS.map((destination) =>
    storyFor(destination, save?.missions[destination.missionId] ?? null),
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
  const destination = DESTINATIONS.find(
    (entry) => entry.missionId === missionId,
  )
  if (!destination) return null
  return storyFor(destination, save?.missions[missionId] ?? null)
}
