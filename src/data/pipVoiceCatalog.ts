/**
 * Shared catalog of every recorded PIP line. The JSON file is the single
 * source of truth for the text/recording key pair, so the Kokoro generator,
 * the playback map and the mission script cannot drift apart.
 */

import RAW_LINES from './pipVoiceLines.json'

export interface PipVoiceLineRecord {
  key: string
  text: string
  speed: number
  category: string
}

export const PIP_VOICE_LINE_CATALOG: readonly PipVoiceLineRecord[] =
  RAW_LINES as PipVoiceLineRecord[]

const BY_KEY = new Map(
  PIP_VOICE_LINE_CATALOG.map((line) => [line.key, line.text] as const),
)

/**
 * Returns the recorded line for a stable key. Throwing here is deliberate:
 * a missing entry is a content bug that the voice test must catch, never a
 * silent subtitle/voice mismatch at runtime.
 */
export function pipLine(key: string): string {
  const text = BY_KEY.get(key)
  if (text === undefined) {
    throw new Error(`Missing PIP voice line: ${key}`)
  }
  return text
}

export function pipLineRecord(key: string): PipVoiceLineRecord | null {
  return PIP_VOICE_LINE_CATALOG.find((line) => line.key === key) ?? null
}
