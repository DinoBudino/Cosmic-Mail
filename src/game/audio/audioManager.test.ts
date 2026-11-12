import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioManager } from './audioManager'
import { DEFAULT_AUDIO_PREFERENCES } from './audioSettings'

class FakeParam {
  value = 0
  events: Array<{ type: string; value: number; time: number }> = []

  setValueAtTime(value: number, time: number): this {
    this.value = value
    this.events.push({ type: 'set', value, time })
    return this
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.value = value
    this.events.push({ type: 'linear', value, time })
    return this
  }

  cancelScheduledValues(time: number): this {
    this.events.push({ type: 'cancel', value: 0, time })
    return this
  }
}

class FakeNode {
  connected: FakeNode[] = []
  connect(node: FakeNode): FakeNode {
    this.connected.push(node)
    return node
  }
  disconnect(): void {
    this.connected = []
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam()
  knee = new FakeParam()
  ratio = new FakeParam()
  attack = new FakeParam()
  release = new FakeParam()
}

class FakeSource extends FakeNode {
  buffer: AudioBuffer | null = null
  loop = false
  loopEnd = 0
  playbackRate = new FakeParam()
  onended: (() => void) | null = null
  started = false
  stopped = false

  start(): void {
    this.started = true
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    this.onended?.()
  }
}

class FakeContext {
  state: AudioContextState = 'suspended'
  currentTime = 0
  destination = new FakeNode()
  sources: FakeSource[] = []
  decodeFails = false
  decoded = 0
  closed = false

  createGain(): FakeGain {
    return new FakeGain()
  }

  createBufferSource(): FakeSource {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }

  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor()
  }

  async decodeAudioData(): Promise<AudioBuffer> {
    this.decoded += 1
    if (this.decodeFails) throw new Error('decode failed')
    return { duration: 2 } as AudioBuffer
  }

  async resume(): Promise<void> {
    this.state = 'running'
  }

  async close(): Promise<void> {
    this.state = 'closed'
    this.closed = true
  }
}

function response(ok: boolean, status = ok ? 200 : 404): Response {
  return {
    ok,
    status,
    arrayBuffer: async () => new ArrayBuffer(16),
  } as Response
}

function harness(options: { fetchOk?: boolean; decodeFails?: boolean } = {}) {
  const context = new FakeContext()
  context.decodeFails = options.decodeFails ?? false
  let now = 1000
  const fetchImpl = vi.fn(async () =>
    response(options.fetchOk ?? true),
  ) as unknown as typeof fetch
  const manager = new AudioManager({
    createContext: () => context as unknown as AudioContext,
    fetchImpl,
    now: () => now,
  })
  return {
    manager,
    context,
    fetchImpl,
    advance: (ms: number) => {
      now += ms
    },
  }
}

async function flush(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('AudioManager', () => {
  it('waits for a user gesture before starting music', async () => {
    const { manager, context } = harness()
    await manager.playMusic('menu')
    expect(context.sources).toHaveLength(0)
    expect(manager.isUnlocked()).toBe(false)

    await manager.unlock()
    await flush()
    expect(context.state).toBe('running')
    expect(context.sources).toHaveLength(1)
    expect(context.sources[0]?.started).toBe(true)
    expect(context.sources[0]?.loop).toBe(true)
    expect(manager.getDebugState().music).toBe('music.menuAdventure')
  })

  it('does not restart the same music asset across alias cues', async () => {
    const { manager, context } = harness()
    await manager.unlock()
    await manager.playMusic('menu')
    await flush()
    await manager.playMusic('intro')
    await flush()
    expect(context.sources).toHaveLength(1)
  })

  it('crossfades to a new scene and stops the old source', async () => {
    vi.useFakeTimers()
    const { manager, context } = harness()
    await manager.unlock()
    await manager.playMusic('menu')
    await flush()
    await manager.playMusic('cabin')
    await flush()

    expect(context.sources).toHaveLength(2)
    expect(manager.getDebugState().music).toBe('music.cabin')
    expect(context.sources[0]?.stopped).toBe(false)
    vi.advanceTimersByTime(2500)
    expect(context.sources[0]?.stopped).toBe(true)
  })

  it('applies independent channel volumes and mute immediately', async () => {
    const { manager } = harness()
    await manager.unlock()
    manager.setVolumes({
      masterVolume: 0.8,
      musicVolume: 0.5,
      ambienceVolume: 0.4,
      sfxVolume: 0.7,
      voiceVolume: 0.9,
      muted: false,
    })
    const levels = manager.getMixerLevels()
    expect(levels.master).toBeCloseTo(0.8)
    expect(levels.music).toBeCloseTo(0.4)
    expect(levels.ambience).toBeCloseTo(0.32)
    expect(levels.sfx).toBeCloseTo(0.56)
    expect(levels.voice).toBeCloseTo(0.72)

    manager.setVolumes({ muted: true })
    expect(manager.getMixerLevels().master).toBe(0)
    expect(manager.getMixerLevels().music).toBe(0)
    expect(manager.getEffectiveVoiceVolume()).toBe(0)
  })

  it('ducks the music bed while PIP speaks and restores it after the line', async () => {
    vi.useFakeTimers()
    const { manager } = harness()
    await manager.unlock()
    manager.setVolumes({
      masterVolume: 1,
      musicVolume: 1,
      ambienceVolume: 1,
      sfxVolume: 1,
      voiceVolume: 1,
      muted: false,
    })
    const before = manager.getMixerLevels().duck
    manager.beginVoice(800)
    const during = manager.getMixerLevels().duck
    expect(during).toBeLessThan(before)
    vi.advanceTimersByTime(1200)
    expect(manager.getMixerLevels().duck).toBe(1)
  })

  it('plays one-shot effects once inside the duplicate window', async () => {
    const { manager, context, advance } = harness()
    await manager.unlock()
    manager.playSfx('ui.clickLow')
    await flush()
    manager.playSfx('ui.clickLow')
    await flush()
    expect(context.sources).toHaveLength(1)

    advance(100)
    manager.playSfx('ui.clickLow')
    await flush()
    expect(context.sources).toHaveLength(2)
  })

  it('starts and stops loops without stacking duplicates', async () => {
    vi.useFakeTimers()
    const { manager, context } = harness()
    await manager.unlock()
    manager.startLoop('scanner', 'scanner.loop')
    await flush()
    manager.startLoop('scanner', 'scanner.loop')
    await flush()
    expect(context.sources).toHaveLength(1)
    expect(manager.getDebugState().loops).toEqual(['scanner'])

    manager.stopLoop('scanner')
    vi.advanceTimersByTime(300)
    expect(context.sources[0]?.stopped).toBe(true)
    expect(manager.getDebugState().loops).toEqual([])
  })

  it('reports a missing file without throwing or playing stale audio', async () => {
    const { manager, context } = harness({ fetchOk: false })
    await manager.unlock()
    manager.playSfx('ui.confirm')
    await flush()
    expect(context.sources).toHaveLength(0)
    expect(manager.getLoadErrors().some((error) => error.assetId === 'ui.confirm')).toBe(
      true,
    )
  })

  it('reports a decode failure without breaking later requests', async () => {
    const { manager, context } = harness({ decodeFails: true })
    await manager.unlock()
    manager.playSfx('ui.confirm')
    await flush()
    expect(context.sources).toHaveLength(0)
    expect(manager.getLoadErrors()[0]?.message).toContain('decode failed')
  })

  it('stops every bed and closes the context on dispose', async () => {
    const { manager, context } = harness()
    await manager.unlock()
    await manager.playMusic('menu')
    await manager.playAmbience('marsWind')
    manager.startLoop('scanner', 'scanner.loop')
    await flush()
    manager.dispose()
    expect(context.closed).toBe(true)
    expect(manager.getDebugState().music).toBeNull()
    expect(manager.getDebugState().loops).toEqual([])
  })

  it('ducks the scanner bed under PIP without muting critical one-shots', async () => {
    vi.useFakeTimers()
    const { manager, context } = harness()
    await manager.unlock()
    manager.startLoop('scanner', 'scanner.loop')
    await flush()
    const loopGain = context.sources[0]?.connected[0] as FakeGain | undefined
    const before = loopGain?.gain.value ?? 0
    manager.beginVoice(800)
    expect(loopGain?.gain.value ?? 0).toBeLessThan(before)
    vi.advanceTimersByTime(1200)
    expect(loopGain?.gain.value ?? 0).toBeGreaterThan(0)
    expect(loopGain?.gain.value ?? 0).toBeCloseTo(before)
  })

  it('keeps the HTML voice level independent from the music duck', async () => {
    const { manager } = harness()
    await manager.unlock()
    manager.setVolumes({
      masterVolume: 0.6,
      voiceVolume: 0.5,
      musicVolume: 1,
      muted: false,
    })
    manager.beginVoice(1000)
    expect(manager.getEffectiveVoiceVolume()).toBeCloseTo(0.3)
  })

  it('starts with conservative defaults', () => {
    const { manager } = harness()
    expect(manager.getPreferences()).toEqual(DEFAULT_AUDIO_PREFERENCES)
  })

  it('stays silent and safe when AudioContext is unavailable', async () => {
    const manager = new AudioManager({
      createContext: () => null,
      fetchImpl: null,
    })
    await expect(manager.playMusic('menu')).resolves.toBeUndefined()
    expect(() => manager.playSfx('ui.clickLow')).not.toThrow()
    expect(() => manager.startLoop('scanner', 'scanner.loop')).not.toThrow()
    expect(() => manager.setVolumes({ muted: true })).not.toThrow()
    expect(() => manager.dispose()).not.toThrow()
  })
})
