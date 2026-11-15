import { useEffect, useState, type CSSProperties } from 'react'
import { useGameStore, type ScanCelebration } from '../store/gameStore'

/** How long the card stays before it flies to the album. */
const SHOW_MS = 3800
const LEAVE_MS = 620

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2
  const distance = 54 + (i % 3) * 14
  return {
    '--dx': `${Math.round(Math.cos(angle) * distance)}px`,
    '--dy': `${Math.round(Math.sin(angle) * distance)}px`,
    animationDelay: `${(i % 4) * 40}ms`,
  } as CSSProperties
})

function RewardIcon({ celebration }: { celebration: ScanCelebration }) {
  const common = {
    viewBox: '0 0 40 40',
    fill: 'none',
    stroke: '#2b1a14',
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (celebration.verb === 'Looks') {
    return (
      <svg {...common}>
        <path d="M4 20c4-7 10-11 16-11s12 4 16 11c-4 7-10 11-16 11S8 27 4 20z" />
        <circle cx="20" cy="20" r="5" fill="#2b1a14" />
      </svg>
    )
  }
  if (celebration.verb === 'Touches') {
    return (
      <svg {...common}>
        <path d="M14 22V9a3 3 0 0 1 6 0v10M20 18v-3a3 3 0 0 1 6 0v6M26 20a3 3 0 0 1 6 0v6c0 6-5 10-11 10h-1c-4 0-7-2-9-5l-4-7a3 3 0 0 1 5-3l3 4" />
      </svg>
    )
  }
  if (celebration.verb === 'Senses heat') {
    return (
      <svg {...common}>
        <path d="M17 24V8a4 4 0 0 1 8 0v16a7 7 0 1 1-8 0z" />
        <circle cx="21" cy="29" r="3" fill="#2b1a14" />
      </svg>
    )
  }
  // Practice and landscape: a rock with a check mark.
  return (
    <svg {...common}>
      <path d="M6 30l5-11 8-5 9 3 6 13z" fill="#69534D" stroke="#2b1a14" />
      <path d="M14 23l4 4 8-9" stroke="#fdf4ec" strokeWidth={3.5} />
    </svg>
  )
}

/**
 * The reward after every finished scan: a big friendly card with what was
 * scanned and one short line. It pops in, sparkles, then flies toward the
 * mission album. Clicking it closes it early. Nothing here saves anything.
 */
export function ScanReward() {
  const celebration = useGameStore((state) => state.scanCelebration)
  const dismiss = useGameStore((state) => state.dismissScanCelebration)
  const [leavingSeq, setLeavingSeq] = useState<number | null>(null)

  useEffect(() => {
    if (!celebration) return
    const seq = celebration.seq
    const leave = window.setTimeout(() => setLeavingSeq(seq), SHOW_MS)
    const close = window.setTimeout(() => {
      // Only close the card this timer belongs to.
      if (useGameStore.getState().scanCelebration?.seq === seq) dismiss()
    }, SHOW_MS + LEAVE_MS)
    return () => {
      window.clearTimeout(leave)
      window.clearTimeout(close)
    }
  }, [celebration, dismiss])

  if (!celebration) return null
  const leaving = leavingSeq === celebration.seq
  const eyebrow =
    celebration.kind === 'practice'
      ? 'Practice scan complete!'
      : celebration.kind === 'component'
        ? 'Part recognized!'
        : 'Field note saved!'

  return (
    <button
      type="button"
      key={celebration.seq}
      className={`scan-reward${leaving ? ' is-leaving' : ''}`}
      onClick={() => setLeavingSeq(celebration.seq)}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) dismiss()
      }}
      aria-live="polite"
    >
      <span className="scan-reward__sparkles" aria-hidden="true">
        {SPARKS.map((style, i) => (
          <i key={i} style={style} />
        ))}
      </span>
      <span className="scan-reward__icon">
        <RewardIcon celebration={celebration} />
      </span>
      <span className="scan-reward__eyebrow">{eyebrow}</span>
      <span className="scan-reward__title">{celebration.title}</span>
      <span className="scan-reward__detail">
        {celebration.verb && (
          <span className="scan-reward__verb">{celebration.verb}</span>
        )}
        {celebration.detail}
      </span>
    </button>
  )
}
