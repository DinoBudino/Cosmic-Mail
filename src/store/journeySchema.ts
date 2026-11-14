/**
 * JourneySave — the single persistent contract for Cosmic Mail under
 * Proposal A ("The memories that must find their way home").
 *
 * Storage rules:
 * - The new save lives at its own v4 key. Legacy Proposal B data
 *   (`cosmic-mail:journey:v3`) is read once for a conservative migration
 *   and is NEVER deleted or rewritten.
 * - Legacy seals are preserved as history only (`legacySealAt`). They do
 *   not grant an Archive transmission, a stamp or recovered memory.
 * - Corrupt data is never overwritten automatically.
 * - Missing progress fields fall back to safe empty defaults.
 * - Persisted prerequisites are enforced when reading: a transmitted
 *   history must have a smart letter, and a smart letter must have a
 *   recovered memory (which requires a completed full scan).
 * - The retired v2 passport is ignored and left untouched.
 */

import {
  MISSION_IDS,
  getMission,
  isDestinationId,
  type DestinationId,
  type MissionId,
} from '../data/missions'
import { isEnvironmentalSiteId } from '../data/environmentalSites'
import { MARS_OBJECTS } from '../data/marsObjects'

export const JOURNEY_SCHEMA_VERSION = 4
export const JOURNEY_STORAGE_KEY = 'cosmic-mail:journey:v4'
/** Proposal B save. Read for migration, never written or removed. */
export const LEGACY_JOURNEY_STORAGE_KEY = 'cosmic-mail:journey:v3'

/** The subset of the Web Storage API this module needs. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface MissionProgress {
  /** True once the player has reached/identified the machine. */
  discovered: boolean
  /** Recognized components; each one unlocks a PIP fragment. */
  scannedComponentIds: string[]
  /** Set when a valid full-object recognition scan finishes. */
  fullScanCompletedAt: number | null
  /** Set when the fictional memory core is recovered. */
  memoryRecoveredAt: number | null
  /** Set when the smart letter is generated. */
  smartLetterCreatedAt: number | null
  /** Optional: the historical recreation was watched at least once. */
  reconstructionWatchedAt: number | null
  /** Set only when the letter is transmitted from Mailwing. */
  transmittedAt: number | null
  /** True only for a completed Archive transmission. */
  stampEarned: boolean
  /**
   * Proposal B seal, preserved as history. It proves that the old quiz was
   * answered, not that a Robotic Archive transmission happened.
   */
  legacySealAt: number | null
}

export interface JourneySave {
  schemaVersion: typeof JOURNEY_SCHEMA_VERSION
  playerName: string
  introSeen: boolean
  onboardingComplete: boolean
  currentDestination: DestinationId | null
  missions: Record<MissionId, MissionProgress>
  /**
   * Optional Mars field observations. They are deliberately separate from
   * mission progress: they never unlock fragments, memories or stamps.
   */
  environmentalDiscoveries: string[]
  environmentalDetailedDiscoveries: string[]
  /**
   * Optional: Mars memorials whose field note was read. Added to v4
   * additively; saves without it read as []. Same rule as above: it never
   * affects mission progress, memory, letters or stamps.
   */
  memorialVisits: string[]
  finalQuoteShown: boolean
  /** 3 when this journey was conservatively migrated from a B save. */
  migratedFrom: 3 | null
  createdAt: number
  updatedAt: number
}

export type JourneyLoadStatus =
  | 'loaded'
  | 'migrated'
  | 'empty'
  | 'corrupt'
  | 'unavailable'

export interface JourneyLoadResult {
  save: JourneySave | null
  status: JourneyLoadStatus
  /** Whether the loaded/migrated save could be written to storage. */
  persisted: boolean
}

export const MAX_PLAYER_NAME_LENGTH = 20

export function sanitizePlayerName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_PLAYER_NAME_LENGTH)
}

export function isValidPlayerName(raw: string): boolean {
  return sanitizePlayerName(raw).length >= 2
}

export function createMissionProgress(): MissionProgress {
  return {
    discovered: false,
    scannedComponentIds: [],
    fullScanCompletedAt: null,
    memoryRecoveredAt: null,
    smartLetterCreatedAt: null,
    reconstructionWatchedAt: null,
    transmittedAt: null,
    stampEarned: false,
    legacySealAt: null,
  }
}

function validMemorialIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const valid = new Set<string>(MARS_OBJECTS.map((object) => object.id))
  return [
    ...new Set(
      value.filter((id): id is string => typeof id === 'string' && valid.has(id)),
    ),
  ]
}

function validEnvironmentalIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (id): id is string =>
          typeof id === 'string' && isEnvironmentalSiteId(id),
      ),
    ),
  ]
}

export function createEmptyMissionRecord(): Record<MissionId, MissionProgress> {
  return MISSION_IDS.reduce<Record<MissionId, MissionProgress>>(
    (missions, missionId) => {
      missions[missionId] = createMissionProgress()
      return missions
    },
    {} as Record<MissionId, MissionProgress>,
  )
}

export function createJourney(
  playerName: string,
  now: number = Date.now(),
): JourneySave {
  const name = sanitizePlayerName(playerName)
  if (!isValidPlayerName(name)) {
    throw new Error('A journey needs a player name of at least two characters.')
  }
  return {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    playerName: name,
    introSeen: false,
    onboardingComplete: false,
    currentDestination: null,
    missions: createEmptyMissionRecord(),
    environmentalDiscoveries: [],
    environmentalDetailedDiscoveries: [],
    memorialVisits: [],
    finalQuoteShown: false,
    migratedFrom: null,
    createdAt: now,
    updatedAt: now,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validScannedIds(missionId: MissionId, value: unknown): string[] {
  const validIds = new Set(
    getMission(missionId).components.map((component) => component.id),
  )
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === 'string' && validIds.has(id),
      ),
    ),
  ].slice(0, 3)
}

/**
 * Normalizes one mission record while enforcing Proposal A invariants.
 * A corrupt field can never jump from 3/3 scans to a transmitted history.
 */
function parseMissionProgress(
  missionId: MissionId,
  value: unknown,
): MissionProgress {
  if (!isRecord(value)) return createMissionProgress()

  const scannedComponentIds = validScannedIds(
    missionId,
    value.scannedComponentIds,
  )
  const discovered =
    value.discovered === true ||
    scannedComponentIds.length > 0 ||
    isTimestamp(value.memoryRecoveredAt) ||
    isTimestamp(value.transmittedAt)

  const fullScanCompletedAt =
    scannedComponentIds.length === 3 && isTimestamp(value.fullScanCompletedAt)
      ? value.fullScanCompletedAt
      : null

  // A recovered memory requires a completed full recognition scan.
  const memoryRecoveredAt =
    fullScanCompletedAt !== null &&
    (isTimestamp(value.memoryRecoveredAt) || value.memoryRecoveredAt === null)
      ? (isTimestamp(value.memoryRecoveredAt)
          ? value.memoryRecoveredAt
          : fullScanCompletedAt)
      : null

  // A smart letter requires a recovered memory.
  const smartLetterCreatedAt =
    memoryRecoveredAt !== null && isTimestamp(value.smartLetterCreatedAt)
      ? value.smartLetterCreatedAt
      : null

  // Watching the recreation requires the smart letter that unlocked it.
  const reconstructionWatchedAt =
    smartLetterCreatedAt !== null && isTimestamp(value.reconstructionWatchedAt)
      ? value.reconstructionWatchedAt
      : null

  // An Archive transmission requires the smart letter.
  const transmittedAt =
    smartLetterCreatedAt !== null && isTimestamp(value.transmittedAt)
      ? value.transmittedAt
      : null

  return {
    discovered,
    scannedComponentIds,
    fullScanCompletedAt,
    memoryRecoveredAt,
    smartLetterCreatedAt,
    reconstructionWatchedAt,
    transmittedAt,
    stampEarned: transmittedAt !== null,
    legacySealAt: isTimestamp(value.legacySealAt) ? value.legacySealAt : null,
  }
}

/**
 * Validates and normalizes a parsed v4 value. Core identity is strict
 * (schema version and player name); optional progress fields fall back
 * to safe defaults instead of destroying an otherwise usable journey.
 */
export function parseJourneySave(value: unknown): JourneySave | null {
  if (!isRecord(value) || value.schemaVersion !== JOURNEY_SCHEMA_VERSION) {
    return null
  }
  if (typeof value.playerName !== 'string' || !isValidPlayerName(value.playerName)) {
    return null
  }

  const missions = createEmptyMissionRecord()
  if (isRecord(value.missions)) {
    for (const missionId of MISSION_IDS) {
      missions[missionId] = parseMissionProgress(
        missionId,
        value.missions[missionId],
      )
    }
  }

  const currentDestination = isDestinationId(value.currentDestination)
    ? value.currentDestination
    : null

  const environmentalDetailedDiscoveries = validEnvironmentalIds(
    value.environmentalDetailedDiscoveries,
  )
  // Invariant: a detailed reading always implies the quick discovery.
  const environmentalDiscoveries = [
    ...new Set([
      ...validEnvironmentalIds(value.environmentalDiscoveries),
      ...environmentalDetailedDiscoveries,
    ]),
  ]

  return {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    playerName: sanitizePlayerName(value.playerName),
    introSeen: value.introSeen === true,
    onboardingComplete: value.onboardingComplete === true,
    currentDestination,
    missions,
    environmentalDiscoveries,
    environmentalDetailedDiscoveries,
    memorialVisits: validMemorialIds(value.memorialVisits),
    finalQuoteShown: value.finalQuoteShown === true,
    migratedFrom: value.migratedFrom === 3 ? 3 : null,
    createdAt: isTimestamp(value.createdAt) ? value.createdAt : 0,
    updatedAt: isTimestamp(value.updatedAt) ? value.updatedAt : 0,
  }
}

/**
 * Conservative Proposal B → A migration.
 *
 * Preserved: carrier identity, onboarding flags, current destination,
 * discovered machines and already-recognized components.
 * Not granted: full scan, memory core, smart letter, recreation or an
 * Archive transmission. The old letter seal is recorded in `legacySealAt`
 * so the passport can show it as history, never as an A delivery.
 */
export function migrateV3Save(value: unknown): JourneySave | null {
  if (!isRecord(value) || value.schemaVersion !== 3) return null
  if (typeof value.playerName !== 'string' || !isValidPlayerName(value.playerName)) {
    return null
  }

  const v3UpdatedAt = isTimestamp(value.updatedAt) ? value.updatedAt : 0
  const missions = createEmptyMissionRecord()
  if (isRecord(value.missions)) {
    for (const missionId of MISSION_IDS) {
      const legacy = value.missions[missionId]
      if (!isRecord(legacy)) continue
      const scannedComponentIds = validScannedIds(
        missionId,
        legacy.scannedComponentIds,
      )
      const legacyLetterAt = isTimestamp(legacy.letterCompletedAt)
        ? legacy.letterCompletedAt
        : null
      const legacySeal = legacy.stampEarned === true || legacyLetterAt !== null

      missions[missionId] = {
        ...createMissionProgress(),
        discovered:
          legacy.discovered === true ||
          scannedComponentIds.length > 0 ||
          legacySeal,
        scannedComponentIds,
        legacySealAt: legacySeal
          ? (legacyLetterAt ?? v3UpdatedAt)
          : null,
      }
    }
  }

  const currentDestination = isDestinationId(value.currentDestination)
    ? value.currentDestination
    : null

  return {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    playerName: sanitizePlayerName(value.playerName),
    introSeen: value.introSeen === true,
    onboardingComplete: value.onboardingComplete === true,
    currentDestination,
    missions,
    environmentalDiscoveries: [],
    environmentalDetailedDiscoveries: [],
    memorialVisits: [],
    finalQuoteShown: value.finalQuoteShown === true,
    migratedFrom: 3,
    createdAt: isTimestamp(value.createdAt) ? value.createdAt : 0,
    updatedAt: isTimestamp(value.updatedAt) ? value.updatedAt : v3UpdatedAt,
  }
}

export function serializeJourneySave(save: JourneySave): string {
  return JSON.stringify(save)
}

export function saveJourney(
  storage: StorageLike | null,
  save: JourneySave,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(JOURNEY_STORAGE_KEY, serializeJourneySave(save))
    return true
  } catch {
    return false
  }
}

function readJson(
  storage: StorageLike,
  key: string,
): { present: boolean; value: unknown } {
  const raw = storage.getItem(key)
  if (raw === null) return { present: false, value: null }
  try {
    return { present: true, value: JSON.parse(raw) as unknown }
  } catch {
    return { present: true, value: undefined }
  }
}

/**
 * Loads the v4 key. When it is absent, a valid v3 save is migrated into a
 * new v4 entry; the v3 entry itself is left untouched. Corrupt data in
 * either key is reported without writing anything.
 */
export function loadJourney(storage: StorageLike | null): JourneyLoadResult {
  if (!storage) {
    return { save: null, status: 'unavailable', persisted: false }
  }

  let current: { present: boolean; value: unknown }
  try {
    current = readJson(storage, JOURNEY_STORAGE_KEY)
  } catch {
    return { save: null, status: 'unavailable', persisted: false }
  }

  if (current.present) {
    const save = parseJourneySave(current.value)
    return save
      ? { save, status: 'loaded', persisted: true }
      : { save: null, status: 'corrupt', persisted: false }
  }

  let legacy: { present: boolean; value: unknown }
  try {
    legacy = readJson(storage, LEGACY_JOURNEY_STORAGE_KEY)
  } catch {
    return { save: null, status: 'unavailable', persisted: false }
  }

  if (!legacy.present) {
    return { save: null, status: 'empty', persisted: false }
  }

  const migrated = migrateV3Save(legacy.value)
  if (!migrated) {
    return { save: null, status: 'corrupt', persisted: false }
  }

  // Non-destructive: only the new key is written. The v3 source remains.
  let persisted = false
  try {
    storage.setItem(JOURNEY_STORAGE_KEY, serializeJourneySave(migrated))
    persisted = true
  } catch {
    persisted = false
  }
  return { save: migrated, status: 'migrated', persisted }
}

/**
 * Removes only the v4 key. The legacy v3 key is preserved so the previous
 * journey can still be inspected manually.
 */
export function removeJourney(storage: StorageLike | null): boolean {
  if (!storage) return false
  try {
    storage.removeItem(JOURNEY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

/** Safe accessor: private mode, SSR and blocked storage all return null. */
export function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
