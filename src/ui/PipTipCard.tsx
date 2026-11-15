import { useEffect } from 'react'
import { emitAudio } from '../game/audio/audioEvents'
import { useGameStore } from '../store/gameStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { PipAvatar, PipLine } from './PipSpeech'
import { isPipSpeechHidden } from './pipSpeechVisibility'

/** How often the card checks whether the child has done the tip. */
const CHECK_MS = 400

/**
 * PIP's action tips ("find the eyes up high", "take out your scanner"):
 * a big card in the middle of the bottom of the screen, where the child
 * looks, instead of the small story box in the corner. It pops in with a
 * soft chime and stays until the child does what it says. The ✕ shrinks
 * it to a small "Tip" button that brings it back; while PIP tells a story
 * it shrinks by itself so the two never cover each other.
 */
export function PipTipCard() {
  const tip = useNarrativeStore((state) => state.pinnedTip)
  const current = useNarrativeStore((state) => state.current)
  const checkTip = useNarrativeStore((state) => state.checkTip)
  const collapseTip = useNarrativeStore((state) => state.collapseTip)
  const expandTip = useNarrativeStore((state) => state.expandTip)

  const hidden = useGameStore((state) =>
    isPipSpeechHidden({
      scannerEquipped: state.scannerEquipped,
      scannerOpen: state.scannerOpen,
      scannerCardComponentId: state.scannerCardComponentId,
      scannerRecordsOpen: state.scannerRecordsOpen,
      archiveOpen: state.archiveView !== 'none',
      settingsOpen: state.settingsOpen,
      activeSiteId: state.activeSiteId,
    }),
  )

  // The tip leaves once the child has done it (or its time is up).
  const pinned = Boolean(tip)
  useEffect(() => {
    if (!pinned) return
    const timer = window.setInterval(() => checkTip(), CHECK_MS)
    return () => window.clearInterval(timer)
  }, [pinned, checkTip])

  // A soft chime for each new tip PIP gives on his own (Ask PIP answers
  // already come from a button press).
  const nonce = tip?.nonce ?? null
  const solicited = tip?.solicited ?? false
  useEffect(() => {
    if (nonce !== null && !solicited) emitAudio('pipAttention')
  }, [nonce, solicited])

  if (!tip || hidden) return null

  const speakingTip = current?.nonce === tip.nonce
  // PIP is telling something else (a part's story): the tip waits small.
  const storyPlaying = Boolean(current && !current.tip)
  const collapsed = tip.collapsed || storyPlaying

  if (collapsed) {
    return (
      <button
        type="button"
        className="pip-tip pip-tip--collapsed"
        onClick={expandTip}
        aria-label="Show PIP's tip"
      >
        <span aria-hidden="true">💡</span> Tip
      </button>
    )
  }

  return (
    <aside className="pip-tip" key={tip.nonce} aria-label="PIP's tip">
      <PipAvatar />
      <div className="pip-tip__copy">
        <div className="pip-tip__head">
          <p className="pip-tip__label">
            <span aria-hidden="true">💡</span> PIP&apos;s tip
          </p>
          <button
            type="button"
            className="pip-tip__close"
            onClick={collapseTip}
            aria-label="Hide tip"
          >
            ✕
          </button>
        </div>
        <div className="pip-tip__text">
          <PipLine
            key={tip.nonce}
            message={tip.text}
            forceFull={!speakingTip}
            onFullyTyped={noop}
          />
        </div>
      </div>
    </aside>
  )
}

function noop() {}
