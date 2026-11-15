import type { ReactNode } from 'react'
import { DESTINATIONS } from '../../data/destinations'
import type { IntroHologramState, IntroPipPanel } from '../../data/onboardingNarrative'

/**
 * Procedural holograms for the cinematic intro, one still per idea in
 * PIP's line. They stay deliberately anonymous: abstract archive files,
 * signals and locations — no machine names, silhouettes or scientific
 * identities before the matching mission.
 *
 * Every frame is a 320x320 SVG rasterised by WindowHologram onto the
 * round Memory Window. The console hides the lower part of the window,
 * so the readable content lives inside y = 24..250.
 *
 * Animated beats are a short sequence of stills: `variant` 0 is always
 * the settled frame and carries the whole message on its own (reduced
 * motion shows only that one); higher variants are the earlier steps.
 * Status is never colour-only: every warning also has an icon and words.
 */

const TEAL = '#8FE3D8'
const PEACH = '#FFD9A8'
const CORAL = '#FF9A7A'
const LAVENDER = '#B8A6D9'
const CREAM = '#FDF4EC'
/** Warning yellow: a file that just lost its link. */
const AMBER = '#FFD45C'
/** Emergency orange: solar activity and affected relays. */
const ORANGE = '#FFA24A'
const SUN_CORE = '#FFF4C2'

const FONT = 'system-ui, sans-serif'
const MONO = 'ui-monospace, monospace'

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

/** Projection tint: the screen light slides from cyan toward orange. */
type Tint = 'none' | 'warm' | 'storm'

function Frame({
  label,
  children,
  title,
  titleColor,
  tint = 'none',
}: {
  label: string
  title?: string
  titleColor?: string
  tint?: Tint
  children: ReactNode
}) {
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
        <radialGradient id="holo-glow-amber" cx="50%" cy="50%" r="50%">
          <stop offset="15%" stopColor={AMBER} stopOpacity="0.7" />
          <stop offset="100%" stopColor={AMBER} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="holo-glow-orange" cx="50%" cy="50%" r="50%">
          <stop offset="10%" stopColor={ORANGE} stopOpacity="0.5" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="holo-sun" cx="45%" cy="45%" r="55%">
          <stop offset="0%" stopColor={SUN_CORE} />
          <stop offset="45%" stopColor="#FFD35A" />
          <stop offset="85%" stopColor="#FF9A3C" />
          <stop offset="100%" stopColor="#F2742E" />
        </radialGradient>
        <radialGradient id="holo-corona" cx="50%" cy="50%" r="50%">
          <stop offset="45%" stopColor="#FFC45A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FF8A3C" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="holo-plasma" cx="35%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#FFB060" stopOpacity="0.05" />
          <stop offset="70%" stopColor="#FF9A4A" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFD9A8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="holo-envelope" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3DC" />
          <stop offset="100%" stopColor="#F2DDB4" />
        </linearGradient>
      </defs>
      {tint !== 'none' && (
        <circle cx="160" cy="160" r="150" fill="url(#holo-glow-orange)" opacity={tint === 'storm' ? 0.75 : 0.4} />
      )}
      <StarField />
      <circle
        cx="160"
        cy="160"
        r="146"
        fill="none"
        stroke={tint === 'none' ? LAVENDER : ORANGE}
        strokeOpacity={tint === 'none' ? 0.22 : 0.35}
        strokeWidth="1"
      />
      <circle cx="160" cy="160" r="118" fill="none" stroke={TEAL} strokeOpacity="0.1" strokeWidth="1" strokeDasharray="2 7" />
      {title && <Caption text={title} color={titleColor} />}
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
      fontFamily={FONT}
      fontSize="9.5"
      fontWeight="700"
      letterSpacing="2.4"
      opacity="0.9"
    >
      {text}
    </text>
  )
}

/** Approximate rendered width of a bold label (for sizing its plate). */
function labelWidth(text: string, size: number, spacing: number): number {
  return text.length * (size * 0.62 + spacing)
}

/** Warning triangle with an exclamation mark. */
function WarnIcon({ x, y, size = 12, color = AMBER }: { x: number; y: number; size?: number; color?: string }) {
  const h = size * 0.9
  return (
    <g>
      <path
        d={`M${x} ${y - h / 2} L${x + size / 2} ${y + h / 2} H${x - size / 2} Z`}
        fill="none"
        stroke={color}
        strokeWidth={size / 7}
        strokeLinejoin="round"
      />
      <path d={`M${x} ${y - h / 6} v${h / 3}`} stroke={color} strokeWidth={size / 7} strokeLinecap="round" />
      <circle cx={x} cy={y + h / 3} r={size / 14} fill={color} />
    </g>
  )
}

/**
 * A warning plate: icon + words. `primary` plates are larger and solid,
 * secondary ones are smaller and outlined, so stacked alerts keep a
 * clear hierarchy.
 */
function AlertPlate({
  y,
  text,
  color = ORANGE,
  primary = false,
  x = 160,
}: {
  y: number
  text: string
  color?: string
  primary?: boolean
  x?: number
}) {
  const size = primary ? 10.5 : 8
  const spacing = primary ? 1.1 : 0.9
  const iconSize = primary ? 12 : 9
  const textW = labelWidth(text, size, spacing)
  const w = textW + iconSize + 22
  const h = primary ? 24 : 18
  const left = x - w / 2
  return (
    <g>
      <rect
        x={left}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h / 2}
        fill={primary ? 'rgba(255,162,74,0.24)' : 'rgba(27,16,41,0.55)'}
        stroke={color}
        strokeOpacity={primary ? 0.95 : 0.7}
        strokeWidth={primary ? 1.4 : 1}
      />
      <WarnIcon x={left + 10 + iconSize / 2} y={y} size={iconSize} color={color} />
      <text
        x={left + 16 + iconSize}
        y={y + size * 0.36}
        fill={primary ? CREAM : color}
        fontFamily={FONT}
        fontSize={size}
        fontWeight="800"
        letterSpacing={spacing}
      >
        {text}
      </text>
    </g>
  )
}

/** Small tag under a node or file: a word, never colour alone. */
function Tag({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const w = labelWidth(text, 6.5, 0.6) + 8
  return (
    <g>
      <rect x={x - w / 2} y={y - 6} width={w} height={11} rx="5.5" fill="rgba(27,16,41,0.6)" stroke={color} strokeOpacity="0.7" strokeWidth="0.8" />
      <text x={x} y={y + 2.2} textAnchor="middle" fill={color} fontFamily={MONO} fontSize="6.5" fontWeight="700" letterSpacing="0.6">
        {text}
      </text>
    </g>
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

type HubMode = 'ok' | 'bright' | 'alert' | 'off'

function ArchiveHub({ mode }: { mode: HubMode }) {
  const accent = mode === 'ok' || mode === 'bright' ? TEAL : mode === 'alert' ? CORAL : LAVENDER
  return (
    <g opacity={mode === 'off' ? 0.6 : 1}>
      <circle cx={HUB.x} cy={HUB.y} r={mode === 'bright' ? 46 : 36} fill={`url(#holo-glow-${mode === 'alert' ? 'coral' : 'teal'})`} />
      <circle cx={HUB.x} cy={HUB.y} r="24" fill="none" stroke={PEACH} strokeOpacity="0.7" strokeWidth="1.6" />
      <circle
        cx={HUB.x}
        cy={HUB.y}
        r="15"
        fill="rgba(143,227,216,0.1)"
        stroke={accent}
        strokeWidth="1.5"
        strokeDasharray={mode === 'ok' || mode === 'bright' ? undefined : '3 4'}
      />
      {(mode === 'ok' || mode === 'bright') && <circle cx={HUB.x} cy={HUB.y} r={mode === 'bright' ? 6.5 : 5} fill={accent} />}
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

function linkMid(index: number): { x: number; y: number } {
  const x = CARD_X[index]!
  return { x: (HUB.x + x) / 2 + (x - HUB.x) * 0.12, y: HUB.y + 44 }
}

/** A healthy link with data pulses travelling toward the file. */
function LiveLink({
  index,
  color = TEAL,
  opacity = 0.7,
  bright = false,
}: {
  index: number
  color?: string
  opacity?: number
  bright?: boolean
}) {
  const x = CARD_X[index]!
  const mid = linkMid(index)
  return (
    <g opacity={opacity / 0.7}>
      <path d={linkPath(index)} fill="none" stroke={color} strokeOpacity="0.7" strokeWidth={bright ? 2.2 : 1.6} />
      {bright && <circle cx={mid.x} cy={mid.y} r="8" fill="url(#holo-glow-teal)" />}
      <circle cx={mid.x} cy={mid.y} r="2.6" fill={color} />
      <circle cx={x} cy={CARD_Y - 22} r="2" fill={color} opacity="0.8" />
    </g>
  )
}

/** A link that is losing strength: faint, broken into short dashes. */
function FadingLink({ index, color = AMBER, strength }: { index: number; color?: string; strength: number }) {
  return (
    <path
      d={linkPath(index)}
      fill="none"
      stroke={color}
      strokeOpacity={0.25 + strength * 0.4}
      strokeWidth="1.4"
      strokeDasharray={strength > 0.5 ? '6 3' : '2 6'}
    />
  )
}

/** A link snapped in the middle, with a spark at the break. */
function BrokenLink({ index, spark = true, color = CORAL }: { index: number; spark?: boolean; color?: string }) {
  const { x: bx, y: by } = linkMid(index)
  return (
    <g>
      <path d={linkPath(index)} fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="10 14" />
      {spark && (
        <g>
          <circle cx={bx} cy={by} r="10" fill={`url(#holo-glow-${color === AMBER ? 'amber' : 'coral'})`} />
          <path
            d={`M${bx - 6} ${by} h-5 M${bx + 6} ${by} h5 M${bx} ${by - 6} v-5 M${bx - 4} ${by - 4} l-4 -4 M${bx + 4} ${by + 4} l4 4`}
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  )
}

type CardMode =
  | 'ok'
  | 'flicker'
  | 'warning'
  | 'cracked'
  | 'broken'
  | 'dim'
  | 'missing'
  | 'partial'
  | 'glow'

function FileCard({ x, y = CARD_Y, mode, scale = 1 }: { x: number; y?: number; mode: CardMode; scale?: number }) {
  const w = CARD_W * scale
  const h = CARD_H * scale
  const left = x - w / 2
  const border =
    mode === 'glow'
      ? PEACH
      : mode === 'warning' || mode === 'cracked'
        ? AMBER
        : mode === 'flicker' || mode === 'broken'
          ? CORAL
          : mode === 'dim' || mode === 'missing'
            ? LAVENDER
            : '#F2DDB4'
  const fill =
    mode === 'glow'
      ? 'rgba(255,217,168,0.18)'
      : mode === 'warning' || mode === 'cracked'
        ? 'rgba(255,212,92,0.12)'
        : 'rgba(253,244,236,0.1)'
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
    // The file is split into geometric halves drifting apart.
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
      {mode === 'warning' && <circle cx={x} cy={y + h / 2} r={w * 0.8} fill="url(#holo-glow-amber)" opacity="0.55" />}
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
        <text x={x} y={y + 48 * scale} textAnchor="middle" fill={LAVENDER} fontFamily={FONT} fontWeight="800" fontSize={26 * scale}>
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
            strokeDasharray={mode === 'partial' || mode === 'cracked' ? `${14 * scale} ${6 * scale}` : undefined}
          />
          {mode === 'partial' && (
            // The missing half of the record: an empty dashed slot.
            <rect x={left + 8 * scale} y={y + 56 * scale} width={w - 16 * scale} height={10 * scale} rx="2" fill="none" stroke={LAVENDER} strokeOpacity="0.7" strokeDasharray="3 3" />
          )}
        </g>
      )}
      {mode === 'warning' && <WarnIcon x={left + w - 10 * scale} y={y + 12 * scale} size={11 * scale} />}
      {mode === 'cracked' && (
        // Partially fragmented icon: cracks run across the record.
        <path
          d={`M${left + 4} ${y + 22} l10 6 l-4 10 l12 8 M${left + w - 6} ${y + 8} l-8 12 l6 8`}
          fill="none"
          stroke={AMBER}
          strokeOpacity="0.85"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
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

/**
 * Two puzzle pieces joined by a beam of light. `gap` is how far apart
 * they still are; `fit` decides whether the tab finally clicks in.
 */
function PuzzlePair({ x, y, gap, fit }: { x: number; y: number; gap: number; fit: boolean | null }) {
  const tilt = fit ? 0 : 14
  return (
    <g>
      <path d={`M${x - 8 - gap} ${y} H${x + 8 + gap}`} stroke={TEAL} strokeOpacity={0.35 + (1 - gap / 14) * 0.4} strokeWidth="1.2" strokeDasharray="2 3" />
      <path
        d={`M${x - 26 - gap} ${y - 9} h10 a4 4 0 1 1 8 0 h4 v18 h-22 z`}
        fill="rgba(184,166,217,0.18)"
        stroke={LAVENDER}
        strokeWidth="1.3"
      />
      <path
        d={`M${x + gap} ${y - 9} h22 v18 h-22 v-6 a4 4 0 0 0 0 -6 z`}
        transform={`rotate(${fit === false ? tilt : 0} ${x + gap + 11} ${y})`}
        fill="rgba(143,227,216,0.14)"
        stroke={TEAL}
        strokeWidth="1.3"
      />
      {fit === true && (
        <path d={`M${x - 6} ${y + 20} l4 4 l8 -9`} fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {fit === false && (
        <path d={`M${x - 5} ${y + 16} l10 10 M${x + 5} ${y + 16} l-10 10`} stroke={CORAL} strokeWidth="2" strokeLinecap="round" />
      )}
    </g>
  )
}

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

/** A faint backup beacon that keeps blinking after the failure. */
function BackupBeacon({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" fill="url(#holo-glow-peach)" />
      <circle cx={x} cy={y} r="2.6" fill={PEACH} />
      <path d={`M${x - 6} ${y - 4} a7 7 0 0 1 12 0 M${x - 10} ${y - 8} a12 12 0 0 1 20 0`} fill="none" stroke={PEACH} strokeOpacity="0.8" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 2 · Cosmic Mail and the Archive                                */
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
      <text x="74" y="230" textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="8" fontWeight="700" letterSpacing="1.5" opacity="0.8">
        EARTH
      </text>
    </Frame>
  )
}

/** Small cyan interstellar-mail glyph built from lines of light. */
function MailGlyph({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle r="30" fill="url(#holo-glow-teal)" />
      <rect x="-18" y="-12" width="36" height="24" rx="3" fill="rgba(143,227,216,0.12)" stroke={TEAL} strokeWidth="1.5" />
      <path d="M-17 -10 L0 3 L17 -10" fill="none" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M-28 -2 h-6 M-28 5 h-10 M28 -2 h6 M28 5 h10" stroke={TEAL} strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  )
}

/**
 * stable: 2 = a small holographic letter, 1 = it unfolds into files,
 * 0 = the connected network, 3 = every node lit, 4 = one link blinks.
 */
function StableScene({ variant }: { variant: number }) {
  if (variant === 2) {
    return (
      <Frame label="A small holographic letter glows in the Cosmic Memory Window." title="COSMIC ARCHIVE">
        <MailGlyph x={160} y={130} scale={1.2} />
      </Frame>
    )
  }
  if (variant === 1) {
    return (
      <Frame label="The holographic letter unfolds into many explorer files." title="COSMIC ARCHIVE">
        <MailGlyph x={160} y={82} scale={0.8} />
        {CARD_X.map((x) => (
          <path key={x} d={`M160 96 L${x} ${CARD_Y - 12}`} stroke={TEAL} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        {CARD_X.map((x, i) => (
          <g key={x} opacity={i === 1 ? 1 : 0.7}>
            <FileCard x={x} y={CARD_Y + (i === 1 ? 0 : 8)} mode="ok" scale={0.9} />
          </g>
        ))}
      </Frame>
    )
  }
  const lit = variant === 3 || variant === 4
  return (
    <Frame label="Many anonymous archive files connected to the Cosmic Archive." title="COSMIC ARCHIVE">
      <ArchiveHub mode={lit ? 'bright' : 'ok'} />
      {[0, 1, 2].map((i) => (
        <LiveLink key={i} index={i} bright={lit} opacity={variant === 4 && i === 0 ? 0.18 : 0.7} />
      ))}
      {CARD_X.map((x) => <FileCard key={x} x={x} mode={lit ? 'glow' : 'ok'} />)}
      {lit && <Tag x={160} y={244} text="ALL LINKS OK" color={TEAL} />}
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 3.1–3.2 · The first anomaly and the spreading fault            */
/* ------------------------------------------------------------------ */

/**
 * losing1: 3 = still connected, 2 = the file flickers, 1 = the link
 * fades with a small yellow flash, 0 = link cut, file in warning yellow.
 */
function Losing1Scene({ variant }: { variant: number }) {
  return (
    <Frame label="One archive file loses its connection: the link fades and breaks, and the file turns yellow with a warning sign." title="COSMIC ARCHIVE">
      <ArchiveHub mode="ok" />
      {variant === 3 && <LiveLink index={0} bright />}
      {variant === 2 && <FadingLink index={0} color={TEAL} strength={0.8} />}
      {variant === 1 && (
        <g>
          <FadingLink index={0} strength={0.2} />
          <circle cx={CARD_X[0]} cy={CARD_Y + 30} r="40" fill="url(#holo-glow-amber)" />
        </g>
      )}
      {variant === 0 && <BrokenLink index={0} color={AMBER} />}
      <LiveLink index={1} />
      <LiveLink index={2} />
      <FileCard x={CARD_X[0]} mode={variant === 3 ? 'glow' : variant === 2 ? 'flicker' : 'warning'} />
      <FileCard x={CARD_X[1]} mode="ok" />
      <FileCard x={CARD_X[2]} mode="ok" />
      {variant === 0 && <Tag x={CARD_X[0]} y={244} text="NO LINK" color={AMBER} />}
    </Frame>
  )
}

/**
 * losing3: 2 = a second link flickers, 1 = two links down, a third
 * fading and the light warming, 0 = every link dark, icons cracking.
 */
function Losing3Scene({ variant }: { variant: number }) {
  return (
    <Frame
      label="More and more archive files lose their connections, one after another. Their icons crack and the projection turns orange."
      title={variant === 0 ? 'CONNECTIONS LOST' : 'COSMIC ARCHIVE'}
      titleColor={variant === 0 ? ORANGE : TEAL}
      tint={variant === 2 ? 'none' : variant === 1 ? 'warm' : 'storm'}
    >
      <ArchiveHub mode={variant === 0 ? 'alert' : 'ok'} />
      <BrokenLink index={0} color={AMBER} spark={variant === 2} />
      {variant === 2 ? <FadingLink index={1} color={TEAL} strength={0.7} /> : <BrokenLink index={1} color={AMBER} spark={variant === 1} />}
      {variant === 0 ? <BrokenLink index={2} color={AMBER} /> : variant === 1 ? <FadingLink index={2} strength={0.4} /> : <LiveLink index={2} />}
      <FileCard x={CARD_X[0]} mode={variant === 0 ? 'cracked' : 'warning'} />
      <FileCard x={CARD_X[1]} mode={variant === 2 ? 'flicker' : variant === 1 ? 'warning' : 'cracked'} />
      <FileCard x={CARD_X[2]} mode={variant === 0 ? 'warning' : variant === 1 ? 'flicker' : 'ok'} />
      {CARD_X.map((x, i) =>
        variant === 0 || (variant === 1 && i < 2) || (variant === 2 && i === 0) ? (
          <Tag key={x} x={x} y={244} text="NO LINK" color={AMBER} />
        ) : null,
      )}
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 3.3 · Solar activity alert                                     */
/* ------------------------------------------------------------------ */

/** Small Sun glyph used in alerts and the split screen. */
function SunGlyph({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.9} fill="url(#holo-corona)" />
      {Array.from({ length: 8 }, (_, k) => {
        const a = (k * Math.PI) / 4
        return (
          <path
            key={k}
            d={`M${x + Math.cos(a) * r * 1.25} ${y + Math.sin(a) * r * 1.25} L${x + Math.cos(a) * r * 1.6} ${y + Math.sin(a) * r * 1.6}`}
            stroke={ORANGE}
            strokeWidth={r / 7}
            strokeLinecap="round"
          />
        )
      })}
      <circle cx={x} cy={y} r={r} fill="url(#holo-sun)" />
    </g>
  )
}

/**
 * solarAlert: 2 = Mailwing runs an automatic diagnostic, 1 = the main
 * alert, 0 = main alert + the Archive status underneath.
 */
function SolarAlertScene({ variant }: { variant: number }) {
  if (variant === 2) {
    return (
      <Frame label="Mailwing runs an automatic diagnostic of its systems." title="AUTO DIAGNOSTIC" tint="warm">
        <g opacity="0.3">
          <ArchiveHub mode="alert" />
          {[0, 1, 2].map((i) => <BrokenLink key={i} index={i} spark={false} color={AMBER} />)}
        </g>
        {['ARCHIVE LINKS', 'SHIP SYSTEMS', 'SPACE WEATHER'].map((row, i) => (
          <g key={row}>
            <text x="74" y={128 + i * 26} fill={CREAM} fontFamily={MONO} fontSize="9" fontWeight="700" letterSpacing="1">
              {row}
            </text>
            <rect x="74" y={133 + i * 26} width="172" height="5" rx="2.5" fill="rgba(253,244,236,0.12)" />
            <rect x="74" y={133 + i * 26} width={[150, 120, 64][i]} height="5" rx="2.5" fill={TEAL} opacity="0.8" />
          </g>
        ))}
        <text x="160" y="222" textAnchor="middle" fill={TEAL} fontFamily={MONO} fontSize="8.5" letterSpacing="1.4">
          CHECKING...
        </text>
      </Frame>
    )
  }
  return (
    <Frame
      label="Alert: Extreme solar activity detected. Cosmic Archive connection unstable."
      title="MAILWING ALERT"
      titleColor={ORANGE}
      tint="storm"
    >
      <SunGlyph x={160} y={98} r={22} />
      <rect x="40" y="134" width="240" height="56" rx="14" fill="rgba(255,162,74,0.16)" stroke={ORANGE} strokeWidth="1.6" />
      <WarnIcon x={64} y={162} size={22} color={ORANGE} />
      <text x="84" y="157" fill={CREAM} fontFamily={FONT} fontSize="13" fontWeight="900" letterSpacing="0.6">
        EXTREME SOLAR
      </text>
      <text x="84" y="175" fill={CREAM} fontFamily={FONT} fontSize="13" fontWeight="900" letterSpacing="0.6">
        ACTIVITY DETECTED
      </text>
      {variant === 0 && <AlertPlate y={212} text="COSMIC ARCHIVE CONNECTION UNSTABLE" color={AMBER} />}
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 3.4 · The solar storm (recorded data, sped up)                 */
/* ------------------------------------------------------------------ */

const SUN = { x: 92, y: 140, r: 40 }

/**
 * The Sun with its corona: magnetic loops anchored on the surface.
 * `activity` 0..2 brightens active regions and raises the loops.
 */
function SolarDisc({ activity }: { activity: number }) {
  const { x, y, r } = SUN
  const loops = [
    { a: -0.45, h: 0.32 },
    { a: 0.2, h: 0.26 },
    { a: 1.25, h: 0.22 },
    { a: 2.4, h: 0.24 },
    { a: -2.1, h: 0.2 },
    { a: 3.2, h: 0.26 },
  ]
  return (
    <g>
      <circle cx={x} cy={y} r={r * (1.7 + activity * 0.15)} fill="url(#holo-corona)" />
      {/* Magnetic field lines: big dashed arcs leaving and re-entering. */}
      {[1.25, 1.55].map((k) => (
        <g key={k} opacity="0.3">
          <path d={`M${x} ${y - r} C${x + r * k * 1.2} ${y - r * k * 1.4} ${x + r * k * 1.6} ${y + r * 0.2} ${x + r * 0.6} ${y + r * 0.8}`} fill="none" stroke={LAVENDER} strokeWidth="1" strokeDasharray="3 4" />
          <path d={`M${x} ${y - r} C${x - r * k * 1.2} ${y - r * k * 1.4} ${x - r * k * 1.6} ${y + r * 0.2} ${x - r * 0.6} ${y + r * 0.8}`} fill="none" stroke={LAVENDER} strokeWidth="1" strokeDasharray="3 4" />
        </g>
      ))}
      {/* Coronal loops: filaments of plasma along the field. */}
      {loops.map((loop, i) => {
        const span = 0.16
        const h = r * (1 + loop.h * 0.45 * (1 + activity * 0.7))
        const p1 = { x: x + Math.cos(loop.a - span) * r * 0.97, y: y + Math.sin(loop.a - span) * r * 0.97 }
        const p2 = { x: x + Math.cos(loop.a + span) * r * 0.97, y: y + Math.sin(loop.a + span) * r * 0.97 }
        const c = { x: x + Math.cos(loop.a) * h * 1.2, y: y + Math.sin(loop.a) * h * 1.2 }
        return (
          <path
            key={i}
            d={`M${p1.x} ${p1.y} Q${c.x} ${c.y} ${p2.x} ${p2.y}`}
            fill="none"
            stroke="#FFC45A"
            strokeOpacity={0.55 + activity * 0.15}
            strokeWidth={1.4 + activity * 0.4}
          />
        )
      })}
      <circle cx={x} cy={y} r={r} fill="url(#holo-sun)" />
      {/* Granulation hint + active regions. */}
      <circle cx={x - 12} cy={y + 10} r="6" fill="#F2742E" opacity="0.35" />
      {activity > 0 && (
        <g>
          <circle cx={x + 22} cy={y - 14} r={6 + activity * 3} fill={SUN_CORE} opacity="0.9" />
          <circle cx={x + 22} cy={y - 14} r={14 + activity * 6} fill="url(#holo-glow-peach)" />
        </g>
      )}
    </g>
  )
}

/**
 * A coronal mass ejection with its classic three parts: a bright
 * leading loop, a darker cavity and a bright core, expanding away from
 * the Sun along the field. `t` 0..1 is how far it has travelled.
 */
function PlasmaCloud({ t }: { t: number }) {
  const { x, y, r } = SUN
  const base = { x: x + r * 0.86, y: y - r * 0.4 }
  const reach = 30 + t * 108
  const width = 16 + t * 44
  const tip = { x: base.x + reach, y: base.y - reach * 0.08 }
  const front = `M${base.x} ${base.y - 6}
    C${base.x + reach * 0.35} ${base.y - width} ${tip.x - width * 0.2} ${tip.y - width} ${tip.x} ${tip.y}
    C${tip.x - width * 0.2} ${tip.y + width} ${base.x + reach * 0.35} ${base.y + width * 0.7} ${base.x + 4} ${base.y + 8}`
  const core = { x: base.x + reach * 0.5, y: base.y - reach * 0.04 }
  return (
    <g>
      <path d={front} fill="url(#holo-plasma)" stroke={PEACH} strokeOpacity="0.85" strokeWidth={2 + t} />
      <path d={front} transform={`translate(${-reach * 0.12} ${reach * 0.03}) scale(1)`} fill="none" stroke={ORANGE} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 4" />
      <ellipse cx={core.x} cy={core.y} rx={6 + t * 10} ry={4 + t * 7} fill="#FFB060" opacity="0.75" />
      <ellipse cx={core.x} cy={core.y} rx={2 + t * 4} ry={2 + t * 3} fill={SUN_CORE} opacity="0.9" />
      {/* Energetic particles streaming ahead of the cloud. */}
      {t > 0.4 &&
        [0, 1, 2, 3, 4, 5].map((k) => (
          <circle key={k} cx={tip.x + 8 + k * 9} cy={tip.y - 14 + ((k * 13) % 30)} r="1.4" fill={PEACH} opacity={0.9 - k * 0.12} />
        ))}
    </g>
  )
}

/** Schematic timeline of a solar storm, highlighting the current step. */
function StormTimeline({ step }: { step: number }) {
  const marks = [
    { x: 74, top: 'FLARE', bottom: 'light: minutes' },
    { x: 160, top: 'PLASMA CLOUD', bottom: 'travels for days' },
    { x: 246, top: 'SIGNALS HIT', bottom: 'links disrupted' },
  ]
  return (
    <g>
      <path d="M74 222 H246" stroke={LAVENDER} strokeOpacity="0.5" strokeWidth="1.2" />
      {marks.map((mark, i) => {
        const on = i <= step
        return (
          <g key={mark.top}>
            <circle cx={mark.x} cy="222" r={on ? 4 : 3} fill={on ? ORANGE : 'none'} stroke={on ? ORANGE : LAVENDER} strokeWidth="1.2" />
            <text x={mark.x} y="214" textAnchor="middle" fill={on ? PEACH : LAVENDER} fontFamily={FONT} fontSize="7" fontWeight="800" letterSpacing="0.8">
              {mark.top}
            </text>
            <text x={mark.x} y="234" textAnchor="middle" fill={CREAM} fillOpacity={on ? 0.8 : 0.4} fontFamily={MONO} fontSize="6.5">
              {mark.bottom}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** "This is recorded data, sped up" chip: no live explosion outside. */
function ReplayChip() {
  return <Tag x={160} y={50} text="RECORDED SOLAR DATA · SPED UP" color={PEACH} />
}

/**
 * solarStorm: 3 = calm Sun, 2 = active surface, 1 = the eruption
 * leaves the Sun, 0 = the plasma cloud spreads into space.
 */
function SolarStormScene({ variant }: { variant: number }) {
  const activity = variant === 3 ? 0 : variant === 2 ? 1 : 2
  const cloud = variant === 1 ? 0.15 : variant === 0 ? 1 : null
  return (
    <Frame
      label="Recorded solar data, sped up: the Sun's surface flares, a coronal mass ejection, a huge cloud of plasma, erupts and spreads into space along magnetic field lines."
      title="SOLAR MONITOR"
      titleColor={ORANGE}
      tint="warm"
    >
      <ReplayChip />
      <SolarDisc activity={activity} />
      {cloud !== null && <PlasmaCloud t={cloud} />}
      {variant === 0 && (
        <text x="196" y="178" textAnchor="middle" fill={PEACH} fontFamily={FONT} fontSize="7.5" fontWeight="800" letterSpacing="0.8">
          CORONAL MASS EJECTION
          <tspan x="196" dy="9" fontFamily={MONO} fontWeight="400" fontSize="6.5" fill={CREAM}>a giant cloud of plasma</tspan>
        </text>
      )}
      <StormTimeline step={variant >= 2 ? 0 : variant === 1 ? 0 : 1} />
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 3.4 · Zoomed out: the communication network                    */
/* ------------------------------------------------------------------ */

const RELAYS = [
  { x: 188, y: 92 },
  { x: 232, y: 128 },
  { x: 196, y: 168 },
  { x: 252, y: 196 },
  { x: 214, y: 214 },
] as const
const ARCHIVE_NODE = { x: 266, y: 150 }

/** A relay station: teal dish (OK) or orange ring with "!" (affected). */
function RelayNode({ x, y, affected }: { x: number; y: number; affected: boolean }) {
  return affected ? (
    <g>
      <circle cx={x} cy={y} r="11" fill="url(#holo-glow-orange)" />
      <circle cx={x} cy={y} r="6" fill="rgba(255,162,74,0.2)" stroke={ORANGE} strokeWidth="1.4" />
      <path d={`M${x} ${y - 3} v3.5`} stroke={ORANGE} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={x} cy={y + 2.6} r="0.9" fill={ORANGE} />
    </g>
  ) : (
    <g>
      <circle cx={x} cy={y} r="9" fill="url(#holo-glow-teal)" />
      <path d={`M${x - 5} ${y - 1} a5 5 0 0 0 10 0 z`} fill="rgba(143,227,216,0.25)" stroke={TEAL} strokeWidth="1.2" />
      <path d={`M${x} ${y + 3} v3 M${x - 3} ${y + 6} h6`} stroke={TEAL} strokeWidth="1" />
    </g>
  )
}

/**
 * stormImpact: the projection zooms out. 3 = the cloud leaves the Sun
 * and the network is fine, 2 = it reaches the first relays, 1 = more
 * relays turn orange and links flicker, 0 = the Archive link is hit.
 */
function StormImpactScene({ variant }: { variant: number }) {
  const hit = [0, 2, 3, 5][3 - variant] ?? 5
  const cloudX = [70, 120, 160, 176][3 - variant] ?? 176
  const linkPairs: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [1, 2],
    [2, 4],
    [3, 4],
    [1, 3],
  ]
  const affected = (index: number) => index < hit
  return (
    <Frame
      label="Zoomed out: the plasma cloud and energetic particles reach the communication network. Relay stations turn from blue to orange and the links to the Cosmic Archive flicker."
      title="COMMUNICATION NETWORK"
      titleColor={variant === 3 ? TEAL : ORANGE}
      tint={variant === 0 ? 'storm' : 'warm'}
    >
      <ReplayChip />
      {/* Far away Sun on the left edge. */}
      <SunGlyph x={50} y={150} r={13} />
      {/* The expanding cloud as a wide arc front with particles. */}
      <path
        d={`M${cloudX - 20} ${150 - 72} Q${cloudX + 22} 150 ${cloudX - 20} ${150 + 72}`}
        fill="none"
        stroke={PEACH}
        strokeOpacity="0.8"
        strokeWidth="2.2"
      />
      <path
        d={`M${cloudX - 34} ${150 - 64} Q${cloudX + 4} 150 ${cloudX - 34} ${150 + 64}`}
        fill="none"
        stroke={ORANGE}
        strokeOpacity="0.4"
        strokeWidth="1.2"
        strokeDasharray="3 4"
      />
      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
        <circle key={k} cx={cloudX - 6 - (k % 3) * 9} cy={96 + k * 18} r="1.3" fill={PEACH} opacity="0.85" />
      ))}
      {/* Network links. */}
      {linkPairs.map(([a, b]) => {
        const p = RELAYS[a]!
        const q = RELAYS[b]!
        const bad = affected(a) || affected(b)
        return (
          <path
            key={`${a}-${b}`}
            d={`M${p.x} ${p.y} L${q.x} ${q.y}`}
            stroke={bad ? ORANGE : TEAL}
            strokeOpacity={bad ? 0.55 : 0.6}
            strokeWidth="1.2"
            strokeDasharray={bad && variant <= 1 ? '3 5' : undefined}
          />
        )
      })}
      {RELAYS.slice(1, 4).map((p, i) => (
        <path
          key={i}
          d={`M${p.x} ${p.y} L${ARCHIVE_NODE.x} ${ARCHIVE_NODE.y}`}
          stroke={variant === 0 ? CORAL : TEAL}
          strokeOpacity={variant === 0 ? 0.45 : 0.5}
          strokeWidth="1.2"
          strokeDasharray={variant === 0 ? '2 6' : '4 3'}
        />
      ))}
      {RELAYS.map((p, i) => <RelayNode key={i} x={p.x} y={p.y} affected={affected(i)} />)}
      {/* The Archive node. */}
      <g>
        <circle cx={ARCHIVE_NODE.x} cy={ARCHIVE_NODE.y} r="12" fill="rgba(143,227,216,0.12)" stroke={variant === 0 ? CORAL : PEACH} strokeWidth="1.5" strokeDasharray={variant === 0 ? '3 3' : undefined} />
        {variant === 0 ? <WarnIcon x={ARCHIVE_NODE.x} y={ARCHIVE_NODE.y} size={11} color={CORAL} /> : <circle cx={ARCHIVE_NODE.x} cy={ARCHIVE_NODE.y} r="4" fill={TEAL} />}
        <text x={ARCHIVE_NODE.x} y={ARCHIVE_NODE.y + 24} textAnchor="middle" fill={variant === 0 ? CORAL : TEAL} fontFamily={FONT} fontSize="7" fontWeight="800" letterSpacing="0.8">
          ARCHIVE
        </text>
      </g>
      {/* Legend: shape + word, not colour alone. */}
      <g>
        <RelayNode x={92} y={236} affected={false} />
        <text x="104" y="239" fill={TEAL} fontFamily={MONO} fontSize="7">OK</text>
        <RelayNode x={136} y={236} affected />
        <text x="148" y="239" fill={ORANGE} fontFamily={MONO} fontSize="7">AFFECTED {Math.min(hit, 5)}/5</text>
      </g>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 3.5 · How the Archive was damaged (split screen)               */
/* ------------------------------------------------------------------ */

/**
 * syncError: left, the solar activity; right, the Archive in the middle
 * of a memory sync. 3 = sync running, 2 = the storm reaches it and data
 * errors appear, 1 = link lost, 0 = sync interrupted to protect the data.
 */
function SyncErrorScene({ variant }: { variant: number }) {
  const progress = variant === 3 ? 0.42 : 0.64
  const errors = variant <= 2
  return (
    <Frame
      label="Left: the Sun's activity. Right: the Cosmic Archive while it updates its memories. The storm reaches the link; data errors appear and the Archive pauses the update to protect the files."
      title="WHAT HAPPENED"
      titleColor={ORANGE}
      tint={variant === 3 ? 'warm' : 'storm'}
    >
      {/* Divider and panel labels. */}
      <path d="M160 52 V196" stroke={LAVENDER} strokeOpacity="0.35" strokeDasharray="2 4" />
      <text x="92" y="60" textAnchor="middle" fill={PEACH} fontFamily={FONT} fontSize="7.5" fontWeight="800" letterSpacing="1">
        SOLAR ACTIVITY
      </text>
      <text x="228" y="60" textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="7.5" fontWeight="800" letterSpacing="1">
        ARCHIVE SYNC
      </text>
      {/* Left: Sun + cloud heading right. */}
      <SunGlyph x={76} y={120} r={20} />
      <path d="M108 104 Q128 120 108 136" fill="none" stroke={PEACH} strokeWidth="2" strokeOpacity="0.85" />
      <path d="M118 98 Q142 120 118 142" fill="none" stroke={ORANGE} strokeWidth="1.2" strokeOpacity="0.5" strokeDasharray="3 4" />
      {/* Storm energy crossing into the Archive panel. */}
      {variant <= 2 && (
        <path d="M134 116 l10 -6 l-2 10 l12 -4 l-8 12 l10 -2" fill="none" stroke={AMBER} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {/* Right: Archive hub syncing files. */}
      <circle cx="228" cy="100" r="15" fill="rgba(143,227,216,0.1)" stroke={variant <= 1 ? CORAL : TEAL} strokeWidth="1.5" strokeDasharray={variant <= 1 ? '3 3' : undefined} />
      {variant <= 1 ? <WarnIcon x={228} y={100} size={12} color={CORAL} /> : <circle cx="228" cy="100" r="4.5" fill={TEAL} />}
      {[196, 228, 260].map((x, i) => (
        <g key={x}>
          <path d={`M228 115 L${x} 140`} stroke={TEAL} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="3 3" />
          {/* Data packets travelling to the files; some arrive broken. */}
          {errors && i !== 1 ? (
            <text x={(228 + x) / 2} y="131" textAnchor="middle" fill={CORAL} fontFamily={FONT} fontSize="9" fontWeight="900">×</text>
          ) : (
            <rect x={(228 + x) / 2 - 2.5} y="125" width="5" height="5" fill={TEAL} />
          )}
          <rect x={x - 11} y="142" width="22" height="26" rx="2" fill="rgba(253,244,236,0.1)" stroke={errors && i !== 1 ? AMBER : '#F2DDB4'} strokeWidth="1.1" />
          <path d={`M${x - 7} 150 h14 M${x - 7} 157 h9`} stroke={CREAM} strokeOpacity="0.6" strokeWidth="1" strokeDasharray={errors && i !== 1 ? '4 3' : undefined} />
        </g>
      ))}
      {/* Sync progress bar. */}
      <rect x="182" y="180" width="92" height="6" rx="3" fill="rgba(253,244,236,0.12)" />
      <rect x="182" y="180" width={92 * progress} height="6" rx="3" fill={variant === 0 ? AMBER : TEAL} />
      <text x="228" y="196" textAnchor="middle" fill={variant === 0 ? AMBER : TEAL} fontFamily={MONO} fontSize="6.5" letterSpacing="0.6">
        {variant === 0 ? '❚❚ PAUSED TO PROTECT DATA' : `UPDATING MEMORIES ${Math.round(progress * 100)}%`}
      </text>
      {/* Warnings appear one at a time; the newest is the primary plate. */}
      {variant === 1 && <AlertPlate y={222} text="COMMUNICATION LINK LOST" primary />}
      {variant === 0 && (
        <g>
          <AlertPlate y={214} text="ARCHIVE SYNC INTERRUPTED" primary />
          <AlertPlate y={238} text="COMMUNICATION LINK LOST" color={ORANGE} />
        </g>
      )}
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 3.5–3.6 · Incomplete records and the failed recovery           */
/* ------------------------------------------------------------------ */

/** fragmented: 1 = cracks spread, 0 = some files split into pieces. */
function FragmentedScene({ variant }: { variant: number }) {
  return (
    <Frame
      label="Some archive files break into geometric pieces; one stays partly readable. Warning: memory records incomplete."
      title="ARCHIVE FAULT"
      titleColor={CORAL}
      tint="warm"
    >
      <ArchiveHub mode="alert" />
      {[0, 1, 2].map((i) => <BrokenLink key={i} index={i} spark={false} />)}
      {variant === 1 ? (
        CARD_X.map((x) => <FileCard key={x} x={x} mode="cracked" />)
      ) : (
        <g>
          <FileCard x={CARD_X[0]} mode="broken" />
          <FileCard x={CARD_X[1]} mode="partial" />
          <FileCard x={CARD_X[2]} mode="broken" />
          <Shards />
        </g>
      )}
      {variant === 0 && <AlertPlate y={54} text="MEMORY RECORDS INCOMPLETE" color={CORAL} primary />}
    </Frame>
  )
}

/**
 * recovering: 2 = beams of light reach for the pieces, 1 = they draw
 * closer, 0 = one pair clicks, the others do not fit.
 */
function RecoveringScene({ variant }: { variant: number }) {
  const gap = variant === 2 ? 8 : variant === 1 ? 4 : 1
  return (
    <Frame label="The Archive tries to join the pieces with beams of light. One pair fits; the others do not fit together." title="RECONNECTING...">
      <ArchiveHub mode="alert" />
      <circle cx={HUB.x} cy={HUB.y} r="31" fill="none" stroke={LAVENDER} strokeOpacity="0.6" strokeWidth="1.2" strokeDasharray="2 6" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={linkPath(i)} fill="none" stroke={variant === 0 && i !== 1 ? LAVENDER : TEAL} strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray="3 6" />
      ))}
      {CARD_X.map((x, i) => (
        <PuzzlePair key={x} x={x} y={CARD_Y + 22} gap={i === 1 ? gap : Math.max(gap, 3)} fit={variant === 0 ? i === 1 : null} />
      ))}
      {variant === 0 && (
        <g>
          <Tag x={CARD_X[0]} y={222} text="NO FIT" color={CORAL} />
          <Tag x={CARD_X[1]} y={222} text="PARTIAL" color={TEAL} />
          <Tag x={CARD_X[2]} y={222} text="NO FIT" color={CORAL} />
        </g>
      )}
    </Frame>
  )
}

/**
 * offline: 1 = the central link flickers out, 0 = recovery failed, the
 * files are marked incomplete — but two backup signals still blink.
 */
function OfflineScene({ variant }: { variant: number }) {
  return (
    <Frame
      label="Recovery attempt failed. The central link is offline for now and the files are marked incomplete or no access, but two backup signals still blink."
      title="ARCHIVE OFFLINE"
      titleColor={LAVENDER}
      tint="warm"
    >
      {variant === 1 && <ArchiveHub mode="alert" />}
      {CARD_X.map((x) => <FileCard key={x} x={x} y={CARD_Y - 12} mode="dim" />)}
      {variant === 0 && (
        <g>
          <Tag x={CARD_X[0]} y={146} text="INCOMPLETE" color={LAVENDER} />
          <Tag x={CARD_X[1]} y={146} text="NO ACCESS" color={LAVENDER} />
          <Tag x={CARD_X[2]} y={146} text="INCOMPLETE" color={LAVENDER} />
          <AlertPlate y={70} x={160} text="RECOVERY ATTEMPT FAILED" color={CORAL} primary />
          <Tag x={160} y={100} text="CENTRAL LINK OFFLINE · FOR NOW" color={LAVENDER} />
          <BackupBeacon x={110} y={234} />
          <BackupBeacon x={210} y={234} />
          <text x="160" y="238" textAnchor="middle" fill={PEACH} fontFamily={MONO} fontSize="7" letterSpacing="0.8">
            BACKUP SIGNALS
          </text>
        </g>
      )}
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 3.7 · PIP is affected                                          */
/* ------------------------------------------------------------------ */

function MemoryScene({ variant }: { variant: number }) {
  // PIP's own memory banks (the visor outline) with missing records.
  const slots = [
    [0, 0, true], [1, 0, false], [2, 0, true],
    [0, 1, false], [1, 1, true], [2, 1, false],
    [0, 2, true], [1, 2, false], [2, 2, false],
  ] as const
  const scanning = variant === 1
  return (
    <Frame label="PIP's own memory banks: some record slots are complete, others are fragmented." title="PIP MEMORY">
      <ellipse cx="160" cy="146" rx="96" ry="78" fill="rgba(143,227,216,0.06)" stroke={PEACH} strokeOpacity="0.7" strokeWidth="2" />
      <ellipse cx="160" cy="146" rx="84" ry="66" fill="none" stroke={TEAL} strokeOpacity="0.35" strokeWidth="1" />
      {slots.map(([col, row, filled]) => {
        const x = 112 + col * 34
        const y = 106 + row * 28
        if (scanning) {
          return <rect key={`${col}-${row}`} x={x} y={y} width="26" height="20" rx="3" fill="rgba(253,244,236,0.06)" stroke={LAVENDER} strokeOpacity="0.5" strokeWidth="1" />
        }
        return filled ? (
          <g key={`${col}-${row}`}>
            <rect x={x} y={y} width="26" height="20" rx="3" fill="rgba(143,227,216,0.22)" stroke={TEAL} strokeWidth="1.2" />
            <path d={`M${x + 5} ${y + 7} h16 M${x + 5} ${y + 13} h10`} stroke={TEAL} strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ) : (
          <g key={`${col}-${row}`}>
            <rect x={x} y={y} width="26" height="20" rx="3" fill="none" stroke={CORAL} strokeOpacity="0.7" strokeWidth="1.2" strokeDasharray="3 3" />
            <text x={x + 13} y={y + 15} textAnchor="middle" fill={CORAL} fontFamily={FONT} fontSize="11" fontWeight="800" opacity="0.85">?</text>
          </g>
        )
      })}
      {scanning && <rect x="70" y="126" width="180" height="4" fill={TEAL} opacity="0.5" />}
      <text x="160" y="240" textAnchor="middle" fill={scanning ? TEAL : CORAL} fontFamily={MONO} fontSize="8" opacity="0.8">
        {scanning ? 'CHECKING MEMORY...' : '5 / 9 RECORDS FRAGMENTED'}
      </text>
    </Frame>
  )
}

function ForgottenScene() {
  return (
    <Frame label="Explorer files whose discoveries PIP cannot remember: question marks where the records were." title="DISCOVERIES ?">
      <ArchiveHub mode="off" />
      {CARD_X.map((x) => <FileCard key={x} x={x} y={CARD_Y - 10} mode="missing" scale={1.1} />)}
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 4 · The last signals                                           */
/* ------------------------------------------------------------------ */

/**
 * A schematic inner solar system (not to scale): the Sun on the left,
 * Earth with the Moon, and Mars further out. The two signal areas come
 * from the game's destinations, so they always match the real missions.
 */
const SOLAR_MAP = {
  sun: { x: 56, y: 214 },
  earth: { x: 122, y: 168 },
  moon: { x: 150, y: 142 },
  mars: { x: 228, y: 92 },
  ship: { x: 96, y: 140 },
} as const

/** Which side of the signal zone its words sit on, to keep labels apart. */
const LABEL_SIDE: Record<string, 'right' | 'below'> = { moon: 'right', mars: 'below' }

function SolarSystemMap() {
  const { sun, earth, moon, mars } = SOLAR_MAP
  const earthOrbit = Math.hypot(earth.x - sun.x, earth.y - sun.y)
  const marsOrbit = Math.hypot(mars.x - sun.x, mars.y - sun.y)
  return (
    <g>
      <circle cx={sun.x} cy={sun.y} r={earthOrbit} fill="none" stroke={TEAL} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 5" />
      <circle cx={sun.x} cy={sun.y} r={marsOrbit} fill="none" stroke={TEAL} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 5" />
      <SunGlyph x={sun.x} y={sun.y} r={10} />
      <circle cx={earth.x} cy={earth.y} r="8" fill="rgba(90,170,220,0.5)" stroke={TEAL} strokeWidth="1.2" />
      <path d={`M${earth.x - 4} ${earth.y - 2} q3 -3 6 0 M${earth.x - 3} ${earth.y + 3} q3 2 6 -1`} fill="none" stroke="#9BE3A8" strokeWidth="1.2" strokeLinecap="round" />
      <text x={earth.x} y={earth.y + 19} textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="7" fontWeight="800" letterSpacing="0.8">EARTH</text>
      <circle cx={moon.x} cy={moon.y} r="3.6" fill="#D9C7C2" opacity="0.9" />
      <circle cx={mars.x} cy={mars.y} r="6" fill="#E07A4F" opacity="0.9" />
      <text x="160" y="250" textAnchor="middle" fill={LAVENDER} fontFamily={MONO} fontSize="6.5" opacity="0.8">MAP NOT TO SCALE</text>
    </g>
  )
}

/** Approximate signal area: a dashed zone, never an exact point. */
function SignalArea({
  x,
  y,
  name,
  pending,
  side,
}: {
  x: number
  y: number
  name: string
  pending: boolean
  side: 'right' | 'below'
}) {
  const tx = side === 'right' ? x + 20 : x
  const ty = side === 'right' ? y - 3 : y + 27
  const anchor = side === 'right' ? 'start' : 'middle'
  return (
    <g>
      <circle cx={x} cy={y} r="20" fill="url(#holo-glow-peach)" />
      <circle cx={x} cy={y} r="14" fill="none" stroke={PEACH} strokeOpacity="0.85" strokeWidth="1.3" strokeDasharray="4 3" />
      <path d={`M${x + 8} ${y - 16} a8 8 0 0 1 8 8 M${x + 10} ${y - 22} a14 14 0 0 1 12 12`} fill="none" stroke={PEACH} strokeWidth="1.2" strokeLinecap="round" />
      <text x={tx} y={ty} textAnchor={anchor} fill={PEACH} fontFamily={FONT} fontSize="8" fontWeight="800" letterSpacing="0.8">
        {name.toUpperCase()}
      </text>
      <text x={tx} y={ty + 9} textAnchor={anchor} fill={CREAM} fillOpacity="0.8" fontFamily={MONO} fontSize="6.5">
        approx. signal
      </text>
      {pending && (
        <text x={tx} y={ty + 18} textAnchor={anchor} fill={AMBER} fontFamily={MONO} fontSize="6.5" fontWeight="700">
          ◷ PENDING
        </text>
      )}
    </g>
  )
}

function signalAreas(): Array<{ id: string; name: string; x: number; y: number; side: 'right' | 'below' }> {
  return DESTINATIONS.map((destination) => {
    const anchor = destination.id === 'moon' ? SOLAR_MAP.moon : SOLAR_MAP.mars
    return {
      id: destination.id,
      name: destination.name,
      x: anchor.x,
      y: anchor.y,
      side: LABEL_SIDE[destination.id] ?? 'below',
    }
  })
}

/** locations: 2 = the map alone, 1 = the first signal, 0 = both signals. */
function LocationsScene({ variant }: { variant: number }) {
  const areas = signalAreas()
  const shown = variant === 2 ? 0 : variant === 1 ? 1 : areas.length
  return (
    <Frame label="A map of the inner solar system: two approximate signal areas light up, one near the Moon and one near Mars." title="LAST SIGNALS" titleColor={PEACH}>
      <SolarSystemMap />
      {areas.slice(0, shown).map((area) => (
        <SignalArea key={area.id} x={area.x} y={area.y} name={area.name} side={area.side} pending={false} />
      ))}
    </Frame>
  )
}

/** route: 1 = the routes start to draw, 0 = Mailwing linked to both. */
function RouteScene({ variant }: { variant: number }) {
  const ship = SOLAR_MAP.ship
  return (
    <Frame label="Dotted routes reach from Mailwing toward the two approximate signal areas, both marked pending." title="SET A COURSE" titleColor={PEACH}>
      <SolarSystemMap />
      {signalAreas().map((area) => (
        <g key={area.id}>
          <path
            d={`M${ship.x + 6} ${ship.y - 8} Q${(ship.x + area.x) / 2} ${Math.min(ship.y, area.y) - 34} ${area.x - 12} ${area.y - 6}`}
            fill="none"
            stroke={PEACH}
            strokeOpacity="0.8"
            strokeWidth="1.5"
            strokeDasharray={variant === 1 ? '5 14' : '5 5'}
          />
          <SignalArea x={area.x} y={area.y} name={area.name} side={area.side} pending />
        </g>
      ))}
      <g transform={`translate(${ship.x} ${ship.y})`}>
        <circle r="14" fill="url(#holo-glow-teal)" />
        <path d="M0 -10 C5 -5 6 2 4 7 H-4 C-6 2 -5 -5 0 -10 z" fill="rgba(143,227,216,0.25)" stroke={TEAL} strokeWidth="1.4" />
        <path d="M-4 3 l-5 5 h5 M4 3 l5 5 h-5" fill="none" stroke={TEAL} strokeWidth="1.2" />
        <text y="22" textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="6.5" fontWeight="800" letterSpacing="0.8">MAILWING</text>
      </g>
    </Frame>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 5 · The invitation                                             */
/* ------------------------------------------------------------------ */

function DossierScene() {
  // Many incomplete files whose signals went quiet.
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

/** Anonymous explorer outline: a generic probe, never a real machine. */
function ExplorerSilhouette({ x, y }: { x: number; y: number }) {
  return (
    <g opacity="0.85">
      <circle cx={x} cy={y} r="22" fill="rgba(184,166,217,0.12)" stroke={LAVENDER} strokeOpacity="0.6" strokeDasharray="3 3" />
      <rect x={x - 8} y={y - 4} width="16" height="12" rx="2" fill="none" stroke={LAVENDER} strokeWidth="1.3" />
      <path d={`M${x} ${y - 4} v-6 M${x - 5} ${y - 14} a6 6 0 0 0 10 0`} fill="none" stroke={LAVENDER} strokeWidth="1.3" strokeLinecap="round" />
      <path d={`M${x - 8} ${y + 8} l-5 6 M${x + 8} ${y + 8} l5 6`} stroke={LAVENDER} strokeWidth="1.3" strokeLinecap="round" />
      <text x={x} y={y + 6} textAnchor="middle" fill={LAVENDER} fontFamily={FONT} fontSize="9" fontWeight="900">?</text>
    </g>
  )
}

/** "This is how missions work": the demo is never real progress. */
function PreviewChip() {
  return <Tag x={160} y={50} text="PREVIEW · HOW A MISSION WORKS" color={TEAL} />
}

const DOSSIER_FIELDS = ['EXPLORER', 'DISCOVERY', 'STORY'] as const

/**
 * The incomplete file at the heart of the demo. `stage`: 0 = data
 * missing, 1 = being scanned, 2 = rebuilt.
 */
function DemoDossier({ stage }: { stage: 0 | 1 | 2 }) {
  return (
    <g>
      <rect x="86" y="62" width="148" height="140" rx="8" fill="rgba(253,244,236,0.08)" stroke={stage === 2 ? PEACH : LAVENDER} strokeWidth="1.5" />
      <ExplorerSilhouette x={124} y={100} />
      <text x="156" y="90" fill={CREAM} fontFamily={MONO} fontSize="7" opacity="0.8">FILE</text>
      <path d="M156 98 h56 M156 108 h40" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.2" />
      {DOSSIER_FIELDS.map((field, i) => {
        const y = 140 + i * 20
        return (
          <g key={field}>
            <text x="98" y={y} fill={CREAM} fontFamily={MONO} fontSize="7" opacity="0.85">{field}</text>
            {stage === 2 ? (
              <g>
                <path d={`M160 ${y - 3} h${40 + i * 6}`} stroke={PEACH} strokeWidth="2" strokeLinecap="round" />
                <path d={`M214 ${y - 5} l3 3 l6 -6`} fill="none" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" />
              </g>
            ) : (
              <g>
                <rect x="158" y={y - 9} width="62" height="11" rx="2" fill="none" stroke={LAVENDER} strokeOpacity="0.7" strokeDasharray="3 3" />
                <text x="189" y={y - 1} textAnchor="middle" fill={LAVENDER} fontFamily={FONT} fontSize="8" fontWeight="800">???</text>
              </g>
            )}
          </g>
        )
      })}
      {stage === 1 && (
        <g>
          <rect x="86" y="150" width="148" height="6" fill={TEAL} opacity="0.55" />
          <rect x="86" y="140" width="148" height="26" fill="url(#holo-glow-teal)" opacity="0.6" />
        </g>
      )}
    </g>
  )
}

/** Earth icon used as the letter's destination. */
function EarthIcon({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.6} fill="url(#holo-glow-teal)" />
      <circle cx={x} cy={y} r={r} fill="rgba(90,170,220,0.4)" stroke={TEAL} strokeWidth="1.3" />
      <path d={`M${x - r * 0.6} ${y - r * 0.3} q${r * 0.4} -${r * 0.35} ${r * 0.8} 0 M${x - r * 0.5} ${y + r * 0.35} q${r * 0.5} ${r * 0.25} ${r} -${r * 0.15}`} fill="none" stroke="#9BE3A8" strokeWidth="1.4" strokeLinecap="round" />
      <text x={x} y={y + r + 13} textAnchor="middle" fill={TEAL} fontFamily={FONT} fontSize="7" fontWeight="800" letterSpacing="0.8">EARTH</text>
    </g>
  )
}

function SmartLetterGlyph({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle r="34" fill="url(#holo-glow-peach)" />
      <rect x="-26" y="-17" width="52" height="35" rx="5" fill="url(#holo-envelope)" stroke={PEACH} strokeWidth="1.4" />
      <path d="M-25 -14 L0 4 L25 -14" fill="none" stroke="#8C6D3F" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="0" cy="10" r="5" fill={CORAL} opacity="0.85" />
    </g>
  )
}

/**
 * letter (demo of the future mechanic): 4 = incomplete file, 3 = scan,
 * 2 = data rebuilt, 1 = it folds into a smart letter, 0 = the letter
 * travels toward Earth. 5 = the invitation: letters still waiting.
 */
function LetterDemoScene({ variant }: { variant: number }) {
  if (variant >= 2) {
    const stage = variant === 4 ? 0 : variant === 3 ? 1 : 2
    return (
      <Frame label="Preview of a mission: an incomplete explorer file with missing data is scanned and its data is rebuilt." title={stage === 2 ? 'MEMORY REBUILT' : 'INCOMPLETE FILE'} titleColor={stage === 2 ? PEACH : LAVENDER}>
        <PreviewChip />
        <DemoDossier stage={stage} />
        {stage === 1 && <Tag x={160} y={222} text="SCANNING..." color={TEAL} />}
      </Frame>
    )
  }
  return (
    <Frame label="Preview of a mission: the rebuilt file becomes a glowing smart letter that travels home toward Earth." title="SMART LETTER" titleColor={PEACH}>
      <PreviewChip />
      <path d="M96 150 C150 70 214 80 252 132" fill="none" stroke={PEACH} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="4 5" />
      <EarthIcon x={252} y={150} />
      {variant === 1 ? <SmartLetterGlyph x={110} y={150} /> : <SmartLetterGlyph x={196} y={96} scale={0.8} />}
      {variant === 0 && (
        <text x="160" y="214" textAnchor="middle" fill={PEACH} fontFamily={FONT} fontSize="8.5" fontWeight="800" letterSpacing="1.2">
          SENDING THE STORY HOME
        </text>
      )}
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
          <text x={x + 9} y={221} fill={LAVENDER} fontFamily={FONT} fontSize="9" fontWeight="800">?</text>
        </g>
      ))}

      <path d="M66 70 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill={PEACH} opacity="0.9" />
      <path d="M256 78 l1.6 4.6 4.6 1.6 -4.6 1.6 -1.6 4.6 -1.6 -4.6 -4.6 -1.6 4.6 -1.6z" fill="#F4B4DF" opacity="0.85" />
    </svg>
  )
}

/** The Archive projection for a beat (every state except 'none'). */
export function ArchiveBoard({ state, variant = 0 }: { state: IntroHologramState; variant?: number }) {
  switch (state) {
    case 'mail':
      return <MailScene />
    case 'stable':
      return <StableScene variant={variant} />
    case 'losing1':
      return <Losing1Scene variant={variant} />
    case 'losing3':
      return <Losing3Scene variant={variant} />
    case 'solarAlert':
      return <SolarAlertScene variant={variant} />
    case 'solarStorm':
      return <SolarStormScene variant={variant} />
    case 'stormImpact':
      return <StormImpactScene variant={variant} />
    case 'syncError':
      return <SyncErrorScene variant={variant} />
    case 'fragmented':
      return <FragmentedScene variant={variant} />
    case 'recovering':
      return <RecoveringScene variant={variant} />
    case 'offline':
      return <OfflineScene variant={variant} />
    case 'memory':
      return <MemoryScene variant={variant} />
    case 'forgotten':
      return <ForgottenScene />
    case 'locations':
      return <LocationsScene variant={variant} />
    case 'route':
      return <RouteScene variant={variant} />
    case 'dossier':
      return <DossierScene />
    case 'letter':
      return variant === 5 ? <EnvelopeHologram facing /> : <LetterDemoScene variant={variant} />
    default:
      return <DossierScene />
  }
}

/* ------------------------------------------------------------------ */
/* PIP's own small side holograms                                       */
/* ------------------------------------------------------------------ */

/**
 * Small panel PIP projects beside himself (240x150). The diagnostic
 * shows Mailwing reading the solar monitor; the memory check lists
 * which of PIP's memory units survived.
 */
export function PipPanelHologram({ panel }: { panel: IntroPipPanel }) {
  const rows =
    panel === 'diagnostic'
      ? [
          { label: 'SOLAR ACTIVITY', status: 'EXTREME', ok: false },
          { label: 'ARCHIVE LINK', status: 'UNSTABLE', ok: false },
          { label: 'MAILWING', status: 'SAFE', ok: true },
        ]
      : [
          { label: 'EXPLORER NAMES', status: 'OK', ok: true },
          { label: 'SIGNAL PLACES', status: 'OK', ok: true },
          { label: 'DISCOVERIES', status: 'FRAGMENTED', ok: false },
          { label: 'STORIES', status: 'FRAGMENTED', ok: false },
        ]
  const title = panel === 'diagnostic' ? 'MAILWING DIAGNOSTIC' : 'PIP MEMORY CHECK'
  return (
    <svg viewBox="0 0 240 150" width="240" height="150" role="img" aria-label={`${title}: ${rows.map((row) => `${row.label} ${row.status}`).join(', ')}`}>
      <rect x="3" y="3" width="234" height="144" rx="14" fill="rgba(20,14,40,0.55)" stroke={panel === 'diagnostic' ? ORANGE : TEAL} strokeOpacity="0.8" strokeWidth="2" />
      <text x="120" y="28" textAnchor="middle" fill={panel === 'diagnostic' ? ORANGE : TEAL} fontFamily={FONT} fontSize="13" fontWeight="900" letterSpacing="1.4">
        {title}
      </text>
      {rows.map((row, i) => {
        const y = 54 + i * (panel === 'diagnostic' ? 30 : 23)
        return (
          <g key={row.label}>
            <text x="18" y={y} fill={CREAM} fontFamily={MONO} fontSize="10.5" fontWeight="700">
              {row.label}
            </text>
            {row.ok ? (
              <path d={`M${222 - labelWidth(row.status, 11.2, 0.4) - 20} ${y - 4} l3 3 l6 -7`} fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
            ) : (
              <WarnIcon x={222 - labelWidth(row.status, 11.2, 0.4) - 14} y={y - 3.5} size={10} color={panel === 'diagnostic' ? ORANGE : CORAL} />
            )}
            <text x="222" y={y} textAnchor="end" fill={row.ok ? TEAL : panel === 'diagnostic' ? ORANGE : CORAL} fontFamily={FONT} fontSize="10.5" fontWeight="900" letterSpacing="0.4">
              {row.status}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
