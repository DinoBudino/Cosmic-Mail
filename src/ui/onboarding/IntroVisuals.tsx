import type { IntroHologramState } from '../../data/onboardingNarrative'

/**
 * Procedural holograms for the cinematic intro. They are deliberately
 * anonymous: three abstract archive files, their connections and a forming
 * smart letter. No machine names, silhouettes or scientific identities.
 *
 * The projection is rasterised by WindowHologram, so each state is drawn
 * as a complete, readable still frame instead of relying on CSS animation.
 */

const STARS: ReadonlyArray<{ cx: number; cy: number; r: number }> = [
  { cx: 38, cy: 34, r: 1.2 },
  { cx: 82, cy: 22, r: 0.9 },
  { cx: 138, cy: 30, r: 1.1 },
  { cx: 206, cy: 24, r: 0.9 },
  { cx: 268, cy: 40, r: 1.2 },
  { cx: 24, cy: 96, r: 0.9 },
  { cx: 296, cy: 108, r: 0.9 },
  { cx: 52, cy: 270, r: 0.8 },
  { cx: 272, cy: 262, r: 0.8 },
]

const CARD_POSITIONS = [72, 160, 248] as const
const CARD_Y = 178
const CARD_W = 58
const CARD_H = 76

function StarField() {
  return (
    <g aria-hidden="true">
      {STARS.map((star, index) => (
        <circle
          key={index}
          cx={star.cx}
          cy={star.cy}
          r={star.r}
          fill="#FDF4EC"
          opacity={0.5 + (index % 3) * 0.12}
        />
      ))}
    </g>
  )
}

function ArchiveHub({ faulted }: { faulted: boolean }) {
  const accent = faulted ? '#F2B28C' : '#8FE3D8'
  return (
    <g>
      <circle cx="160" cy="76" r="34" fill="url(#holo-hub-glow)" />
      <circle
        cx="160"
        cy="76"
        r="24"
        fill="none"
        stroke="#FFD9A8"
        strokeOpacity="0.75"
        strokeWidth="1.6"
      />
      <circle
        cx="160"
        cy="76"
        r="15"
        fill="rgba(143,227,216,0.12)"
        stroke={accent}
        strokeOpacity="0.85"
        strokeWidth="1.4"
        strokeDasharray={faulted ? '3 4' : undefined}
      />
      <circle cx="160" cy="76" r="4.5" fill={accent} />
      <path
        d="M160 96 v10"
        stroke="#FFD9A8"
        strokeOpacity="0.5"
        strokeWidth="1.2"
      />
    </g>
  )
}

function Connection({
  index,
  state,
}: {
  index: number
  state: IntroHologramState
}) {
  const x = CARD_POSITIONS[index]!
  const path = `M160 102 C160 126 ${x} 118 ${x} 166`
  const broken =
    state === 'fragmented' ||
    state === 'recovering' ||
    (state === 'losing1' && index === 0) ||
    (state === 'losing2' && index <= 1) ||
    state === 'losing3'
  const hopeful = state === 'hint' && index === 1
  const quiet = state === 'hint' && !hopeful

  if (quiet) {
    return (
      <path
        d={path}
        fill="none"
        stroke="#B8A6D9"
        strokeOpacity="0.28"
        strokeWidth="1.1"
        strokeDasharray="3 6"
      />
    )
  }

  if (broken && !hopeful) {
    return (
      <g opacity={state === 'recovering' ? 0.62 : 0.48}>
        <path
          d={path}
          fill="none"
          stroke="#F2B28C"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <circle cx={x} cy="128" r="2.4" fill="#F2B28C" />
        <circle cx={x} cy="136" r="1.4" fill="#F2B28C" opacity="0.7" />
      </g>
    )
  }

  return (
    <path
      d={path}
      fill="none"
      stroke={hopeful ? '#FFD9A8' : '#8FE3D8'}
      strokeOpacity={hopeful ? 0.95 : 0.62}
      strokeWidth={hopeful ? 2.2 : 1.5}
      strokeDasharray={state === 'dossier' ? '5 5' : undefined}
    />
  )
}

function DossierCard({
  index,
  state,
}: {
  index: number
  state: IntroHologramState
}) {
  const x = CARD_POSITIONS[index]!
  const left = x - CARD_W / 2
  const broken =
    state === 'fragmented' ||
    state === 'recovering' ||
    (state === 'losing1' && index === 0) ||
    (state === 'losing2' && index <= 1) ||
    state === 'losing3'
  const hopeful = state === 'hint' && index === 1
  const dim = (broken && !hopeful) || (state === 'hint' && !hopeful)
  const rotation = dim ? (index - 1) * 3.5 : 0
  const border = hopeful ? '#FFD9A8' : dim ? '#B8A6D9' : '#F2DDB4'
  const fill = hopeful
    ? 'rgba(255,217,168,0.2)'
    : 'rgba(253,244,236,0.1)'

  return (
    <g
      transform={`rotate(${rotation} ${x} ${CARD_Y + CARD_H / 2})`}
      opacity={dim ? 0.62 : 1}
    >
      {/* Folder tab + body */}
      <path
        d={`M${left} ${CARD_Y - 8} h20 l4 7 h${CARD_W - 24} v${CARD_H} h-${CARD_W} z`}
        fill={fill}
        stroke={border}
        strokeOpacity={hopeful ? 0.95 : 0.7}
        strokeWidth={hopeful ? 2 : 1.3}
      />

      {/* Abstract record lines; never equipment silhouettes. */}
      <path
        d={`M${left + 10} ${CARD_Y + 20} h30 M${left + 10} ${CARD_Y + 31} h22 M${left + 10} ${CARD_Y + 42} h27`}
        stroke={hopeful ? '#FFD9A8' : '#FDF4EC'}
        strokeOpacity={dim ? 0.4 : 0.72}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Archive seal */}
      <circle
        cx={x + 14}
        cy={CARD_Y + 56}
        r="6"
        fill="none"
        stroke={hopeful ? '#FFD9A8' : '#8FE3D8'}
        strokeOpacity={dim ? 0.45 : 0.8}
        strokeWidth="1.2"
      />
      <circle
        cx={x + 14}
        cy={CARD_Y + 56}
        r="2"
        fill={hopeful ? '#FFD9A8' : '#8FE3D8'}
        opacity={dim ? 0.5 : 0.9}
      />

      {hopeful && (
        <g>
          <circle cx={x + 14} cy={CARD_Y + 56} r="12" fill="url(#holo-clue-glow)" />
          <path
            d={`M${x + 14} ${CARD_Y + 50} a5 5 0 1 1 0.1 0 M${x + 14} ${CARD_Y + 55} v9`}
            stroke="#FFD9A8"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}

      {broken && !hopeful && (
        <g>
          <path
            d={`M${left + 4} ${CARD_Y + 40} l14 -10 l8 7 l-12 12 z`}
            fill="rgba(184,166,217,0.18)"
            stroke="#B8A6D9"
            strokeOpacity="0.5"
            strokeWidth="0.9"
          />
          <path
            d={`M${left + 20} ${CARD_Y + 6} l7 12 l-10 5`}
            fill="none"
            stroke="#F2B28C"
            strokeOpacity="0.7"
            strokeWidth="1.1"
          />
        </g>
      )}
    </g>
  )
}

function FloatingShards() {
  return (
    <g opacity="0.5">
      <path d="M96 112 l8 -5 l4 8 l-8 5 z" fill="#B8A6D9" />
      <path d="M218 126 l7 4 l-3 8 l-7 -4 z" fill="#8FE3D8" />
      <path d="M126 242 l6 -7 l6 5 l-4 8 z" fill="#F2B28C" />
      <path d="M188 252 l8 3 l-2 7 l-8 -2 z" fill="#B8A6D9" />
    </g>
  )
}

function RecoveryAttempts() {
  return (
    <g opacity="0.9">
      {[72, 160, 248].map((x) => (
        <g key={x}>
          <path
            d={`M160 104 C160 126 ${x * 0.62 + 61} 126 ${x * 0.72 + 45} 142`}
            fill="none"
            stroke="#B8A6D9"
            strokeWidth="1.4"
            strokeDasharray="3 6"
          />
          <path
            d={`M${x * 0.72 + 41} 139 l6 6 M${x * 0.72 + 47} 139 l-6 6`}
            stroke="#F2B28C"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      ))}
      <circle cx="160" cy="76" r="31" fill="none" stroke="#B8A6D9" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="2 6" />
      <path d="M188 76 h8" stroke="#F2B28C" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function LocationClue() {
  return (
    <g opacity="0.85">
      <path
        d="M44 292 H276"
        stroke="#8FE3D8"
        strokeOpacity="0.32"
        strokeWidth="1"
        strokeDasharray="2 6"
      />
      <circle cx="160" cy="292" r="4" fill="#FFD9A8" />
      <circle cx="160" cy="292" r="13" fill="none" stroke="#FFD9A8" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 5" />
      <circle cx="96" cy="292" r="2" fill="#B8A6D9" opacity="0.7" />
      <circle cx="224" cy="292" r="2" fill="#B8A6D9" opacity="0.7" />
    </g>
  )
}

function DossierRoute() {
  return (
    <g opacity="0.65">
      <path
        d="M100 274 H220"
        stroke="#FFD9A8"
        strokeWidth="1.2"
        strokeDasharray="4 7"
      />
      <path d="M214 270 l8 4 l-8 4 z" fill="#FFD9A8" />
    </g>
  )
}

/**
 * The central Archive board. Each state is a readable still: stable,
 * losing connections one by one, fragmented, a failed recovery, a useful
 * clue, or the three incomplete dossiers that set up the invitation.
 */
export function ArchiveBoard({ state }: { state: IntroHologramState }) {
  const faulted =
    state === 'losing1' ||
    state === 'losing2' ||
    state === 'losing3' ||
    state === 'fragmented' ||
    state === 'recovering'
  const showShards =
    state === 'fragmented' ||
    state === 'recovering' ||
    state === 'losing3'

  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      role="img"
      aria-label={
        faulted
          ? 'Three anonymous archive files lose their connections and fragment.'
          : state === 'hint'
            ? 'One anonymous archive file shows a small location clue.'
            : 'Three anonymous archive files connected to the Cosmic Archive.'
      }
    >
      <defs>
        <radialGradient id="holo-hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor="#8FE3D8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#8FE3D8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="holo-clue-glow" cx="50%" cy="50%" r="50%">
          <stop offset="20%" stopColor="#FFD9A8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFD9A8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <StarField />
      <circle cx="160" cy="166" r="142" fill="none" stroke="#B8A6D9" strokeOpacity="0.22" strokeWidth="1" />
      <circle cx="160" cy="166" r="112" fill="none" stroke="#8FE3D8" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="2 7" />

      <ArchiveHub faulted={faulted} />
      {state === 'recovering' && <RecoveryAttempts />}

      {[0, 1, 2].map((index) => (
        <Connection key={index} index={index} state={state} />
      ))}
      {[0, 1, 2].map((index) => (
        <DossierCard key={index} index={index} state={state} />
      ))}

      {showShards && <FloatingShards />}
      {state === 'hint' && <LocationClue />}
      {state === 'dossier' && <DossierRoute />}
    </svg>
  )
}

/** Three stable archive records (kept as a named export for reuse). */
export function ArchiveSignals() {
  return <ArchiveBoard state="stable" />
}

/** The little smart letter that forms during the invitation. */
export function EnvelopeHologram({ facing }: { facing: boolean }) {
  return (
    <svg
      className={`holo-scene holo-scene--envelope${facing ? ' is-facing' : ''}`}
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      role="img"
      aria-label="An incomplete smart letter forming in the Cosmic Archive"
    >
      <defs>
        <linearGradient id="holo-envelope" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3DC" />
          <stop offset="100%" stopColor="#F2DDB4" />
        </linearGradient>
        <radialGradient id="holo-letter-glow" cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor="#FFD9A8" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#FFD9A8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <StarField />
      <circle cx="160" cy="160" r="140" fill="none" stroke="#B8A6D9" strokeOpacity="0.22" strokeWidth="1" />
      <circle cx="160" cy="160" r="74" fill="url(#holo-letter-glow)" />

      <g>
        <rect
          x="94"
          y="92"
          width="132"
          height="92"
          rx="9"
          fill="url(#holo-envelope)"
          stroke="#B8A6D9"
          strokeOpacity="0.85"
          strokeWidth="1.6"
        />
        <path
          d="M96 98 L160 146 L224 98"
          fill="none"
          stroke="#8C6D3F"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Incomplete seal: the last connection is still forming. */}
        <circle cx="160" cy="164" r="7" fill="none" stroke="#B8A6D9" strokeWidth="1.6" strokeDasharray="3 3" />
        <circle cx="160" cy="164" r="2.6" fill="#FFD9A8" />
      </g>

      {/* The three anonymous files wait under the letter. */}
      {[110, 160, 210].map((x) => (
        <g key={x} opacity="0.85">
          <path
            d={`M${x - 14} 250 h28 v20 h-28 z`}
            fill="rgba(253,244,236,0.12)"
            stroke="#8FE3D8"
            strokeOpacity="0.68"
            strokeWidth="1"
          />
          <path
            d={`M${x - 9} 257 h18 M${x - 9} 262 h12`}
            stroke="#FDF4EC"
            strokeOpacity="0.58"
            strokeWidth="1"
          />
          <circle cx={x + 8} cy={265} r="1.8" fill="#FFD9A8" opacity="0.8" />
        </g>
      ))}

      <path
        d="M70 62 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"
        fill="#FFD9A8"
        opacity="0.9"
      />
      <path
        d="M252 70 l1.6 4.6 4.6 1.6 -4.6 1.6 -1.6 4.6 -1.6 -4.6 -4.6 -1.6 4.6 -1.6z"
        fill="#F4B4DF"
        opacity="0.85"
      />
    </svg>
  )
}
