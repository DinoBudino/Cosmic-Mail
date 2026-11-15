import type { MissionDefinition } from '../data/missions'

export type HuntIcon = 'eye' | 'tool' | 'heat'

/** Simple line icons, readable at 22 px. */
export function HuntIconGlyph({ name }: { name: HuntIcon }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'eye') {
    return (
      <svg {...common}>
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  if (name === 'tool') {
    return (
      <svg {...common}>
        <path d="M4 20 13 11" />
        <circle cx="16" cy="8" r="4.2" />
        <path d="M14.2 6.2 17.8 9.8" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
      <path d="M12 9v7" />
      <path d="M17.5 5.5c1 .6 1.5 1.5 1.5 2.5M19.5 3.5c1.5 1 2.5 2.6 2.5 4.5" />
    </svg>
  )
}

/**
 * The parts hunt at a glance: three slots (eyes, rock tool, heat reader).
 * Found parts light up with their name, the one to find now pulses, the
 * others wait as "?". It only appears after the explorer is identified.
 */
export function HuntTracker({
  mission,
  scannedIds,
}: {
  mission: MissionDefinition
  scannedIds: readonly string[]
}) {
  const parts = mission.components.filter((component) => component.huntClue)
  if (parts.length === 0) return null
  const found = new Set(scannedIds)
  const nextId = parts.find((part) => !found.has(part.id))?.id ?? null
  const count = parts.filter((part) => found.has(part.id)).length

  return (
    <ol
      className="hunt-tracker"
      aria-label={`Parts found: ${count} of ${parts.length}`}
    >
      {parts.map((part) => {
        const state = found.has(part.id)
          ? 'found'
          : part.id === nextId
            ? 'next'
            : 'waiting'
        return (
          <li key={part.id} className="hunt-tracker__slot" data-state={state}>
            {state === 'waiting' ? (
              <span className="hunt-tracker__mystery" aria-hidden="true">?</span>
            ) : (
              <HuntIconGlyph name={part.huntClue!.icon} />
            )}
            <span className="hunt-tracker__label">
              {state === 'found' ? part.huntClue!.label : state === 'next' ? 'Find me!' : 'Secret'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
