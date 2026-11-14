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
  protocol: INITIAL_PROTOCOL_FLAGS,
  policy: createPolicyMemory(),
  ambientAllowed: false,

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

    if (decision.action === 'play') {
      set({ current: line, spoken, policy })
    } else if (decision.action === 'preempt') {
      // A more important line cuts in. The interrupted one comes back only
      // if it was a story beat or scan feedback; optional lines are lost.
      const interrupted = state.current
      const queue =
        interrupted && interrupted.tier <= 1
          ? [interrupted, ...state.queue]
          : state.queue
      set({ current: line, queue, spoken, policy })
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
    set({ current: next ?? null, queue: rest })
  },

  clearDialogue: () => set({ current: null, queue: [] }),

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
      protocol: INITIAL_PROTOCOL_FLAGS,
      policy: createPolicyMemory(),
      ambientAllowed: false,
    })
  },
}))
