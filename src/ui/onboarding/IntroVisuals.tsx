import type { ReactNode } from 'react'
import type { IntroHologramState } from '../../data/onboardingNarrative'

/**
 * Procedural holograms for the cinematic intro, one still per idea in
 * PIP's line. They stay deliberately anonymous: abstract archive files,
 * signals and locations — no machine names, silhouettes or scientific
 * identities before the matching mission.
 *
 * Every frame is a 320x320 SVG rasterised by WindowHologram onto the
 * round Memory Window. The console hides the lower part of the window,
 * so the readable content lives inside y = 24..250.
 */

const TEAL = '#8FE3D8'
const PEACH = '#FFD9A8'
const CORAL = '#FF9A7A'
const LAVENDER = '#B8A6D9'
const CREAM = '#FDF4EC'

const STARS: ReadonlyArray<{ cx: number; cy: number; r: number }> = [
  { cx: 38, cy: 54, r: 1.2 },
  { cx: 82, cy: 30, r: 0.9 },
  { cx: 120, cy: 18, r: 1.1 },
  { cx: 206, cy: 22, r: 0.9 },
  { cx: 262, cy: 46, r: 1.2 },
  { cx: 24, cy: 120, r: 0.9 },
  { cx: 298, cy: 128, r: 0.9 },
  { cx: 40, cy: 214, r: 0.8 },
  { cx: 284, cy: 206, r: 0.8 },
]

function StarField() {
  return (
    <g aria-hidden="true">
      {STARS.map((star, index) => (
        <circle
          key={index}
          cx={star.cx}
          cy={star.cy}
          r={star.r}
          fill={CREAM}
          opacity={0.45 + (index % 3) * 0.12}
        />
      ))}
    </g>
  )
}

function Frame({ label, children, title }: { label: string; title?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 320 320" width="100%" height="100%" role="img" aria-label={label}>
      <defs>
        <radialGradient id="holo-glow-teal" cx="50%" cy="50%" r="50%">
          <stop offset="25%" stopColor={TEAL} stopOpacity="0.28" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="holo-glow-peach" cx="50%" cy="50%" r="50%">
          <stop offset="20%" stopColor={PEACH} stopOpacity="0.55" />
          <stop offset="100%" stopColor={PEACH} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="holo-glow-coral" cx="50%" cy="50%" r="50%">
          <stop offset="20%" stopColor={CORAL} stopOpacity="0.5" />
          <stop offset="100%" stopColor={CORAL} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="holo-envelope" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3DC" />
          <stop offset="100%" stopColor="#F2DDB4" />
        </linearGradient>
      </defs>
      <StarField />
      <circle cx="160" cy="160" r="146" fill="none" stroke={LAVENDER} strokeOpacity="0.22" strokeWidth="1" />
      <circle cx="160" cy="160" r="118" fill="none" stroke={TEAL} strokeOpacity="0.1" strokeWidth="1" strokeDasharray="2 7" />
      {title && <Caption text={title} />}
      {children}
    </svg>
  )
}

/** Small spaced-out label at the top of the projection. */
function Caption({ text, color = TEAL }: { text: string; color?: string }) {
  return (
    <text
      x="160"
      y="34"
      textAnchor="middle"
      fill={color}
      fontFamily="system-ui, sans-serif"
      fontSize="9.5"
      fontWeight="700"
      letterSpacing="2.4"
      opacity="0.9"
    >
      {text}
    </text>
  )
}

/* ------------------------------------------------------------------ */
/* Archive building blocks                                              */
/* ------------------------------------------------------------------ */

const CARD_X = [72, 160, 248] as const
const CARD_Y = 160
const CARD_W = 58
const CARD_H = 72
const HUB = { x: 160, y: 82 }

type HubMode = 'ok' | 'alert' | 'off'

function ArchiveHub({ mode }: { mode: HubMode }) {
  const accent = mode === 'ok' ? TEAL : mode === 'alert' ? CORAL : LAVENDER
  return (
    <g opacity={mode === 'off' ? 0.6 : 1}>
      <circle cx={HUB.x} cy={HUB.y} r="36" fill={`url(#holo-glow-${mode === 'alert' ? 'coral' : 'teal'})`} />
      <circle cx={HUB.x} cy={HUB.y} r="24" fill="none" stroke={PEACH} strokeOpacity="0.7" strokeWidth="1.6" />
      <circle
        cx={HUB.x}
        cy={HUB.y}
        r="15"
        fill="rgba(143,227,216,0.1)"
        stroke={accent}
        strokeWidth="1.5"
        strokeDasharray={mode === 'ok' ? undefined : '3 4'}
      />
      {mode === 'ok' && <circle cx={HUB.x} cy={HUB.y} r="5" fill={accent} />}
      {mode === 'alert' && (
        <g>
          <path d={`M${HUB.x} ${HUB.y - 9} L${HUB.x + 9} ${HUB.y + 7} H${HUB.x - 9} Z`} fill="none" stroke={CORAL} strokeWidth="1.8" strokeLinejoin="round" />
          <path d={`M${HUB.x} ${HUB.y - 3} v5`} stroke={CORAL} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx={HUB.x} cy={HUB.y + 4.5} r="1" fill={CORAL} />
        </g>
      )}
      {mode === 'off' && (
        <path d={`M${HUB.x - 6} ${HUB.y - 6} l12 12 M${HUB.x + 6} ${HUB.y - 6} l-12 12`} stroke={LAVENDER} strokeWidth="1.8" strokeLinecap="round" />
      )}
    </g>
  )
}

function linkPath(index: number): string {
  const x = CARD_X[index]!
  return `M${HUB.x} ${HUB.y + 24} C${HUB.x} ${HUB.y + 50} ${x} ${HUB.y + 40} ${x} ${CARD_Y - 10}`
}

/** A healthy link with data pulses travelling toward the file. */
function LiveLink({ index, color = TEAL }: { index: number; color?: string }) {
  const x = CARD_X[index]!
  return (
    <g>
      <path d={linkPath(index)} fill="none" stroke={color} strokeOpacity="0.7" strokeWidth="1.6" />
      <circle cx={(HUB.x + x) / 2 + (x - HUB.x) * 0.12} cy={HUB.y + 44} r="2.6" fill={color} />
      <circle cx={x} cy={CARD_Y - 22} r="2" fill={color} opacity="0.8" />
    </g>
  )
}

/** A link snapped in the middle, with a spark at the break. */
function BrokenLink({ index, spark = true }: { index: number; spark?: boolean }) {
  const x = CARD_X[index]!
  const bx = (HUB.x + x) / 2 + (x - HUB.x) * 0.12
  const by = HUB.y + 44
  return (
    <g>
      <path d={linkPath(index)} fill="none" stroke={CORAL} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="10 14" />
      {spark && (
        <g>
          <circle cx={bx} cy={by} r="10" fill="url(#holo-glow-coral)" />
          <path
            d={`M${bx - 6} ${by} h-5 M${bx + 6} ${by} h5 M${bx} ${by - 6} v-5 M${bx - 4} ${by - 4} l-4 -4 M${bx + 4} ${by + 4} l4 4`}
            stroke={CORAL}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  )
}

type CardMode = 'ok' | 'flicker' | 'broken' | 'dim' | 'missing' | 'partial' | 'glow'

function FileCard({ x, y = CARD_Y, mode, scale = 1 }: { x: number; y?: number; mode: CardMode; scale?: number }) {
  const w = CARD_W * scale
  const h = CARD_H * scale
  const left = x - w / 2
  const border =
    mode === 'glow' ? PEACH : mode === 'flicker' || mode === 'broken' ? CORAL : mode === 'dim' || mode === 'missing' ? LAVENDER : '#F2DDB4'
  const fill = mode === 'glow' ? 'rgba(255,217,168,0.18)' : 'rgba(253,244,236,0.1)'
  const opacity = mode === 'dim' ? 0.5 : mode === 'missing' ? 0.85 : 1
  const body = `M${left} ${y - 7 * scale} h${18 * scale} l${4 * scale} ${6 * scale} h${w - 22 * scale} v${h} h-${w} z`
  // Every card is the front of a stack: the Archive holds many files,
  // not a countable few.
  const stack = (
    <g opacity={mode === 'dim' ? 0.3 : 0.45}>
      {[2, 1].map((k) => (
        <rect
          key={k}
          x={left + 5 * k * scale}
          y={y - 5 * k * scale}
          width={w}
          height={h}
          rx="3"
          fill="none"
          stroke={border}
          strokeOpacity={0.5 / k}
          strokeWidth="1"
        />
      ))}
    </g>
  )

  if (mode === 'broken') {
    // The file is split in two halves drifting apart.
    return (
      <g>
        <g transform={`translate(-5 -3) rotate(-6 ${x} ${y + h / 2})`}>
          <path d={`M${left} ${y - 7} h18 l4 6 h${w / 2 - 22} l-6 ${h * 0.45} l6 ${h * 0.55} h-${w / 2} z`} fill={fill} stroke={CORAL} strokeOpacity="0.8" strokeWidth="1.3" />
          <path d={`M${left + 8} ${y + 16} h16 M${left + 8} ${y + 27} h12`} stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g transform={`translate(6 4) rotate(7 ${x} ${y + h / 2})`}>
          <path d={`M${x} ${y - 1} h${w / 2} v${h} h-${w / 2} l-6 -${h * 0.55} z`} fill={fill} stroke={CORAL} strokeOpacity="0.8" strokeWidth="1.3" />
          <path d={`M${x + 4} ${y + 16} h14 M${x + 2} ${y + 27} h12`} stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </g>
    )
  }

  return (
    <g opacity={opacity}>
      {mode === 'glow' && <circle cx={x} cy={y + h / 2} r={w * 0.85} fill="url(#holo-glow-peach)" />}
      {stack}
      {mode === 'flicker' && (
        // Glitch ghost: an offset copy of the outline.
        <path d={body} transform="translate(4 -2)" fill="none" stroke={TEAL} strokeOpacity="0.35" strokeWidth="1" />
      )}
      <path d={body} fill={fill} stroke={border} strokeOpacity="0.85" strokeWidth={mode === 'glow' ? 2 : 1.4} />
      {/* Anonymous explorer badge: a star in a circle. */}
      <circle cx={left + 14 * scale} cy={y + 13 * scale} r={7 * scale} fill="none" stroke={border} strokeOpacity="0.75" strokeWidth="1.1" />
      <path
        d={`M${left + 14 * scale} ${y + 9 * scale} l${1.3 * scale} ${2.7 * scale} ${2.9 * scale} ${0.4 * scale} -${2.1 * scale} ${2 * scale} ${0.5 * scale} ${2.9 * scale} -${2.6 * scale} -${1.4 * scale} -${2.6 * scale} ${1.4 * scale} ${0.5 * scale} -${2.9 * scale} -${2.1 * scale} -${2 * scale} ${2.9 * scale} -${0.4 * scale} z`}
        fill={border}
        opacity="0.85"
      />
      {mode === 'missing' ? (
        <text x={x} y={y + 48 * scale} textAnchor="middle" fill={LAVENDER} fontFamily="system-ui, sans-serif" fontWeight="800" fontSize={26 * scale}>
          ?
        </text>
      ) : (
        <g>
          <path
            d={`M${left + 10 * scale} ${y + 30 * scale} h${36 * scale} M${left + 10 * scale} ${y + 40 * scale} h${28 * scale} M${left + 10 * scale} ${y + 50 * scale} h${32 * scale}`}
            stroke={mode === 'glow' ? PEACH : CREAM}
            strokeOpacity={mode === 'partial' ? 0.75 : 0.7}
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeDasharray={mode === 'partial' ? `${14 * scale} ${6 * scale}` : undefined}
          />
          {mode === 'partial' && (
            // The missing half of the record: an empty dashed slot.
            <rect x={left + 8 * scale} y={y + 56 * scale} width={w - 16 * scale} height={10 * scale} rx="2" fill="none" stroke={LAVENDER} strokeOpacity="0.7" strokeDasharray="3 3" />
          )}
        </g>
      )}
    </g>
  )
}

function Shards() {
  return (
    <g opacity="0.6">
      <path d="M100 128 l8 -5 l4 8 l-8 5 z" fill={LAVENDER} />
      <path d="M214 120 l7 4 l-3 8 l-7 -4 z" fill={TEAL} />
      <path d="M128 238 l6 -7 l6 5 l-4 8 z" fill={CORAL} />
      <path d="M196 244 l8 3 l-2 7 l-8 -2 z" fill={LAVENDER} />
      <path d="M40 150 l6 2 l-2 6 l-6 -2 z" fill={CORAL} />
      <path d="M282 160 l5 -4 l3 6 l-6 3 z" fill={TEAL} />
    </g>
  )
}

/** Two puzzle pieces whose tab and socket do not fit, crossed out. */
function MismatchedPieces({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path
        d={`M${x - 22} ${y - 9} h10 a4 4 0 1 1 8 0 h4 v18 h-22 z`}
        fill="rgba(184,166,217,0.18)"
        stroke={LAVENDER}
        strokeWidth="1.3"
      />
      <path
        d={`M${x + 4} ${y - 9} h22 v18 h-22 v-6 a4 4 0 0 0 0 -6 z`}
        transform={`rotate(14 ${x + 15} ${y})`}
        fill="rgba(143,227,216,0.14)"
        stroke={TEAL}
        strokeWidth="1.3"
      />
      <path d={`M${x - 5} ${y + 16} l10 10 M${x + 5} ${y + 16} l-10 10`} stroke={CORAL} strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

function LocationPin({ x, y, active = true, label }: { x: number; y: number; active?: boolean; label?: string }) {
  const color = active ? PEACH : LAVENDER
  return (
    <g opacity={active ? 1 : 0.55}>
      {active && <circle cx={x} cy={y} r="18" fill="url(#holo-glow-peach)" />}
      <circle cx={x} cy={y + 2} r="11" fill="none" stroke={color} strokeOpacity="0.5" strokeDasharray="3 4" />
      <path
        d={`M${x} ${y + 6} C${x - 9} ${y - 3} ${x - 8} ${y - 14} ${x} ${y - 14} C${x + 8} ${y - 14} ${x + 9} ${y - 3} ${x} ${y + 6} z`}
        fill="rgba(255,217,168,0.22)"
        stroke={color}
        strokeWidth="1.6"
      />
      <circle cx={x} cy={y - 7} r="2.6" fill={color} />
      {label && (
        <text x={x} y={y + 26} textAnchor="middle" fill={color} fontFamily="ui-monospace, monospace" fontSize="7.5" opacity="0.85">
          {label}
        </text>
      )}
    </g>
  )
}

/** Two remembered places: the game has exactly two destinations. */
const PINS = [
  { x: 96, y: 116, label: 'LOC 01' },
  { x: 228, y: 100, label: 'LOC 02' },
] as const

/** Silent signal: three radio arcs with a slash through them. */
function SilentSignal({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y + 6} r="2.4" fill={LAVENDER} />
      <path
        d={`M${x - 7} ${y} a9 9 0 0 1 14 0 M${x - 12} ${y - 5} a15 15 0 0 1 24 0 M${x - 17} ${y - 10} a21 21 0 0 1 34 0`}
        fill="none"
        stroke={LAVENDER}
        strokeOpacity="0.75"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d={`M${x - 15} ${y + 8} L${x + 15} ${y - 18}`} stroke={CORAL} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* One composition per beat                                             */
/* ------------------------------------------------------------------ */

function MailScene() {
  // Cosmic Mail: a letter travelling from Earth along a route to the stars.
  return (
    <Frame label="Cosmic Mail carries a glowing letter from Earth across the stars." title="COSMIC MAIL">
      <circle cx="74" cy="182" r="34" fill="url(#holo-glow-teal)" />
      <circle cx="74" cy="182" r="22" fill="rgba(90,170,220,0.35)" stroke={TEAL} strokeWidth="1.4" />
      <path d="M60 172 q8 -6 14 2 q6 8 14 2 M58 190 q10 4 18 -2" fill="none" stroke="#9BE3A8" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
      <path d="M96 168 C140 104 196 92 250 104" fill="none" stroke={PEACH} strokeOpacity="0.75" strokeWidth="1.6" strokeDasharray="4 6" />
      <path d="M250 96 l2.4 6.6 6.6 2.4 -6.6 2.4 -2.4 6.6 -2.4 -6.6 -6.6 -2.4 6.6 -2.4z" fill={PEACH} />
      <circle cx="252" cy="105" r="16" fill="url(#holo-glow-peach)" />
      <g transform="translate(160 118) rotate(-14)">
        <circle r="26" fill="url(#holo-glow-peach)" />
        <rect x="-20" y="-13" width="40" height="27" rx="4" fill="url(#holo-envelope)" stroke={PEACH} strokeWidth="1.2" />
        <path d="M-19 -11 L0 3 L19 -11" fill="none" stroke="#8C6D3F" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M-34 4 h-10 M-32 12 h-16 M-30 -4 h-8" stroke={PEACH} strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <text x="74" y="230" textAnchor="middle" fill={TEAL} fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="700" letterSpacing="1.5" opacity="0.8">
        EARTH
      </text>
    </Frame>
  )
}

function ArchiveScene({ state }: { state: IntroHologramState }) {
  if (state === 'stable') {
    return (
      <Frame label="Many anonymous archive files connected to the Cosmic Archive." title="COSMIC ARCHIVE">
        <ArchiveHub mode="ok" />
        {[0, 1, 2].map((i) => <LiveLink key={i} index={i} />)}
        {CARD_X.map((x) => <FileCard key={x} x={x} mode="ok" />)}
      </Frame>
    )
  }
  if (state === 'losing1') {
    return (
      <Frame label="One archive file loses its connection: the link snaps and the file flickers." title="COSMIC ARCHIVE">
        <ArchiveHub mode="ok" />
        <BrokenLink index={0} />
        <LiveLink index={1} />
        <LiveLink index={2} />
        <FileCard x={CARD_X[0]} mode="flicker" />
        <FileCard x={CARD_X[1]} mode="ok" />
        <FileCard x={CARD_X[2]} mode="ok" />
      </Frame>
    )
  }
  if (state === 'losing3') {
    return (
      <Frame label="More and more archive files lose their connections, one after another." title="CONNECTION LOST">
        <ArchiveHub mode="alert" />
        {[0, 1, 2].map((i) => <BrokenLink key={i} index={i} />)}
        {CARD_X.map((x) => <FileCard key={x} x={x} mode="flicker" />)}
      </Frame>
    )
  }
  if (state === 'fragmented') {
    return (
      <Frame label="The archive files lose their connections and fragment." title="ARCHIVE FAULT">
        <ArchiveHub mode="alert" />
        {[0, 1, 2].map((i) => <BrokenLink key={i} index={i} spark={false} />)}
        {CARD_X.map((x) => <FileCard key={x} x={x} mode="broken" />)}
        <Shards />
      </Frame>
    )
  }
  if (state === 'recovering') {
    return (
      <Frame label="The Archive tries to reconnect the pieces, but they do not fit together." title="RECONNECTING...">
        <ArchiveHub mode="alert" />
        <circle cx={HUB.x} cy={HUB.y} r="31" fill="none" stroke={LAVENDER} strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="2 6" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={linkPath(i)} fill="none" stroke={LAVENDER} strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray="3 6" />
        ))}
        {CARD_X.map((x) => <MismatchedPieces key={x} x={x} y={CARD_Y + 22} />)}
      </Frame>
    )
  }
  if (state === 'offline') {
    return (
      <Frame label="The Archive goes quiet: no record is connected any more." title="NO CONNECTION">
        <ArchiveHub mode="off" />
        {CARD_X.map((x) => <FileCard key={x} x={x} mode="dim" />)}
        {CARD_X.map((x) => (
          <path key={x} d={`M${x - 8} ${CARD_Y - 30} l16 0`} stroke={LAVENDER} strokeOpacity="0.5" strokeWidth="1.4" strokeDasharray="2 4" />
        ))}
      </Frame>
    )
  }
  if (state === 'forgotten') {
    return (
      <Frame label="Explorer files whose discoveries PIP cannot remember: question marks where the records were." title="DISCOVERIES ?">
        <ArchiveHub mode="off" />
        {CARD_X.map((x) => <FileCard key={x} x={x} y={CARD_Y - 10} mode="missing" scale={1.1} />)}
      </Frame>
    )
  }
  // dossier: many incomplete files whose signals went quiet.
  return (
    <Frame label="Many incomplete files, their signals gone quiet, waiting to be found." title="FILES WAITING">
      {CARD_X.map((x) => (
        <g key={x}>
          <SilentSignal x={x} y={88} />
          <path d={`M${x} 100 v40`} stroke={LAVENDER} strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="2 4" />
          <FileCard x={x} y={CARD_Y - 6} mode="partial" />
        </g>
      ))}
    </Frame>
  )
}

function MemoryScene() {
  // PIP's own memory banks (the visor outline) with missing records.
  const slots = [
    [0, 0, true], [1, 0, false], [2, 0, true],
    [0, 1, false], [1, 1, true], [2, 1, false],
    [0, 2, true], [1, 2, false], [2, 2, false],
  ] as const
  return (
    <Frame label="PIP's own memory banks: several record slots are empty." title="PIP MEMORY">
      <ellipse cx="160" cy="146" rx="96" ry="78" fill="rgba(143,227,216,0.06)" stroke={PEACH} strokeOpacity="0.7" strokeWidth="2" />
      <ellipse cx="160" cy="146" rx="84" ry="66" fill="none" stroke={TEAL} strokeOpacity="0.35" strokeWidth="1" />
      {slots.map(([col, row, filled]) => {
        const x = 112 + col * 34
        const y = 106 + row * 28
        return filled ? (
          <g key={`${col}-${row}`}>
            <rect x={x} y={y} width="26" height="20" rx="3" fill="rgba(143,227,216,0.22)" stroke={TEAL} strokeWidth="1.2" />
            <path d={`M${x + 5} ${y + 7} h16 M${x + 5} ${y + 13} h10`} stroke={TEAL} strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ) : (
          <g key={`${col}-${row}`}>
            <rect x={x} y={y} width="26" height="20" rx="3" fill="none" stroke={CORAL} strokeOpacity="0.7" strokeWidth="1.2" strokeDasharray="3 3" />
            <text x={x + 13} y={y + 15} textAnchor="middle" fill={CORAL} fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="800" opacity="0.85">?</text>
          </g>
        )
      })}
      <text x="160" y="240" textAnchor="middle" fill={CORAL} fontFamily="ui-monospace, monospace" fontSize="8" opacity="0.8">
        5 / 9 RECORDS MISSING
      </text>
    </Frame>
  )
}

function StarMap() {
  return (
    <g opacity="0.55">
      {[80, 120, 160, 200, 240].map((y) => (
        <path key={y} d={`M36 ${y} H284`} stroke={TEAL} strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="2 5" />
      ))}
      {[80, 130, 180, 230].map((x) => (
        <path key={x} d={`M${x} 48 V250`} stroke={TEAL} strokeOpacity="0.15" strokeWidth="0.8" strokeDasharray="2 5" />
      ))}
    </g>
  )
}

function LocationsScene() {
  return (
    <Frame label="An old star map: two remembered places light up." title="TWO PLACES">
      <StarMap />
      {PINS.map((pin) => <LocationPin key={pin.label} x={pin.x} y={pin.y} label={pin.label} />)}
    </Frame>
  )
}

function RouteScene() {
  // Mailwing at the bottom, dashed routes reaching each location, and the
  // file pieces snapping back together beside every pin.
  const ship = { x: 160, y: 236 }
  return (
    <Frame label="Routes from Mailwing reach the two remembered places, where the file pieces fit together again." title="SET A COURSE">
      <StarMap />
      {PINS.map((pin) => (
        <path
          key={pin.label}
          d={`M${ship.x} ${ship.y - 10} Q${(ship.x + pin.x) / 2} ${pin.y + 60} ${pin.x} ${pin.y + 8}`}
          fill="none"
          stroke={PEACH}
          strokeOpacity="0.75"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
      ))}
      {PINS.map((pin) => (
        <g key={`p-${pin.label}`}>
          <LocationPin x={pin.x} y={pin.y} />
          <path
            d={`M${pin.x + 16} ${pin.y - 18} h10 a3 3 0 1 1 6 0 h4 v13 h-20 z`}
            fill="rgba(255,217,168,0.25)"
            stroke={PEACH}
            strokeWidth="1"
          />
        </g>
      ))}
      <g transform={`translate(${ship.x} ${ship.y})`}>
        <circle r="16" fill="url(#holo-glow-teal)" />
        <path d="M0 -12 C6 -6 7 2 5 8 H-5 C-7 2 -6 -6 0 -12 z" fill="rgba(143,227,216,0.25)" stroke={TEAL} strokeWidth="1.5" />
        <path d="M-5 4 l-6 6 h6 M5 4 l6 6 h-6" fill="none" stroke={TEAL} strokeWidth="1.3" />
        <circle cy="-3" r="2" fill={PEACH} />
      </g>
    </Frame>
  )
}

/** The smart letter that forms during the invitation: many files feed it. */
export function EnvelopeHologram({ facing }: { facing: boolean }) {
  return (
    <svg
      className={`holo-scene holo-scene--envelope${facing ? ' is-facing' : ''}`}
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      role="img"
      aria-label="An incomplete smart letter forming in the Cosmic Archive from many files"
    >
      <defs>
        <linearGradient id="holo-envelope" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3DC" />
          <stop offset="100%" stopColor="#F2DDB4" />
        </linearGradient>
        <radialGradient id="holo-letter-glow" cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor={PEACH} stopOpacity="0.3" />
          <stop offset="100%" stopColor={PEACH} stopOpacity="0" />
        </radialGradient>
      </defs>
      <StarField />
      <circle cx="160" cy="160" r="146" fill="none" stroke={LAVENDER} strokeOpacity="0.22" strokeWidth="1" />
      <Caption text="SMART LETTER" color={PEACH} />
      <circle cx="160" cy="112" r="76" fill="url(#holo-letter-glow)" />

      <g>
        <rect x="100" y="66" width="120" height="84" rx="9" fill="url(#holo-envelope)" stroke={LAVENDER} strokeOpacity="0.85" strokeWidth="1.6" />
        <path d="M102 72 L160 116 L218 72" fill="none" stroke="#8C6D3F" strokeWidth="2.2" strokeLinecap="round" />
        {/* Archive seal, still open: no history delivered yet. */}
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M160 134 L${160 + 9 * Math.cos((i * 2 * Math.PI) / 3 - Math.PI / 2)} ${134 + 9 * Math.sin((i * 2 * Math.PI) / 3 - Math.PI / 2)}`}
            stroke={LAVENDER}
            strokeWidth="1.4"
          />
        ))}
        <circle cx="160" cy="134" r="9" fill="none" stroke={LAVENDER} strokeWidth="1.6" strokeDasharray="3 3" />
      </g>

      {/* A row of files waits below, each sending its piece up. */}
      {[64, 112, 160, 208, 256].map((x) => (
        <g key={x}>
          <path d={`M${x} 196 Q${(x + 160) / 2} 176 160 ${154}`} fill="none" stroke={PEACH} strokeOpacity="0.55" strokeWidth="1.3" strokeDasharray="3 5" />
          <path d={`M${x - 16} 198 h32 v26 h-32 z`} fill="rgba(253,244,236,0.12)" stroke={TEAL} strokeOpacity="0.75" strokeWidth="1.1" />
          <path d={`M${x - 10} 206 h20 M${x - 10} 213 h13`} stroke={CREAM} strokeOpacity="0.6" strokeWidth="1.1" />
          <text x={x + 9} y={221} fill={LAVENDER} fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="800">?</text>
        </g>
      ))}

      <path d="M66 70 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill={PEACH} opacity="0.9" />
      <path d="M256 78 l1.6 4.6 4.6 1.6 -4.6 1.6 -1.6 4.6 -1.6 -4.6 -4.6 -1.6 4.6 -1.6z" fill="#F4B4DF" opacity="0.85" />
    </svg>
  )
}

/** The Archive projection for a beat (every state except 'none' and 'letter'). */
export function ArchiveBoard({ state }: { state: IntroHologramState }) {
  switch (state) {
    case 'mail':
      return <MailScene />
    case 'memory':
      return <MemoryScene />
    case 'locations':
      return <LocationsScene />
    case 'route':
      return <RouteScene />
    default:
      return <ArchiveScene state={state} />
  }
}
