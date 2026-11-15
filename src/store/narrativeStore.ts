import { create } from 'zustand'
import {
  createPolicyMemory,
  decideCue,
  fitLine,
  rememberCue,
  tierForPriority,
  type PipTier,
  type PolicyMemory,
} from '../data/pipDialogPolicy'
import {
  INITIAL_PROTOCOL_FLAGS,
  type ProtocolFlags,
} from '../data/arrivalProtocol'
import type {
  ArchiveNarrativeCue,
  NarrativeCue,
} from '../data/missionNarrative'

export interface StoredNarrativeLine extends NarrativeCue {
  nonce: number
  /** Resolved dialogue tier (explicit or derived from priority). */
  tier: PipTier
}

/** PIP's action tip, pinned on screen until the child has done it. */
export interface PinnedTip {
  id: string
  text: string
  /** Nonce of the line that pinned it (the card types it while it plays). */
  nonce: number
  doneWhen?: () => boolean
  /** Tips without `doneWhen` leave after a while (epoch ms), else null. */
  expiresAt: number | null
  /** Shrunk to the small "Tip" button by the child. */
  collapsed: boolean
  /** The child asked for it (Ask PIP): no attention chime. */
  solicited: boolean
}

/** A tip with nothing to wait for stays this long. */
export const TIP_DEFAULT_TTL_MS = 20_000

/** The pinned tip for a line that starts playing (or the previous one). */
function pinFor(
  line: StoredNarrativeLine | null | undefined,
  previous: PinnedTip | null,
  now: number,
): PinnedTip | null {
  if (!line?.tip) return previous
  if (line.tip.doneWhen?.()) return previous
  const ttl = line.tip.doneWhen ? line.tip.ttlMs : (line.tip.ttlMs ?? TIP_DEFAULT_TTL_MS)
  return {
    id: line.id,
    text: line.text,
    nonce: line.nonce,
    doneWhen: line.tip.doneWhen,
    expiresAt: ttl === undefined ? null : now + ttl,
    collapsed: false,
    solicited: line.solicited ?? false,
  }
}

export interface NarrativeArchiveLine extends ArchiveNarrativeCue {
  nonce: number
}

export type NarrativeReactionKind =
  | 'detect'
  | 'approach'
  | 'scan'
  | 'hint'
  | 'archive'
  | 'celebrate'

export interface NarrativeReaction {
  kind: NarrativeReactionKind
  componentId?: string
  until: number
  nonce: number
}

export interface NarrativeAttention {
  componentId: string
  kind: 'hint' | 'scan'
  until: number
  nonce: number
}

interface NarrativeState {
  current: StoredNarrativeLine | null
  queue: StoredNarrativeLine[]
  /** Cues already played (or queued) this Mars visit. */
  spoken: Record<string, true>
  reaction: NarrativeReaction | null
  attention: NarrativeAttention | null
  archiveLine: NarrativeArchiveLine | null
  /** The action tip on screen (tip card), independent of the voice queue. */
  pinnedTip: PinnedTip | null
  /** Closes the tip card once its task is done or its time is up. */
  checkTip: (now?: number) => void
  collapseTip: () => void
  expandTip: () => void
  clearTip: () => void
  /** Ephemeral arrival-protocol facts; progress itself stays in journeyStore. */
  protocol: ProtocolFlags
  markProtocol: (flag: keyof ProtocolFlags) => void
  /**
   * Single entry point for every PIP line. Applies the central dialogue
   * policy (tiers, one voice at a time, frequency, anti-repetition, limits).
   */
  enqueue: (cue: NarrativeCue, now?: number) => boolean
  /** Cancels the playing line if the player already moved past it. */
  dropStaleCurrent: () => void
  policy: PolicyMemory
  /** P3 ambient lines are dropped unless free exploration is on (M7). */
  ambientAllowed: boolean
  setAmbientAllowed: (allowed: boolean) => void
  markSpoken: (id: string) => void
  complete: () => void
  clearDialogue: () => void
  react: (
    kind: NarrativeReactionKind,
    componentId?: string,
    durationMs?: number,
  ) => void
  showAttention: (
    componentId: string,
    kind: 'hint' | 'scan',
    durationMs?: number,
  ) => void
  clearAttention: () => void
  setArchiveLine: (cue: ArchiveNarrativeCue | null) => void
  reset: () => void
}

let nonceCounter = 0
function nextNonce(): number {
  nonceCounter += 1
  return nonceCounter
}

let attentionTimer: ReturnType<typeof setTimeout> | null = null

function clearAttentionTimer(): void {
  if (attentionTimer !== null) {
    clearTimeout(attentionTimer)
    attentionTimer = null
  }
}

export const useNarrativeStore = create<NarrativeState>((set, get) => ({
  current: null,
  queue: [],
  spoken: {},
  reaction: null,
  attention: null,
  archiveLine: null,
  pinnedTip: null,
  protocol: INITIAL_PROTOCOL_FLAGS,
  policy: createPolicyMemory(),
  ambientAllowed: false,

  checkTip: (now = Date.now()) => {
    const tip = get().pinnedTip
    if (!tip) return
    if (tip.doneWhen?.() || (tip.expiresAt !== null && now >= tip.expiresAt)) {
      set({ pinnedTip: null })
    }
  },

  collapseTip: () => {
    const tip = get().pinnedTip
    if (tip && !tip.collapsed) set({ pinnedTip: { ...tip, collapsed: true } })
  },

  expandTip: () => {
    const tip = get().pinnedTip
    if (tip?.collapsed) set({ pinnedTip: { ...tip, collapsed: false } })
  },

  clearTip: () => set({ pinnedTip: null }),

  setAmbientAllowed: (ambientAllowed) => {
    if (get().ambientAllowed !== ambientAllowed) set({ ambientAllowed })
  },

  markProtocol: (flag) => {
    if (get().protocol[flag]) return
    set((state) => ({ protocol: { ...state.protocol, [flag]: true } }))
  },

  enqueue: (cue, now = Date.now()) => {
    const state = get()
    const once = cue.once ?? true
    if (state.current?.id === cue.id) return false
    if (state.queue.some((line) => line.id === cue.id)) return false
    if (once && state.spoken[cue.id]) return false

    const text = fitLine(cue.text)
    const tier = cue.tier ?? tierForPriority(cue.priority)
    const policyCue = { text, tier, solicited: cue.solicited ?? false }
    const decision = decideCue(
      state.policy,
      state.current ? { tier: state.current.tier } : null,
      state.queue.length,
      policyCue,
      now,
      state.ambientAllowed,
    )
    if (decision.action === 'drop') return false

    const line: StoredNarrativeLine = {
      ...cue,
      text,
      tier,
      nonce: nextNonce(),
    }
    const spoken = once
      ? { ...state.spoken, [cue.id]: true as const }
      : state.spoken
    const policy = rememberCue(state.policy, policyCue, now)

    const pinnedTip = pinFor(line, state.pinnedTip, now)
    if (decision.action === 'play') {
      set({ current: line, spoken, policy, pinnedTip })
    } else if (decision.action === 'preempt') {
      // A more important line cuts in. The interrupted one comes back only
      // if it was a story beat or scan feedback; optional lines are lost.
      const interrupted = state.current
      const queue =
        interrupted && interrupted.tier <= 1
          ? [interrupted, ...state.queue]
          : state.queue
      set({ current: line, queue, spoken, policy, pinnedTip })
    } else {
      const queue = [...state.queue]
      const index = queue.findIndex((queued) => queued.tier > tier)
      queue.splice(index === -1 ? queue.length : index, 0, line)
      set({ queue, spoken, policy })
    }
    return true
  },

  dropStaleCurrent: () => {
    if (get().current?.cancelWhen?.()) get().complete()
  },

  markSpoken: (id) => {
    if (get().spoken[id]) return
    set((state) => ({ spoken: { ...state.spoken, [id]: true } }))
  },

  complete: () => {
    // Skip queued lines the player has already moved past.
    let pending = get().queue
    while (pending.length > 0 && pending[0]!.cancelWhen?.()) {
      pending = pending.slice(1)
    }
    const [next, ...rest] = pending
    set({
      current: next ?? null,
      queue: rest,
      pinnedTip: pinFor(next, get().pinnedTip, Date.now()),
    })
  },

  clearDialogue: () => set({ current: null, queue: [], pinnedTip: null }),

  react: (kind, componentId, durationMs = 1800) => {
    set({
      reaction: {
        kind,
        componentId,
        until: Date.now() + durationMs,
        nonce: nextNonce(),
      },
    })
  },

  showAttention: (componentId, kind, durationMs = 2600) => {
    clearAttentionTimer()
    const attention: NarrativeAttention = {
      componentId,
      kind,
      until: Date.now() + durationMs,
      nonce: nextNonce(),
    }
    set({ attention })

    if (typeof setTimeout !== 'undefined' && durationMs > 0) {
      attentionTimer = setTimeout(() => {
        attentionTimer = null
        const current = get().attention
        if (current?.nonce === attention.nonce) set({ attention: null })
      }, durationMs)
    }
  },

  clearAttention: () => {
    clearAttentionTimer()
    set({ attention: null })
  },

  setArchiveLine: (cue) => {
    set({
      archiveLine: cue
        ? { ...cue, nonce: nextNonce() }
        : null,
    })
  },

  reset: () => {
    clearAttentionTimer()
    set({
      current: null,
      queue: [],
      spoken: {},
      reaction: null,
      attention: null,
      archiveLine: null,
      pinnedTip: null,
      protocol: INITIAL_PROTOCOL_FLAGS,
      policy: createPolicyMemory(),
      ambientAllowed: false,
    })
  },
}))
