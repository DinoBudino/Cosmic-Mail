/**
 * PIP's voice: pre-recorded Kokoro TTS files (no runtime synthesis needed,
 * identical on every platform). The browser's speechSynthesis remains
 * only as a fallback for lines without a recording.
 *
 * Recordings were generated locally with Kokoro (open voices).
 * See scripts/generate-pip-voice.md to regenerate them.
 */

import PIP_VOICE_LINES from '../data/pipVoiceLines.json'

import { audioManager } from './audio/audioManager'
import { estimateVoiceDurationMs } from './audio/audioMath'

export interface RecordedVoice {
  id: string
  label: string
}

export const PIP_VOICES: readonly RecordedVoice[] = [
  { id: 'heart', label: 'Heart (US, female)' },
  { id: 'sky', label: 'Sky (US, female)' },
  { id: 'lily', label: 'Lily (UK, female)' },
  { id: 'michael', label: 'Michael (US, male)' },
]

const DEFAULT_VOICE = 'heart'

/** Resolves a stored voice id ('heart' | 'lily' | 'michael') with fallback. */
export function resolveVoiceId(name: string | null): string {
  return PIP_VOICES.some((voice) => voice.id === name) ? name! : DEFAULT_VOICE
}

/**
 * Recorded onboarding/cabin/launch lines. The source of truth is shared
 * with scripts/generate-pip-voice.py, so the text and the generated key
 * cannot drift apart. `af_heart` natural is the selected default voice.
 */
export const ONBOARDING_VOICE_LINES = PIP_VOICE_LINES

const ONBOARDING_AUDIO_KEYS: Record<string, string> = Object.fromEntries(
  PIP_VOICE_LINES.map((line) => [line.text, line.key]),
)

/** Display line → recording key under audio/pip/<voice>/<key><variant>.mp3. */
const AUDIO_KEYS: Readonly<Record<string, string>> = {
  // Mars landmark orientation lines (src/data/marsObjects.ts).
  'Wow! Valley of Echoes! Look, old rover tracks!': 'opportunity',
  'Hush now! Silent Plains. Listen with me!': 'insight',
  'First Flight Dunes! Whoa. The sky is so wide here.': 'ingenuity',
  'Ancient Lands. Whoa! This place feels old.': 'viking1',
  ...ONBOARDING_AUDIO_KEYS,
}

export function audioKeyForLine(text: string): string | null {
  return AUDIO_KEYS[text] ?? null
}

/**
 * Lines that are intentionally subtitle-only: they have no recording
 * yet, so PIP must stay silent (never fall back to browser TTS or to
 * another character's take). The new onboarding script is not listed
 * here: unknown lines use the controlled browser-TTS fallback below.
 */
export const SUBTITLE_ONLY_LINES: ReadonlySet<string> = new Set<string>([])

function audioUrl(key: string, voiceId: string, variant: 1 | 2): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base}audio/pip/${voiceId}/${key}${variant}.mp3`
}

function chirpUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base}audio/pip/chirp.mp3`
}

/**
 * ONE shared <audio> element for every PIP sound (chirp and lines).
 * Creating a fresh element per call let pending play() promises from
 * an already-paused element start anyway — the "double audio" bug.
 * A single element serializes playback: stopping it really stops it,
 * and StrictMode double-mounts simply restart the same element.
 */
let sharedAudio: HTMLAudioElement | null = null
/** Monotonic token: only the latest speakPip call may play its line. */
let playToken = 0
/** Same protection for the browser-TTS fallback utterances. */
let browserToken = 0
/** Subtitle UI subscribes so a long line advances when the voice ends. */
const voiceEndListeners = new Set<() => void>()

export function onPipVoiceEnded(listener: () => void): () => void {
  voiceEndListeners.add(listener)
  return () => voiceEndListeners.delete(listener)
}

function notifyVoiceEnded(): void {
  for (const listener of [...voiceEndListeners]) listener()
}

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!sharedAudio) sharedAudio = new Audio()
  return sharedAudio
}

/**
 * Kokoro has no direct emotion parameter, so the recorded take carries the
 * performance. This tiny gain trim is the only runtime treatment: it keeps
 * the same voice identity while giving celebrations a little lift and
 * concern a softer edge.
 */
const EMOTION_VOICE_GAIN: Readonly<Record<string, number>> = {
  excited: 1.04,
  celebrating: 1.05,
  hopeful: 1.01,
  surprised: 1.02,
  concerned: 0.97,
  focused: 1,
  curious: 1,
}

let currentEmotionGain = 1

function emotionGain(emotion: string | null | undefined): number {
  return emotion ? (EMOTION_VOICE_GAIN[emotion] ?? 1) : 1
}

function effectiveVoiceVolume(): number {
  return Math.min(
    1,
    audioManager.getEffectiveVoiceVolume() * currentEmotionGain,
  )
}

/** Live master/voice changes must reach the current HTMLAudioElement. */
export function applyPipVoiceVolume(): void {
  if (!sharedAudio) return
  sharedAudio.volume = effectiveVoiceVolume()
}

export function stopPipVoice(): void {
  playToken += 1
  browserToken += 1
  currentEmotionGain = 1
  audioManager.endVoice()
  if (sharedAudio) {
    sharedAudio.pause()
    sharedAudio.removeAttribute('src')
    sharedAudio.load()
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // Ignore — nothing playing.
    }
  }
}

/** Plays one file on the shared element; failure falls back to browser TTS. */
function playFile(url: string, fallbackText: string, token: number): void {
  if (token !== playToken) return
  const audio = getSharedAudio()
  if (!audio) {
    speakWithBrowser(fallbackText)
    return
  }
  audio.onended = () => {
    if (token === playToken) {
      audioManager.endVoice()
      notifyVoiceEnded()
    }
  }
  audio.onerror = () => {
    if (token === playToken) speakWithBrowser(fallbackText)
  }
  audio.volume = effectiveVoiceVolume()
  audio.src = url
  audio.currentTime = 0
  audio.play().catch((error: unknown) => {
    // AbortError means a newer request already replaced this one —
    // falling back to TTS here would double the voice. Ignore it.
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (token === playToken) speakWithBrowser(fallbackText)
  })
}

/**
 * Plays PIP's recorded line (random take + robot chirp first), falling
 * back to browser TTS when no recording exists. `voiceName` is a
 * recorded-voice id ('heart', …).
 */
export function speakPip(
  text: string,
  voiceName: string | null,
  enabled: boolean,
  emotion?: string | null,
): void {
  if (!enabled || text.trim().length === 0) return
  // Subtitle-only lines: stay silent instead of playing stale audio.
  if (SUBTITLE_ONLY_LINES.size > 0 && SUBTITLE_ONLY_LINES.has(text)) return
  stopPipVoice()
  currentEmotionGain = emotionGain(emotion)
  audioManager.beginVoice(estimateVoiceDurationMs(text) + 700)

  const key = audioKeyForLine(text)
  if (key) {
    const voiceId = resolveVoiceId(voiceName)
    const variant: 1 | 2 = Math.random() < 0.5 ? 1 : 2
    const token = ++playToken
    const audio = getSharedAudio()
    if (!audio) {
      speakWithBrowser(text)
      return
    }
    // Two-note robot chirp, then the line — like a cartoon announcer.
    audio.onended = () => {
      if (token === playToken) playFile(audioUrl(key, voiceId, variant), text, token)
    }
    audio.onerror = () => {
      if (token === playToken) playFile(audioUrl(key, voiceId, variant), text, token)
    }
    audio.volume = effectiveVoiceVolume()
    audio.src = chirpUrl()
    audio.currentTime = 0
    audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (token === playToken) playFile(audioUrl(key, voiceId, variant), text, token)
    })
    return
  }
  speakWithBrowser(text)
}

/** Fallback only: browser TTS for lines without a recording. */
function speakWithBrowser(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    const synth = window.speechSynthesis
    if (synth.speaking || synth.pending) synth.cancel()
    const token = ++browserToken
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1.02
    utterance.pitch = 1.18
    utterance.volume = effectiveVoiceVolume()
    utterance.onend = () => {
      if (token !== browserToken) return
      audioManager.endVoice()
      notifyVoiceEnded()
    }
    utterance.onerror = () => {
      // A cancelled/stale utterance must never advance the subtitle queue.
      if (token !== browserToken) return
      audioManager.endVoice()
    }
    synth.speak(utterance)
  } catch {
    // Subtitles remain.
  }
}
