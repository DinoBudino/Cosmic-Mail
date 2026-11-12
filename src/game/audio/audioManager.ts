/**
 * One AudioContext for the whole game. Every music bed, ambience loop,
 * one-shot and loop goes through this class so the mixer, crossfades,
 * voice ducking, autoplay unlocking and cleanup stay consistent.
 *
 * The class is deliberately framework-free and injectable: tests can
 * provide a fake AudioContext and fetch implementation.
 */

import {
  DEFAULT_AUDIO_PREFERENCES,
  clampVolume,
  effectiveVoiceOutput,
  type AudioPreferences,
} from './audioSettings'
import { AUDIO_ASSETS, audioUrl, getAudioAsset, type AudioAssetId } from './audioManifest'
import type { AudioAsset } from './types'
import {
  busGain,
  duckGain,
  isDuplicate,
  VOICE_DUCK_LEVEL,
} from './audioMath'
import {
  AMBIENCE_CUES,
  MUSIC_CUES,
  type AmbienceCueId,
  type MusicCueId,
} from './musicCues'

export type LoopKey =
  | 'scanner'
  | 'fullScan'
  | 'thruster'
  | 'enginePrep'
  | 'propulsion'
  | 'transmission'

export interface AudioLoadError {
  assetId: string
  message: string
  at: number
}

export interface AudioManagerOptions {
  createContext?: () => AudioContext | null
  fetchImpl?: typeof fetch | null
  now?: () => number
}

export interface SfxOptions {
  volume?: number
  playbackRate?: number
  dedupeKey?: string
  dedupeMs?: number
  delayMs?: number
  maxConcurrent?: number
}

export interface LoopOptions {
  volume?: number
  fadeMs?: number
}

interface ActiveMusic {
  cueId: MusicCueId
  assetId: AudioAssetId
  source: AudioBufferSourceNode
  gain: GainNode
  token: number
}

interface ActiveAmbience {
  cueId: AmbienceCueId
  assetId: AudioAssetId
  source: AudioBufferSourceNode
  gain: GainNode
  token: number
}

interface ActiveLoop {
  key: LoopKey
  assetId: AudioAssetId
  source: AudioBufferSourceNode
  gain: GainNode
  token: number
  baseVolume: number
}

interface PendingLoop {
  assetId: AudioAssetId
  volume: number
}

const DEFAULT_SFX_DEDUPE_MS = 65
const MAX_VOICE_DUCK_MS = 20_000

function defaultContextFactory(): AudioContext | null {
  if (typeof globalThis === 'undefined') return null
  const ctor =
    (globalThis as unknown as { AudioContext?: typeof AudioContext })
      .AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!ctor) return null
  try {
    return new ctor()
  } catch {
    return null
  }
}

function safeDisconnect(node: AudioNode | null | undefined): void {
  try {
    node?.disconnect()
  } catch {
    // Already disconnected.
  }
}

function safeStop(source: AudioBufferSourceNode | null | undefined): void {
  try {
    source?.stop()
  } catch {
    // Already stopped.
  }
}

export class AudioManager {
  private readonly createContext: () => AudioContext | null
  private readonly fetchImpl: typeof fetch | null
  private readonly now: () => number

  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private ambienceGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private voiceGain: GainNode | null = null
  private bedDuckGain: GainNode | null = null

  private preferences: AudioPreferences = { ...DEFAULT_AUDIO_PREFERENCES }
  private focusDucked = false
  private pageHidden = false
  private unlocked = false
  private disposed = false
  private unlockPromise: Promise<void> | null = null

  private pendingMusic: MusicCueId | null = null
  private pendingAmbience: AmbienceCueId | null = null
  private pendingLoops = new Map<LoopKey, PendingLoop>()

  private music: ActiveMusic | null = null
  private ambience: ActiveAmbience | null = null
  private loops = new Map<LoopKey, ActiveLoop>()
  private musicToken = 0
  private ambienceToken = 0
  private loopTokens = new Map<LoopKey, number>()

  private buffers = new Map<AudioAssetId, AudioBuffer>()
  private bufferLoads = new Map<AudioAssetId, Promise<AudioBuffer | null>>()
  private mediaOrder: AudioAssetId[] = []
  private errors: AudioLoadError[] = []

  private lastSfxAt = new Map<string, number>()
  private activeSfx = new Map<AudioAssetId, number>()
  private delayedSfxTimers = new Set<ReturnType<typeof setTimeout>>()

  private voiceDuckActive = false
  private voiceDuckToken = 0
  private voiceDuckTimer: ReturnType<typeof setTimeout> | null = null
  private timers = new Set<ReturnType<typeof setTimeout>>()

  constructor(options: AudioManagerOptions = {}) {
    this.createContext = options.createContext ?? defaultContextFactory
    this.fetchImpl =
      options.fetchImpl === undefined
        ? typeof fetch === 'function'
          ? fetch.bind(globalThis)
          : null
        : options.fetchImpl
    this.now =
      options.now ??
      (() =>
        typeof performance !== 'undefined' ? performance.now() : Date.now())
  }

  /* ------------------------------------------------------------ lifecycle */

  /** Must be called from a real user gesture (pointerdown/keydown). */
  unlock(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    this.unlocked = true
    const context = this.ensureContext()
    if (!context) return Promise.resolve()

    if (this.unlockPromise) return this.unlockPromise
    const resume =
      context.state === 'suspended'
        ? Promise.resolve(context.resume())
        : Promise.resolve()
    this.unlockPromise = resume
      .then(() => {
        this.flushPending()
      })
      .catch(() => {
        // Autoplay policies can still refuse; the next gesture retries.
      })
      .finally(() => {
        this.unlockPromise = null
      })
    return this.unlockPromise
  }

  isUnlocked(): boolean {
    return this.unlocked
  }

  getPreferences(): AudioPreferences {
    return { ...this.preferences }
  }

  setVolumes(partial: Partial<AudioPreferences>): void {
    const next = { ...this.preferences, ...partial }
    this.preferences = {
      masterVolume: clampVolume(next.masterVolume),
      musicVolume: clampVolume(next.musicVolume),
      ambienceVolume: clampVolume(next.ambienceVolume),
      sfxVolume: clampVolume(next.sfxVolume),
      voiceVolume: clampVolume(next.voiceVolume),
      muted: next.muted === true,
    }
    this.applyVolumes(0.12)
  }

  setFocusDucked(active: boolean): void {
    if (this.focusDucked === active) return
    this.focusDucked = active
    this.applyVolumes(0.35)
  }

  setPageHidden(hidden: boolean): void {
    if (this.pageHidden === hidden) return
    this.pageHidden = hidden
    this.applyVolumes(0.18)
    if (!hidden && this.context?.state === 'suspended') {
      void this.context.resume().catch(() => {
        // The next gesture will resume it.
      })
    }
  }

  /** HTMLAudioElement voice output (PIP) reads this effective gain. */
  getEffectiveVoiceVolume(): number {
    return effectiveVoiceOutput(this.preferences)
  }

  /** Warm the decode cache after the first gesture; never before it. */
  preload(ids: readonly AudioAssetId[]): void {
    if (!this.unlocked || !this.context || this.disposed) return
    for (const id of ids) void this.loadBuffer(id)
  }

  /* ------------------------------------------------------------- voice duck */

  beginVoice(durationMs: number): void {
    if (this.disposed) return
    this.voiceDuckActive = true
    this.applyVolumes(0.18)
    const token = ++this.voiceDuckToken
    if (this.voiceDuckTimer) clearTimeout(this.voiceDuckTimer)
    const clamped = Math.min(
      MAX_VOICE_DUCK_MS,
      Math.max(300, Number.isFinite(durationMs) ? durationMs : 2500),
    )
    this.voiceDuckTimer = this.schedule(() => {
      this.voiceDuckTimer = null
      if (token === this.voiceDuckToken) this.endVoice()
    }, clamped + 250)
  }

  endVoice(): void {
    if (this.disposed) return
    this.voiceDuckToken += 1
    if (this.voiceDuckTimer) {
      clearTimeout(this.voiceDuckTimer)
      this.voiceDuckTimer = null
    }
    if (!this.voiceDuckActive) return
    this.voiceDuckActive = false
    this.applyVolumes(0.55)
  }

  /* ---------------------------------------------------------------- music */

  async playMusic(cueId: MusicCueId): Promise<void> {
    if (this.disposed) return
    const cue = MUSIC_CUES[cueId]
    if (this.music?.assetId === cue.assetId) {
      this.rampNodeGain(this.music.gain, this.musicTarget(cue.assetId, cueId), 0.7)
      return
    }

    this.pendingMusic = cueId
    if (!this.unlocked) return
    const context = this.ensureContext()
    if (!context) return

    const token = ++this.musicToken
    const buffer = await this.loadBuffer(cue.assetId)
    if (!buffer || token !== this.musicToken || this.disposed) return

    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopEnd = buffer.duration
    const gain = context.createGain()
    const now = context.currentTime
    const target = this.musicTarget(cue.assetId, cueId)
    this.rampNodeGain(gain, 0.0001, 0, now)
    source.connect(gain)
    if (this.musicGain) gain.connect(this.musicGain)
    source.start(now)
    this.rampNodeGain(gain, target, cue.fadeMs / 1000, now)

    const previous = this.music
    this.music = {
      cueId,
      assetId: cue.assetId,
      source,
      gain,
      token,
    }
    this.pendingMusic = null

    if (previous) {
      this.fadeOutAndStop(previous.gain, previous.source, cue.fadeMs / 1000)
    }
  }

  stopMusic(fadeMs = 1200): void {
    this.musicToken += 1
    this.pendingMusic = null
    const current = this.music
    this.music = null
    if (current) {
      this.fadeOutAndStop(current.gain, current.source, fadeMs / 1000)
    }
  }

  /* ------------------------------------------------------------- ambience */

  async playAmbience(cueId: AmbienceCueId | null): Promise<void> {
    if (this.disposed) return
    if (cueId === null) {
      this.stopAmbience()
      return
    }
    const cue = AMBIENCE_CUES[cueId]
    if (this.ambience?.assetId === cue.assetId) {
      this.rampNodeGain(this.ambience.gain, this.ambienceTarget(cue.assetId), 0.7)
      return
    }

    this.pendingAmbience = cueId
    if (!this.unlocked) return
    const context = this.ensureContext()
    if (!context) return

    const token = ++this.ambienceToken
    const buffer = await this.loadBuffer(cue.assetId)
    if (!buffer || token !== this.ambienceToken || this.disposed) return

    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopEnd = buffer.duration
    const gain = context.createGain()
    const now = context.currentTime
    const target = this.ambienceTarget(cue.assetId)
    this.rampNodeGain(gain, 0.0001, 0, now)
    source.connect(gain)
    if (this.ambienceGain) gain.connect(this.ambienceGain)
    source.start(now)
    this.rampNodeGain(gain, target, cue.fadeMs / 1000, now)

    const previous = this.ambience
    this.ambience = {
      cueId,
      assetId: cue.assetId,
      source,
      gain,
      token,
    }
    this.pendingAmbience = null

    if (previous) {
      this.fadeOutAndStop(previous.gain, previous.source, cue.fadeMs / 1000)
    }
  }

  stopAmbience(fadeMs = 1400): void {
    this.ambienceToken += 1
    this.pendingAmbience = null
    const current = this.ambience
    this.ambience = null
    if (current) {
      this.fadeOutAndStop(current.gain, current.source, fadeMs / 1000)
    }
  }

  /* ----------------------------------------------------------------- sfx */

  playSfx(id: AudioAssetId, options: SfxOptions = {}): void {
    if (this.disposed) return
    const asset = getAudioAsset(id)
    if (asset.category !== 'sfx') return

    const key = options.dedupeKey ?? id
    const now = this.now()
    if (isDuplicate(this.lastSfxAt.get(key), now, options.dedupeMs ?? DEFAULT_SFX_DEDUPE_MS)) {
      return
    }
    this.lastSfxAt.set(key, now)

    const maxConcurrent = options.maxConcurrent ?? 3
    if ((this.activeSfx.get(id) ?? 0) >= maxConcurrent) return

    if (options.delayMs && options.delayMs > 0) {
      const timer = this.schedule(() => {
        this.delayedSfxTimers.delete(timer)
        void this.playSfxNow(id, asset, options)
      }, options.delayMs)
      this.delayedSfxTimers.add(timer)
      return
    }
    void this.playSfxNow(id, asset, options)
  }

  private async playSfxNow(
    id: AudioAssetId,
    asset: AudioAsset,
    options: SfxOptions,
  ): Promise<void> {
    if (!this.unlocked || this.disposed) return
    const context = this.ensureContext()
    if (!context) return

    const buffer = await this.loadBuffer(id)
    if (!buffer || this.disposed) return

    const rate = Math.min(4, Math.max(0.25, options.playbackRate ?? 1))
    const volume = Math.min(
      2,
      Math.max(0, (options.volume ?? 1) * asset.volume),
    )
    const source = context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    const gain = context.createGain()
    const now = context.currentTime
    const duration = buffer.duration / rate
    const releaseStart = now + Math.max(0, duration - 0.035)

    this.rampNodeGain(gain, 0.0001, 0, now)
    source.connect(gain)
    if (this.sfxGain) gain.connect(this.sfxGain)
    source.start(now)
    this.rampNodeGain(gain, volume, 0.006, now)
    gain.gain.setValueAtTime(volume, releaseStart)
    gain.gain.linearRampToValueAtTime(0.0001, now + duration)
    source.stop(now + duration + 0.02)

    const count = (this.activeSfx.get(id) ?? 0) + 1
    this.activeSfx.set(id, count)
    source.onended = () => {
      const remaining = Math.max(0, (this.activeSfx.get(id) ?? 1) - 1)
      if (remaining === 0) this.activeSfx.delete(id)
      else this.activeSfx.set(id, remaining)
      safeDisconnect(source)
      safeDisconnect(gain)
    }
  }

  /* ---------------------------------------------------------------- loops */

  startLoop(key: LoopKey, id: AudioAssetId, options: LoopOptions = {}): void {
    if (this.disposed) return
    const asset = getAudioAsset(id)
    if (asset.category !== 'sfx') return

    const existing = this.loops.get(key)
    if (existing?.assetId === id) {
      existing.baseVolume = this.loopTarget(asset, options.volume)
      this.rampNodeGain(
        existing.gain,
        existing.baseVolume * this.loopDuckFactor(key),
        0.4,
      )
      return
    }

    this.pendingLoops.set(key, { assetId: id, volume: options.volume ?? 1 })
    if (!this.unlocked) return
    void this.startLoopNow(key, id, asset, options)
  }

  private async startLoopNow(
    key: LoopKey,
    id: AudioAssetId,
    asset: AudioAsset,
    options: LoopOptions,
  ): Promise<void> {
    const context = this.ensureContext()
    if (!context || this.disposed) return

    // Stop the old bed first: stopLoop advances the token deliberately,
    // so the new token must be assigned afterwards.
    this.stopLoop(key, 0.12)
    const token = (this.loopTokens.get(key) ?? 0) + 1
    this.loopTokens.set(key, token)

    const buffer = await this.loadBuffer(id)
    if (
      !buffer ||
      token !== this.loopTokens.get(key) ||
      this.disposed ||
      !this.unlocked
    ) {
      return
    }

    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopEnd = buffer.duration
    const gain = context.createGain()
    const now = context.currentTime
    const baseVolume = this.loopTarget(asset, options.volume)
    const target = baseVolume * this.loopDuckFactor(key)
    const fadeSeconds = (options.fadeMs ?? 220) / 1000

    this.rampNodeGain(gain, 0.0001, 0, now)
    source.connect(gain)
    if (this.sfxGain) gain.connect(this.sfxGain)
    source.start(now)
    this.rampNodeGain(gain, target, fadeSeconds, now)

    this.loops.set(key, {
      key,
      assetId: id,
      source,
      gain,
      token,
      baseVolume,
    })
    this.pendingLoops.delete(key)
  }

  stopLoop(key: LoopKey, fadeMs = 180): void {
    this.pendingLoops.delete(key)
    this.loopTokens.set(key, (this.loopTokens.get(key) ?? 0) + 1)
    const current = this.loops.get(key)
    if (!current) return
    this.loops.delete(key)
    this.fadeOutAndStop(current.gain, current.source, fadeMs / 1000)
  }

  stopAllLoops(fadeMs = 150): void {
    for (const key of [...this.loops.keys()]) this.stopLoop(key, fadeMs)
    this.pendingLoops.clear()
  }

  stopAll(): void {
    this.stopMusic(600)
    this.stopAmbience(600)
    this.stopAllLoops(120)
    this.pendingMusic = null
    this.pendingAmbience = null
    this.activeSfx.clear()
    for (const timer of this.delayedSfxTimers) clearTimeout(timer)
    this.delayedSfxTimers.clear()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopAll()
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    this.buffers.clear()
    this.bufferLoads.clear()
    this.mediaOrder = []
    const context = this.context
    this.context = null
    this.masterGain = null
    this.musicGain = null
    this.ambienceGain = null
    this.sfxGain = null
    this.voiceGain = null
    this.bedDuckGain = null
    if (context && context.state !== 'closed') {
      void context.close().catch(() => {
        // Closing can fail if the context never started.
      })
    }
  }

  /* ------------------------------------------------------------ diagnostics */

  getLoadErrors(): AudioLoadError[] {
    return [...this.errors]
  }

  /** Numeric bus levels, useful for diagnostics and mixer tests. */
  getMixerLevels() {
    return {
      master: this.masterGain?.gain.value ?? 0,
      music: this.musicGain?.gain.value ?? 0,
      ambience: this.ambienceGain?.gain.value ?? 0,
      sfx: this.sfxGain?.gain.value ?? 0,
      voice: this.voiceGain?.gain.value ?? 0,
      duck: this.bedDuckGain?.gain.value ?? 0,
    }
  }

  getDebugState() {
    return {
      unlocked: this.unlocked,
      contextState: this.context?.state ?? 'none',
      music: this.music?.assetId ?? null,
      ambience: this.ambience?.assetId ?? null,
      loops: [...this.loops.keys()],
      errors: this.getLoadErrors(),
      preferences: this.getPreferences(),
      voiceDucked: this.voiceDuckActive,
    }
  }

  /* -------------------------------------------------------------- internals */

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context
    if (this.disposed) return null
    const context = this.createContext()
    if (!context) return null
    this.context = context

    const master = context.createGain()
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -6
    compressor.knee.value = 6
    compressor.ratio.value = 3
    compressor.attack.value = 0.003
    compressor.release.value = 0.25
    master.connect(compressor)
    compressor.connect(context.destination)

    const music = context.createGain()
    const ambience = context.createGain()
    const sfx = context.createGain()
    const voice = context.createGain()
    const bedDuck = context.createGain()
    music.connect(bedDuck)
    ambience.connect(bedDuck)
    bedDuck.connect(master)
    sfx.connect(master)
    voice.connect(master)

    this.masterGain = master
    this.musicGain = music
    this.ambienceGain = ambience
    this.sfxGain = sfx
    this.voiceGain = voice
    this.bedDuckGain = bedDuck
    this.applyVolumes(0.01)
    return context
  }

  private applyVolumes(fadeSeconds: number): void {
    if (!this.context) return
    const state = {
      preferences: this.preferences,
      focusDucked: this.focusDucked,
      pageHidden: this.pageHidden,
    }
    const now = this.context.currentTime
    if (this.masterGain) {
      const master =
        this.preferences.muted || this.pageHidden
          ? 0
          : clampVolume(this.preferences.masterVolume)
      this.rampNodeGain(this.masterGain, master, fadeSeconds, now)
    }
    if (this.musicGain) {
      this.rampNodeGain(
        this.musicGain,
        busGain(state, 'music'),
        fadeSeconds,
        now,
      )
    }
    if (this.ambienceGain) {
      this.rampNodeGain(
        this.ambienceGain,
        busGain(state, 'ambience'),
        fadeSeconds,
        now,
      )
    }
    if (this.sfxGain) {
      this.rampNodeGain(this.sfxGain, busGain(state, 'sfx'), fadeSeconds, now)
    }
    if (this.voiceGain) {
      this.rampNodeGain(
        this.voiceGain,
        busGain(state, 'voice'),
        fadeSeconds,
        now,
      )
    }
    if (this.bedDuckGain) {
      this.rampNodeGain(
        this.bedDuckGain,
        duckGain(this.voiceDuckActive, VOICE_DUCK_LEVEL),
        fadeSeconds,
        now,
      )
    }
    // Scanner beds must not cover PIP's science explanation. They follow
    // the voice duck, while critical one-shots stay at full level.
    for (const [key, loop] of this.loops) {
      this.rampNodeGain(
        loop.gain,
        loop.baseVolume * this.loopDuckFactor(key),
        fadeSeconds,
        now,
      )
    }
  }

  private loopDuckFactor(key: LoopKey): number {
    if (!this.voiceDuckActive) return 1
    return key === 'scanner' || key === 'fullScan' ? 0.35 : 1
  }

  private musicTarget(assetId: AudioAssetId, cueId: MusicCueId): number {
    const asset = AUDIO_ASSETS[assetId]
    return Math.max(0.0001, asset.volume * MUSIC_CUES[cueId].volume)
  }

  private ambienceTarget(assetId: AudioAssetId): number {
    const asset = AUDIO_ASSETS[assetId]
    return Math.max(0.0001, asset.volume)
  }

  private loopTarget(asset: AudioAsset, volume = 1): number {
    return Math.max(0.0001, asset.volume * volume)
  }

  private rampNodeGain(
    node: GainNode,
    value: number,
    seconds: number,
    at = this.context?.currentTime ?? 0,
  ): void {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    const param = node.gain
    param.cancelScheduledValues(at)
    const current = typeof param.value === 'number' ? param.value : safe
    param.setValueAtTime(current, at)
    param.linearRampToValueAtTime(safe, at + Math.max(0.005, seconds))
  }

  private fadeOutAndStop(
    gain: GainNode,
    source: AudioBufferSourceNode,
    seconds: number,
  ): void {
    this.rampNodeGain(gain, 0.0001, seconds)
    this.schedule(() => {
      safeStop(source)
      safeDisconnect(source)
      safeDisconnect(gain)
    }, Math.max(0, seconds) * 1000 + 120)
  }

  private flushPending(): void {
    if (this.disposed) return
    if (this.pendingMusic) {
      const cue = this.pendingMusic
      this.pendingMusic = null
      void this.playMusic(cue)
    }
    if (this.pendingAmbience) {
      const cue = this.pendingAmbience
      this.pendingAmbience = null
      void this.playAmbience(cue)
    }
    for (const [key, pending] of this.pendingLoops) {
      this.pendingLoops.delete(key)
      this.startLoop(key, pending.assetId, { volume: pending.volume })
    }
  }

  private async loadBuffer(id: AudioAssetId): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id)
    if (cached) return cached
    const inFlight = this.bufferLoads.get(id)
    if (inFlight) return inFlight
    if (!this.fetchImpl) {
      this.recordError(id, 'fetch is unavailable')
      return null
    }

    const promise = (async () => {
      try {
        const response = await this.fetchImpl!(audioUrl(getAudioAsset(id)), {
          cache: 'force-cache',
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const bytes = await response.arrayBuffer()
        if (!this.context) throw new Error('AudioContext unavailable')
        const buffer = await this.context.decodeAudioData(bytes)
        this.buffers.set(id, buffer)
        this.trackMediaBuffer(id)
        return buffer
      } catch (error) {
        this.recordError(id, error instanceof Error ? error.message : String(error))
        return null
      } finally {
        this.bufferLoads.delete(id)
      }
    })()
    this.bufferLoads.set(id, promise)
    return promise
  }

  /**
   * Decoded music/ambience buffers are large (a minute of stereo Float32
   * is tens of MB). Keep only the active pair and a small crossover tail;
   * one-shots stay cached because they are tiny.
   */
  private trackMediaBuffer(id: AudioAssetId): void {
    const asset = getAudioAsset(id)
    if (asset.category !== 'music' && asset.category !== 'ambience') return
    this.mediaOrder = [...this.mediaOrder.filter((entry) => entry !== id), id]
    while (this.mediaOrder.length > 3) {
      const evict = this.mediaOrder.find(
        (entry) =>
          entry !== this.music?.assetId && entry !== this.ambience?.assetId,
      )
      if (!evict) break
      this.mediaOrder = this.mediaOrder.filter((entry) => entry !== evict)
      this.buffers.delete(evict)
    }
  }

  private recordError(assetId: string, message: string): void {
    this.errors.push({ assetId, message, at: Date.now() })
    if (this.errors.length > 50) this.errors.shift()
    if (import.meta.env?.DEV) {
      console.warn(`[audio] Could not load ${assetId}: ${message}`)
    }
  }

  private schedule(handler: () => void, ms: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      handler()
    }, Math.max(0, ms))
    this.timers.add(timer)
    return timer
  }
}

/** Shared singleton used by the React director and the PIP voice bridge. */
export const audioManager = new AudioManager()

// Vite HMR can replace this module while an old source is still playing.
// Close the old context so a hot audio replacement never leaves a ghost track.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    audioManager.dispose()
  })
}
