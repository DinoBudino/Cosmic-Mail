/**
 * Central dialogue policy for PIP. Pure rules, no React and no store: the
 * narrative store applies them at the single point every line goes through.
 *
 * Tiers (0 is the most important):
 *  P0  protocol steps and answers to "Ask PIP"
 *  P1  mission scan feedback and story beats
 *  P2  distractor notes and voluntary hints
 *  P3  ambient and environmental comments (free exploration only)
 *
 * Channels (so nothing says the same thing twice):
 *  reticle = the label of what is targeted
 *  panel   = state and the instruction of the moment
 *  PIP     = narrative, never a restatement of the panel
 */

import type { NarrativePriority } from './missionNarrative'

export type PipTier = 0 | 1 | 2 | 3

/** The brief says "~140"; 150 leaves room for the longest recorded line. */
export const MAX_LINE_CHARS = 150
export const MAX_SENTENCES = 2
export const MAX_ENV_WORDS = 15
/** Minimum gap between unsolicited lines of tier 2 or 3. */
export const UNSOLICITED_GAP_MS = 15_000
/** The same line is not repeated inside this window (unless asked for). */
export const REPEAT_WINDOW_MS = 25_000
/** Forget repeat memory older than this. */
const MEMORY_KEEP_MS = 120_000

export function tierForPriority(priority: NarrativePriority): PipTier {
  switch (priority) {
    case 'archive':
      return 0
    case 'discovery':
    case 'mission':
      return 1
    case 'hint':
      return 2
    case 'ambient':
      return 3
  }
}

export function countSentences(text: string): number {
  const matches = text.trim().match(/[^.!?…]+[.!?…]*/g) ?? []
  return matches.filter((part) => /\w/.test(part)).length
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function lineProblems(text: string): string[] {
  const problems: string[] = []
  if (text.length > MAX_LINE_CHARS) problems.push('too-long')
  if (countSentences(text) > MAX_SENTENCES) problems.push('too-many-sentences')
  return problems
}

/**
 * Last-resort fit for a line that breaks the limits: keep the first
 * sentences that fit, never cutting a word in half. Content should be fixed
 * at the source; this only keeps the UI from ever showing a wall of text.
 */
export function fitLine(text: string): string {
  if (lineProblems(text).length === 0) return text
  const parts = text.trim().match(/[^.!?…]+[.!?…]*\s*/g) ?? [text]
  let result = ''
  for (const part of parts.slice(0, MAX_SENTENCES)) {
    if ((result + part).trim().length > MAX_LINE_CHARS) break
    result += part
  }
  result = result.trim()
  if (result.length > 0) return result
  const cut = text.slice(0, MAX_LINE_CHARS - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export interface PolicyMemory {
  lastUnsolicitedAt: number | null
  recent: Readonly<Record<string, number>>
}

export function createPolicyMemory(): PolicyMemory {
  return { lastUnsolicitedAt: null, recent: {} }
}

export interface PolicyCue {
  text: string
  tier: PipTier
  /** The player asked for it (Ask PIP) or caused it directly. */
  solicited: boolean
}

/** Ambient (P3) comments exist only in free exploration. */
export function isAmbientBlocked(
  cue: PolicyCue,
  ambientAllowed: boolean,
): boolean {
  return cue.tier === 3 && !ambientAllowed
}

export interface PolicyCurrent {
  tier: PipTier
}

export type PolicyAction = 'play' | 'queue' | 'preempt' | 'drop'

export interface PolicyDecision {
  action: PolicyAction
  reason?: 'repeat' | 'gap' | 'busy' | 'ambient-locked'
}

export function isUnsolicitedLowTier(cue: PolicyCue): boolean {
  return !cue.solicited && cue.tier >= 2
}

export function decideCue(
  memory: PolicyMemory,
  current: PolicyCurrent | null,
  queueLength: number,
  cue: PolicyCue,
  now: number,
  ambientAllowed = true,
): PolicyDecision {
  // 0. Ambient comments only exist in free exploration (P3, step M7).
  if (isAmbientBlocked(cue, ambientAllowed)) {
    return { action: 'drop', reason: 'ambient-locked' }
  }

  // 1. Anti-repetition. A line the player asked for may be asked again.
  if (!cue.solicited) {
    const last = memory.recent[cue.text]
    if (last !== undefined && now - last < REPEAT_WINDOW_MS) {
      return { action: 'drop', reason: 'repeat' }
    }
  }

  // 2. Frequency: at most one unsolicited low-tier line per gap.
  if (
    isUnsolicitedLowTier(cue) &&
    memory.lastUnsolicitedAt !== null &&
    now - memory.lastUnsolicitedAt < UNSOLICITED_GAP_MS
  ) {
    return { action: 'drop', reason: 'gap' }
  }

  // 3. One voice at a time.
  const busy = current !== null || queueLength > 0
  if (!busy) return { action: 'play' }
  if (current && cue.tier < current.tier) return { action: 'preempt' }
  // Optional lines are dropped, never accumulated.
  if (cue.tier >= 2) return { action: 'drop', reason: 'busy' }
  return { action: 'queue' }
}

export function rememberCue(
  memory: PolicyMemory,
  cue: PolicyCue,
  now: number,
): PolicyMemory {
  const recent: Record<string, number> = {}
  for (const [text, at] of Object.entries(memory.recent)) {
    if (now - at < MEMORY_KEEP_MS) recent[text] = at
  }
  recent[cue.text] = now
  return {
    lastUnsolicitedAt: isUnsolicitedLowTier(cue)
      ? now
      : memory.lastUnsolicitedAt,
    recent,
  }
}
