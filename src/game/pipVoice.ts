/**
 * PIP's voice: pre-recorded Kokoro TTS files (no runtime synthesis needed,
 * identical on every platform). The browser's speechSynthesis remains
 * only as a fallback for lines without a recording.
 *
 * Recordings were generated locally with Kokoro (open voices).
 * See scripts/generate-pip-voice.md to regenerate them.
 */

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

/** Display line → recording key under audio/pip/<voice>/<key><variant>.mp3. */
const AUDIO_KEYS: Readonly<Record<string, string>> = {
  'Wow! Valley of Echoes! Look, old rover tracks!': 'opportunity',
  'Hush now! Silent Plains. Listen with me!': 'insight',
  'First Flight Dunes! Whoa. The sky is so wide here.': 'ingenuity',
  'Ancient Lands. Whoa! This place feels old.': 'viking1',
  'Hi! I am PIP, your mail companion.': 'welcome',
  // Cabin ritual dialogue (src/ui/onboarding/Cabin.tsx).
  'Welcome aboard! Quick check before we fly.': 'cabin-welcome',
  'You open your eyes on a quiet night sky. What calls you first?': 'cabin-q1',
  'Something strange is under our feet.': 'cabin-q2-intro',
  'You find a tiny door on Mars that was not there before. What do you do?': 'cabin-q2',
  'Every explorer meets a tricky moment. It is okay!': 'cabin-q3-intro',
  'A storm is coming and your map is upside down. How do you feel?': 'cabin-q3',
  'Friends make every mission brighter, do not you think?': 'cabin-q4-intro',
  'A little robot is lost and cannot find its way home. What do you do?': 'cabin-q4',
  'One last light, then the stars will show us something special.': 'cabin-q5-intro',
  'At the end of the mission, what would make you smile most?': 'cabin-q5',
  'The stars have spoken...': 'cabin-reveal',
  "You and these explorers share the same Brave Explorer spirit. Which one's story feels most like yours?": 'cabin-explorer-brave',
  "You and these explorers share the same Observant Explorer spirit. Which one's story feels most like yours?": 'cabin-explorer-observant',
  "You and these explorers share the same Methodical Explorer spirit. Which one's story feels most like yours?": 'cabin-explorer-methodical',
  "You and these explorers share the same Careful Explorer spirit. Which one's story feels most like yours?": 'cabin-explorer-careful',
  "You and these explorers share the same Reflective Explorer spirit. Which one's story feels most like yours?": 'cabin-explorer-reflective',
  'Pick one special module. The others will wait for future missions!': 'cabin-module',
  "Everything is ready, but wait! Don't forget: without your name, this letter can't take off. Sign it, carrier!": 'cabin-name',
  'Your passport is ready! Tap below and choose our route, carrier.': 'cabin-passport',
  // Hub tour + route confirmation (src/ui/onboarding/Cabin.tsx).
  'This is your passport, carrier — your name, your spirit, your stamps.': 'cabin-hub-1',
  'And this green screen is navigation. Moon and Deep Space are still sleeping — Mars is ready.': 'cabin-hub-2',
  'When you are ready, tap the radar screen and choose.': 'cabin-hub-3',
  'All set, carrier! Press the red button to take off!': 'cabin-all-set',
}

export function audioKeyForLine(text: string): string | null {
  return AUDIO_KEYS[text] ?? null
}

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

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!sharedAudio) sharedAudio = new Audio()
  return sharedAudio
}

export function stopPipVoice(): void {
  playToken += 1
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
  audio.onended = null
  audio.onerror = () => {
    if (token === playToken) speakWithBrowser(fallbackText)
  }
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
export function speakPip(text: string, voiceName: string | null, enabled: boolean): void {
  if (!enabled || text.trim().length === 0) return
  stopPipVoice()

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
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1.02
    utterance.pitch = 1.18
    utterance.volume = 1
    synth.speak(utterance)
  } catch {
    // Subtitles remain.
  }
}
