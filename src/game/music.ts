/**
 * Cabin ambience music: one looping track for the whole initial phase
 * (title screen through the name signing). It stops when the adventure
 * (the 3D world) starts. Volume is user-controlled in Settings and
 * persisted with the other settings.
 */

const MUSIC_URL = 'audio/music/cabin-ambience.mp3'

let audio: HTMLAudioElement | null = null
let wantPlaying = false

function getAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!audio) {
    audio = new Audio(MUSIC_URL)
    audio.loop = true
    audio.preload = 'auto'
  }
  return audio
}

/** Start (or resume) the loop if the caller wants it playing. */
export function startMusic(volume: number): void {
  wantPlaying = true
  const element = getAudio()
  if (!element) return
  element.volume = volume
  if (!element.paused) return
  element.play().catch(() => {
    // Autoplay policies: the next user gesture retries via unlockMusic().
  })
}

/** Stop the loop (adventure started, or music muted to zero). */
export function stopMusic(): void {
  wantPlaying = false
  if (audio && !audio.paused) audio.pause()
}

/** Live volume update from Settings (0..1). */
export function setMusicVolume(volume: number): void {
  const element = getAudio()
  if (element) element.volume = volume
  if (volume <= 0) stopMusic()
  else if (wantPlaying) startMusic(volume)
}

/**
 * Call from a user-gesture handler (click/keydown) so browsers with
 * autoplay policies allow the loop to start on the first interaction.
 */
export function unlockMusic(volume: number): void {
  if (wantPlaying) startMusic(volume)
}

/* ------------------------------------------------------------ Nav SFX */

let audioContext: AudioContext | null = null

/**
 * Tiny synthesized menu tick (no audio files): a soft sine blip for
 * moving the selection, a slightly warmer one for confirming.
 * Amplitude follows the persisted music volume; silent at zero.
 * Call only from user gestures (click / keydown).
 */
export function playNavSound(kind: 'move' | 'confirm', volume: number): void {
  if (volume <= 0) return
  try {
    const AudioCtor: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!AudioCtor) return
    audioContext ??= new AudioCtor()
    if (audioContext.state === 'suspended') void audioContext.resume()
    const now = audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = kind === 'confirm' ? 880 : 620
    const peak = kind === 'confirm' ? 0.09 : 0.05
    const length = kind === 'confirm' ? 0.14 : 0.07
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(peak * volume, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + length + 0.02)
  } catch {
    // Audio unavailable (autoplay policy, no device…): stay silent.
  }
}
