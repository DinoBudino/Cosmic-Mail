/**
 * Domain audio events. Components and controllers call `emitAudio` with
 * an intent ("scanCompleted"), never with a filename or a random
 * `new Audio()`. The plan below is the only place that maps game
 * events to assets.
 */

import { audioManager, type LoopKey, type SfxOptions } from './audioManager'
import type { AudioAssetId } from './audioManifest'
import type { AmbienceCueId, MusicCueId } from './musicCues'

export type AudioEvent =
  | 'uiHover'
  | 'uiClick'
  | 'uiConfirm'
  | 'uiError'
  | 'passportOpened'
  | 'passportClosed'
  | 'navigationOpened'
  | 'navigationClosed'
  | 'destinationSelected'
  | 'routeConfirmed'
  | 'redButton'
  | 'settingsOpened'
  | 'settingsClosed'
  | 'postalSignature'
  | 'postalSealed'
  | 'introStarted'
  | 'introSkipped'
  | 'registrationStarted'
  | 'hubEntered'
  | 'returnedToShip'
  | 'archiveActivated'
  | 'archiveQuery'
  | 'archiveClosed'
  | 'archiveFaultStarted'
  | 'archiveConnectionLost'
  | 'archiveQueryFailed'
  | 'archiveClueRecovered'
  | 'archiveFragmentRecovered'
  | 'archiveFragmentIdentified'
  | 'pipAttention'
  | 'pipCurious'
  | 'pipSurprised'
  | 'pipWorried'
  | 'pipDiscovery'
  | 'pipCelebrate'
  | 'pipHologram'
  | 'launchStarted'
  | 'launchIgnition'
  | 'launchCountdown'
  | 'launchLiftoff'
  | 'launchSpaceTransition'
  | 'launchArrived'
  | 'launchSkipped'
  | 'playerLanded'
  | 'scannerEquipped'
  | 'scannerUnequipped'
  | 'scannerTargetAcquired'
  | 'scannerTargetLost'
  | 'scanStarted'
  | 'scanProgressHalf'
  | 'scanInterrupted'
  | 'scanCompleted'
  | 'scanAlreadyRegistered'
  | 'fullScanOpened'
  | 'fullScanStarted'
  | 'fullScanCancelled'
  | 'fullScanCompleted'
  | 'memoryRecovered'
  | 'smartLetterOpened'
  | 'smartLetterCreated'
  | 'smartLetterPrepared'
  | 'smartLetterClosed'
  | 'reconstructionOpened'
  | 'reconstructionLine'
  | 'reconstructionClosed'
  | 'transmissionStarted'
  | 'transmissionSignal'
  | 'transmissionReceived'
  | 'stampEarned'
  | 'historyRestored'
  | 'transmissionCompleted'
  | 'missionStampEarned'
  | 'thrusterStarted'
  | 'thrusterStopped'
  | 'landing'
  | 'footstepRock'
  | 'footstepLunar'

interface DelayedSfx {
  assetId: AudioAssetId
  delayMs: number
}

export interface AudioEventPlan {
  sfx?: readonly AudioAssetId[]
  delayedSfx?: readonly DelayedSfx[]
  loop?: { key: LoopKey; assetId: AudioAssetId; volume?: number }
  stopLoops?: readonly LoopKey[]
  music?: MusicCueId
  ambience?: AmbienceCueId | null
  duckMs?: number
}

export const EVENT_PLANS: Record<AudioEvent, AudioEventPlan> = {
  uiHover: { sfx: ['ui.hoverLow'] },
  uiClick: { sfx: ['ui.clickLow'] },
  uiConfirm: { sfx: ['ui.confirm'] },
  uiError: { sfx: ['ui.error'] },
  passportOpened: { sfx: ['ui.openWarm', 'ui.pageTurn'] },
  passportClosed: { sfx: ['ui.closeWarm'] },
  navigationOpened: { sfx: ['ui.navOpen'] },
  navigationClosed: { sfx: ['ui.back'] },
  destinationSelected: { sfx: ['ui.select'] },
  routeConfirmed: { sfx: ['ui.routeConfirm'] },
  redButton: { sfx: ['ship.redButton'] },
  settingsOpened: { sfx: ['ui.openWarm'] },
  settingsClosed: { sfx: ['ui.closeWarm'] },
  postalSignature: { sfx: ['ui.signature'] },
  postalSealed: { sfx: ['ui.stamp', 'ui.confirm'] },
  introStarted: { sfx: ['pip.attention', 'ui.openWarm'] },
  introSkipped: { sfx: ['ui.back'] },
  registrationStarted: { sfx: ['ui.confirmSoft'] },
  hubEntered: { sfx: ['ui.confirm', 'pip.celebrate'] },
  returnedToShip: { sfx: ['ui.confirm', 'ship.spaceTransition'] },

  archiveActivated: { sfx: ['archive.activate', 'archive.query'] },
  archiveQuery: { sfx: ['archive.query'] },
  archiveClosed: { sfx: ['ui.closeWarm'] },
  archiveFaultStarted: {
    sfx: ['archive.glitch', 'archive.connectionLost', 'pip.worried'],
    duckMs: 900,
  },
  archiveConnectionLost: {
    sfx: ['archive.connectionLost', 'archive.glitchSoft'],
  },
  archiveQueryFailed: { sfx: ['archive.queryFailed', 'ui.error'] },
  archiveClueRecovered: {
    sfx: ['archive.signalRecovered', 'pip.curious', 'pip.hologram'],
  },
  archiveFragmentRecovered: {
    sfx: [
      'archive.fragment',
      'archive.fragmentIdentified',
      'scanner.fragment',
      'pip.discovery',
    ],
  },
  archiveFragmentIdentified: { sfx: ['archive.fragmentIdentified'] },

  pipAttention: { sfx: ['pip.attention'] },
  pipCurious: { sfx: ['pip.curious'] },
  pipSurprised: { sfx: ['pip.surprised'] },
  pipWorried: { sfx: ['pip.worried'] },
  pipDiscovery: { sfx: ['pip.discovery'] },
  pipCelebrate: { sfx: ['pip.celebrate'] },
  pipHologram: { sfx: ['pip.hologram'] },

  launchStarted: {
    sfx: ['ship.redButton', 'ui.confirm'],
    loop: { key: 'enginePrep', assetId: 'ship.enginePrep', volume: 0.8 },
  },
  launchIgnition: {
    sfx: ['ship.ignition'],
    loop: { key: 'enginePrep', assetId: 'ship.enginePrep', volume: 0.9 },
  },
  launchCountdown: { sfx: ['ui.toggle'] },
  launchLiftoff: {
    sfx: ['ship.liftoff'],
    stopLoops: ['enginePrep'],
    loop: { key: 'propulsion', assetId: 'ship.propulsion', volume: 0.7 },
  },
  launchSpaceTransition: { sfx: ['ship.spaceTransition'] },
  launchArrived: {
    sfx: ['ship.spaceTransition'],
    stopLoops: ['propulsion'],
  },
  launchSkipped: {
    sfx: ['ui.back'],
    stopLoops: ['enginePrep', 'propulsion'],
  },
  playerLanded: {
    sfx: ['player.landing', 'player.landingMetal', 'pip.attention'],
    stopLoops: ['propulsion'],
  },

  scannerEquipped: { sfx: ['player.scannerEquip', 'scanner.activate'] },
  scannerUnequipped: {
    sfx: ['player.scannerUnequip'],
    stopLoops: ['scanner', 'fullScan'],
  },
  scannerTargetAcquired: { sfx: ['scanner.target'] },
  scannerTargetLost: { sfx: ['ui.back'] },
  scanStarted: {
    sfx: ['scanner.start'],
    loop: { key: 'scanner', assetId: 'scanner.loop', volume: 0.8 },
  },
  scanProgressHalf: { sfx: ['scanner.progress'] },
  scanInterrupted: {
    sfx: ['scanner.interrupt'],
    stopLoops: ['scanner'],
  },
  scanCompleted: {
    sfx: ['scanner.fragment'],
    stopLoops: ['scanner'],
  },
  scanAlreadyRegistered: { sfx: ['scanner.already'] },
  fullScanOpened: { sfx: ['archive.activate', 'scanner.activate'] },
  fullScanStarted: {
    sfx: ['scanner.fullScanInit'],
    loop: { key: 'fullScan', assetId: 'scanner.fullScanLoop', volume: 0.9 },
  },
  fullScanCancelled: {
    sfx: ['scanner.interrupt'],
    stopLoops: ['fullScan'],
  },
  fullScanCompleted: {
    sfx: ['scanner.fullScanComplete', 'scanner.coreUnlock'],
    stopLoops: ['fullScan'],
  },

  memoryRecovered: {
    sfx: ['memory.recovered', 'pip.discovery'],
    music: 'memory',
  },
  smartLetterOpened: { sfx: ['memory.letterOpen', 'ui.hologram'] },
  smartLetterCreated: {
    sfx: [
      'memory.letterMaterialize',
      'memory.letterCreate',
      'memory.letterReady',
    ],
  },
  smartLetterPrepared: { sfx: ['ui.confirm'] },
  smartLetterClosed: { sfx: ['memory.letterClose'] },
  reconstructionOpened: {
    sfx: ['memory.reconstructionStart'],
    music: 'reconstruction',
  },
  reconstructionLine: { sfx: ['memory.reconstructionLine'] },
  reconstructionClosed: { sfx: ['memory.reconstructionEnd'] },

  transmissionStarted: {
    sfx: ['transmission.start', 'transmission.signal'],
  },
  transmissionSignal: { sfx: ['transmission.signal'] },
  transmissionReceived: { sfx: ['transmission.received'] },
  stampEarned: { sfx: ['transmission.stamp'] },
  historyRestored: { sfx: ['transmission.historyRestored'] },
  transmissionCompleted: {
    delayedSfx: [
      { assetId: 'transmission.received', delayMs: 1100 },
      { assetId: 'transmission.stamp', delayMs: 1700 },
      { assetId: 'transmission.historyRestored', delayMs: 2000 },
    ],
    music: 'transmission',
  },
  missionStampEarned: { sfx: ['transmission.stamp'] },

  thrusterStarted: {
    sfx: ['player.thrusterStart'],
    loop: { key: 'thruster', assetId: 'player.thrusterLoop', volume: 0.8 },
  },
  thrusterStopped: { stopLoops: ['thruster'] },
  landing: { sfx: ['player.landing', 'player.landingMetal'] },
  footstepRock: {},
  footstepLunar: {},
}

export interface EmitAudioOptions extends SfxOptions {
  /** Replace the plan's one-shots when a variant must be chosen at runtime. */
  sfxOverride?: readonly AudioAssetId[]
}

export function emitAudio(event: AudioEvent, options: EmitAudioOptions = {}): void {
  const plan = EVENT_PLANS[event]
  const list = options.sfxOverride ?? plan.sfx ?? []
  for (const assetId of list) {
    audioManager.playSfx(assetId, {
      volume: options.volume,
      playbackRate: options.playbackRate,
      dedupeKey: options.dedupeKey
        ? `${options.dedupeKey}:${assetId}`
        : undefined,
      dedupeMs: options.dedupeMs,
    })
  }
  for (const delayed of plan.delayedSfx ?? []) {
    audioManager.playSfx(delayed.assetId, {
      delayMs: delayed.delayMs,
      dedupeKey: options.dedupeKey,
    })
  }
  if (plan.loop) {
    audioManager.startLoop(plan.loop.key, plan.loop.assetId, {
      volume: plan.loop.volume,
    })
  }
  for (const key of plan.stopLoops ?? []) audioManager.stopLoop(key)
  if (plan.music) void audioManager.playMusic(plan.music)
  if (plan.ambience !== undefined) void audioManager.playAmbience(plan.ambience)
  if (plan.duckMs) audioManager.beginVoice(plan.duckMs)
}

const ROCK_FOOTSTEPS: readonly AudioAssetId[] = [
  'player.footstepRock1',
  'player.footstepRock2',
  'player.footstepRock3',
  'player.footstepRock4',
]

const LUNAR_FOOTSTEPS: readonly AudioAssetId[] = [
  'player.footstepLunar1',
  'player.footstepLunar2',
  'player.footstepLunar3',
]

/** Footsteps pick a variant without turning every frame into an event. */
export function emitFootstep(
  surface: 'rock' | 'lunar',
  variant: number,
): void {
  const list = surface === 'lunar' ? LUNAR_FOOTSTEPS : ROCK_FOOTSTEPS
  const index = Math.abs(Math.floor(variant)) % list.length
  audioManager.playSfx(list[index]!, {
    dedupeKey: `footstep:${surface}`,
    dedupeMs: 85,
  })
}
