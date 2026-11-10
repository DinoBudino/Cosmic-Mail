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
  // Cinematic intro (INTRO_LINES in personalization.ts), spoken by
  // Intro.tsx as each subtitle appears.
  "Hi! I'm PIP, your cabin buddy. Welcome aboard Cosmic Mail!": 'cabin-intro-1',
  'Long ago, explorers traveled to the Moon, Mars, and far beyond.': 'cabin-intro-2',
  "They were machines, sent to discover things humans couldn't see.": 'cabin-intro-3',
  'Some of their missions have ended.': 'cabin-intro-4',
  'But their stories are still out there, waiting to be remembered.': 'cabin-intro-5',
  "That's where you come in!": 'cabin-intro-6',
  "You'll travel across space and deliver letters to these forgotten explorers. Will you help me?": 'cabin-intro-8',
  'Every explorer sees the universe in a different way.': 'cabin-intro-9',
  "Before we begin, let's discover your explorer spirit.": 'cabin-intro-10',
  // Cabin ritual dialogue (src/ui/onboarding/Cabin.tsx).
  'Welcome aboard! Quick check before we fly.': 'cabin-welcome',
  'You open your eyes on a quiet night sky. What calls you first?': 'cabin-q1',
  'Something strange is under our feet.': 'cabin-q2-intro',
  'You find a tiny door on Mars that was not there before. What do you do?': 'cabin-q2',
  'Friends make every mission brighter, do not you think?': 'cabin-q4-intro',
  'A little robot is lost and cannot find its way home. What do you do?': 'cabin-q4',
  'One last light, then the stars will show us something special.': 'cabin-q5-intro',
  'At the end of the mission, what would make you smile most?': 'cabin-q5',
  'The stars have spoken...': 'cabin-reveal',
  // Explorer step: history first, then the power it inspires. Each
  // hero has both lines recorded (the line follows the visible hero).
  'Sally Ride became the first American woman in space in 1983.': 'cabin-hero-sally-story',
  'Her courage inspires Second Chance: make one mistake without starting over!': 'cabin-hero-sally-power',
  'Mae Jemison traveled into space in 1992. She was both a scientist and an astronaut.': 'cabin-hero-mae-story',
  'Her curiosity inspires Explorer Vision: reveal important clues!': 'cabin-hero-mae-power',
  'Katherine Johnson used mathematics to calculate important spaceflight paths.': 'cabin-hero-katherine-story',
  'Her careful math inspires Mission Plan: follow clear steps to solve challenges!': 'cabin-hero-katherine-power',
  'Margaret Hamilton led a team that developed software for the Apollo missions.': 'cabin-hero-margaret-story',
  'Her attention to detail inspires Safety Check: spot a possible mistake before acting!': 'cabin-hero-margaret-power',
  'Carl Sagan studied planets and inspired people to explore big questions about the universe.': 'cabin-hero-carl-story',
  'His curiosity inspires Time to Think: slow down danger and pause to decide!': 'cabin-hero-carl-power',
  'One last thing, carrier! Every letter needs a name. What should I call you?': 'cabin-name',
  // Hub tour + route confirmation (src/ui/onboarding/Cabin.tsx).
  'Look, carrier — your Cosmic Mail passport is ready!': 'cabin-hub-0',
  'It holds your name, your power, your hero and your stamps.': 'cabin-hub-1',
  // Launch: archive damage warning (src/ui/onboarding/LaunchSequence.tsx).
  'Warning! My hero archive took a hit entering Mars. I only remember your current hero — the others are lost as memory fragments near the silent machines!': 'cabin-launch-memory',
  // Restored hero memories, spoken when a fragment is recovered
  // (src/ui/SiteInteraction.tsx, hero.memoryLine).
  'I became the first American woman in space in 1983.': 'cabin-memory-sally',
  'I traveled into space in 1992 and studied how bodies behave in zero gravity.': 'cabin-memory-mae',
  'My careful calculations helped astronauts travel safely.': 'cabin-memory-katherine',
  'I led a team that wrote software for the Apollo missions.': 'cabin-memory-margaret',
  'I helped people ask big questions about the universe.': 'cabin-memory-carl',
  'And this green screen is navigation. Moon and Deep Space are still sleeping — Mars is ready.': 'cabin-hub-2',
  'When you land, find the silent machines and deliver their letters. When you are ready, tap the radar screen and choose.': 'cabin-hub-3',
  'Which explorer feels like you?': 'cabin-explorer-fallback',
  'All set, carrier! Press the red button to take off!': 'cabin-all-set',
}

export function audioKeyForLine(text: string): string | null {
  return AUDIO_KEYS[text] ?? null
}

/**
 * Lines that are intentionally subtitle-only: they have no recording
 * yet, so PIP must stay silent (never fall back to browser TTS or to
 * another character's take). Empty right now — every static line has
 * a Kokoro recording. Dynamic lines (the player's name) are never
 * routed through speakPip.
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
  // Subtitle-only lines: stay silent instead of playing stale audio.
  if (SUBTITLE_ONLY_LINES.size > 0 && SUBTITLE_ONLY_LINES.has(text)) return
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
