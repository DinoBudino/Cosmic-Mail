import { create } from 'zustand'
import type {
  ArchiveNarrativeCue,
  NarrativeCue,
} from '../data/missionNarrative'

export interface StoredNarrativeLine extends NarrativeCue {
  nonce: number
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
  enqueue: (cue: NarrativeCue) => boolean
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

const PRIORITY_RANK: Record<NarrativeCue['priority'], number> = {
  ambient: 0,
  hint: 1,
  mission: 2,
  discovery: 3,
  archive: 4,
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

  enqueue: (cue) => {
    const state = get()
    const once = cue.once ?? true
    if (state.current?.id === cue.id) return false
    if (state.queue.some((line) => line.id === cue.id)) return false
    if (once && state.spoken[cue.id]) return false

    const line: StoredNarrativeLine = { ...cue, nonce: nextNonce() }
    const spoken = once
      ? { ...state.spoken, [cue.id]: true as const }
      : state.spoken

    if (state.current) {
      // Higher-priority cues may move ahead of queued ambient/mission lines,
      // but a line already playing is never cut off mid-sentence.
      const queue = [...state.queue]
      const rank = PRIORITY_RANK[line.priority]
      const index = queue.findIndex(
        (queued) => PRIORITY_RANK[queued.priority] < rank,
      )
      queue.splice(index === -1 ? queue.length : index, 0, line)
      set({ queue, spoken })
    } else {
      set({ current: line, spoken })
    }
    return true
  },

  markSpoken: (id) => {
    if (get().spoken[id]) return
    set((state) => ({ spoken: { ...state.spoken, [id]: true } }))
  },

  complete: () => {
    const [next, ...rest] = get().queue
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
    })
  },
}))
