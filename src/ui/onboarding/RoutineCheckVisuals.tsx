import type { TraitId } from '../../data/personalization'

/**
 * Holographic dioramas for the Routine Check: one small imaginary
 * scene per question, projected inside the Cosmic Memory Window.
 * Pure presentation — focusing an option only lights the matching
 * element; it never records a vote. Visual state resets when the
 * focus changes (no accumulated effects).
 */

export interface RoutineVisualState {
  questionId: string
  focusedOptionId: string | null
  confirmedOptionId: string | null
}

function DioramaShell({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <svg className="routine-diorama" viewBox="0 0 320 200" role="img" aria-label={label}>
      {children}
    </svg>
  )
}

const STARS = [
  { cx: 42, cy: 30, r: 1.4, d: '0s' },
  { cx: 88, cy: 18, r: 1.1, d: '0.7s' },
  { cx: 150, cy: 26, r: 1.5, d: '1.2s' },
  { cx: 214, cy: 16, r: 1.2, d: '0.4s' },
  { cx: 272, cy: 34, r: 1.4, d: '1.7s' },
  { cx: 118, cy: 44, r: 1, d: '2s' },
  { cx: 250, cy: 58, r: 1.1, d: '1s' },
]

function StarField() {
  return (
    <g aria-hidden="true">
      {STARS.map((s, i) => (
        <circle key={i} className="holo-star" cx={s.cx} cy={s.cy} r={s.r} fill="#FDF4EC" style={{ animationDelay: s.d }} />
      ))}
    </g>
  )
}

/** Trait glyphs as thin-stroke hologram icons (no emojis). */
export function TraitSigil({ trait, className }: { trait: TraitId; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  }
  switch (trait) {
    case 'brave':
      return (
        <svg {...common}>
          <path d="M12 2.5c2.2 4.2 5 6.2 5 10a5 5 0 0 1-10 0c0-2.1 1-3.6 2.1-5.1.5 1.4 1.4 2 2.1 2.1-.6-2.1-.1-4.6.8-7z" />
        </svg>
      )
    case 'observant':
      return (
        <svg {...common}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'methodical':
      return (
        <svg {...common}>
          <rect x="5" y="3.5" width="14" height="17" rx="2" />
          <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
        </svg>
      )
    case 'careful':
      return (
        <svg {...common}>
          <path d="M12 2.8 5 5.2v6.1c0 4.6 3 7.7 7 9.4 4-1.7 7-4.8 7-9.4V5.2z" />
          <path d="M9 11.6l2.2 2.2L15.4 9.6" />
        </svg>
      )
    case 'reflective':
      return (
        <svg {...common}>
          <path d="M12 3l2.2 5.3L20 9.2l-4.2 3.9 1.2 5.9L12 16.2 7 19l1.2-5.9L4 9.2l5.8-.9z" />
        </svg>
      )
  }
}

/* ------------------------------------------------------------------ */
/* Q1 — First Wonder: night sky, path, star, backpack, route           */
/* ------------------------------------------------------------------ */

export function FirstWonderDiorama({ focusedOptionId, confirmedOptionId }: RoutineVisualState) {
  const focus = confirmedOptionId ?? focusedOptionId
  return (
    <DioramaShell label="A mysterious night sky with a glowing star and a dark path">
      <StarField />
      <path d="M30 168 Q120 150 160 128 T290 96" fill="none" stroke="#8FE3D8" strokeWidth="3" strokeLinecap="round"
        className={`diorama-path${focus === 'wonder-path' ? ' is-lit' : ''}`} />
      <path d="M30 168 Q120 150 160 128 T290 96" fill="none" stroke="#8FE3D8" strokeWidth="1" strokeDasharray="2 6" opacity="0.5" />
      {/* backpack */}
      <g className={`diorama-backpack${focus === 'wonder-check' ? ' is-lit' : ''}`}>
        <rect x="58" y="132" width="30" height="34" rx="7" fill="#33284A" stroke="#CFC7BA" strokeWidth="1.6" />
        <rect x="64" y="120" width="18" height="14" rx="5" fill="#463A5C" stroke="#CFC7BA" strokeWidth="1.4" />
        <path d="M64 146h18" stroke="#8FE3D8" strokeOpacity="0.6" />
      </g>
      {/* brightest star */}
      <g className={`diorama-star${focus === 'wonder-stars' ? ' is-lit' : ''}`}>
        <circle cx="196" cy="62" r="16" fill="#FFD9A8" opacity="0.16" />
        <path d="M196 48l3.4 9.6L209 61l-9.6 3.4L196 74l-3.4-9.6L183 61l9.6-3.4z" fill="#FFD9A8" />
      </g>
      {/* planned route */}
      <path className={`diorama-route${focus === 'wonder-plan' ? ' is-lit' : ''}`}
        d="M70 150 Q130 118 176 84" fill="none" stroke="#F4B4DF" strokeWidth="2" strokeDasharray="5 5" />
      {/* question constellation */}
      <g className={`diorama-meaning${focus === 'wonder-meaning' ? ' is-lit' : ''}`} stroke="#B8A6D9" fill="none">
        <path d="M248 44 L264 60 L254 78 L238 66 Z" strokeWidth="1.2" strokeDasharray="3 3" />
        <text x="251" y="67" textAnchor="middle" fontSize="16" fill="#B8A6D9" stroke="none" fontWeight="700">?</text>
      </g>
    </DioramaShell>
  )
}

/* ------------------------------------------------------------------ */
/* Q2 — A Small Mystery: Mars ground + fictional door                  */
/* ------------------------------------------------------------------ */

export function SmallMysteryDiorama({ focusedOptionId, confirmedOptionId }: RoutineVisualState) {
  const focus = confirmedOptionId ?? focusedOptionId
  return (
    <DioramaShell label="A small mysterious door on rocky Mars ground">
      <path d="M0 168 Q160 148 320 168 L320 200 L0 200 Z" fill="#5A3626" opacity="0.85" />
      <path d="M0 168 Q160 148 320 168" fill="none" stroke="#F2B28C" strokeOpacity="0.5" strokeWidth="2" />
      <path d="M42 150 l14-8 12 9z M236 158 l16-9 13 10z M96 178 l12-6 10 7z" fill="#3A241A" />
      {/* footprints */}
      <g className={`diorama-clues${focus === 'mystery-clues' ? ' is-lit' : ''}`} fill="#FFD9A8">
        <ellipse cx="118" cy="162" rx="5" ry="3" />
        <ellipse cx="136" cy="154" rx="5" ry="3" />
        <ellipse cx="154" cy="147" rx="5" ry="3" />
        <circle cx="176" cy="140" r="2.6" />
      </g>
      {/* steps */}
      <g className={`diorama-steps${focus === 'mystery-steps' ? ' is-lit' : ''}`} fontSize="11" fontWeight="700" textAnchor="middle">
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <circle cx={96 + i * 26} cy={186 - i * 2} r="8" fill="none" stroke="#8FE3D8" strokeWidth="1.4" />
            <text x={96 + i * 26} y={190 - i * 2} fill="#8FE3D8">{i + 1}</text>
          </g>
        ))}
      </g>
      {/* perimeter */}
      <ellipse className={`diorama-perimeter${focus === 'mystery-protect' ? ' is-lit' : ''}`}
        cx="208" cy="118" rx="52" ry="38" fill="none" stroke="#8FE3D8" strokeWidth="1.6" strokeDasharray="4 5" />
      {/* the door */}
      <g className={`diorama-door${focus === 'mystery-open' ? ' is-open' : ''}${focus === 'mystery-think' ? ' is-dim' : ''}`}>
        <rect x="182" y="78" width="52" height="78" rx="6" fill="#463A5C" stroke="#CFC7BA" strokeWidth="2" />
        <path className="diorama-door-panel" d="M186 82 h44 v70 h-44z" fill="#33284A" stroke="#8FE3D8" strokeOpacity="0.6" />
        <circle cx="222" cy="116" r="3.4" fill="#FFD9A8" />
        <path d="M208 78 v78" stroke="#8FE3D8" strokeOpacity="0.35" />
      </g>
    </DioramaShell>
  )
}

/* ------------------------------------------------------------------ */
/* Q3 — A New Friend: small lost robot                                  */
/* ------------------------------------------------------------------ */

export function NewFriendDiorama({ focusedOptionId, confirmedOptionId }: RoutineVisualState) {
  const focus = confirmedOptionId ?? focusedOptionId
  return (
    <DioramaShell label="A small lost robot on a round patch of ground">
      <ellipse cx="160" cy="176" rx="110" ry="20" fill="#33284A" opacity="0.85" />
      <ellipse cx="160" cy="176" rx="110" ry="20" fill="none" stroke="#8FE3D8" strokeOpacity="0.4" />
      {/* orientation beacons */}
      <path d="M36 168 v-22 M284 168 v-22" stroke="#8FE3D8" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx="36" cy="144" r="3" fill="#8FE3D8" opacity="0.7" />
      <circle cx="284" cy="144" r="3" fill="#8FE3D8" opacity="0.7" />
      {/* guide route */}
      <path className={`diorama-route${focus === 'friend-guide' ? ' is-lit' : ''}`}
        d="M120 170 Q160 150 196 158" fill="none" stroke="#8FE3D8" strokeWidth="2.4" strokeDasharray="5 5" strokeLinecap="round" />
      {/* planned map */}
      <g className={`diorama-map${focus === 'friend-route' ? ' is-lit' : ''}`}>
        <rect x="216" y="66" width="52" height="38" rx="5" fill="none" stroke="#F4B4DF" strokeWidth="1.6" />
        <path d="M222 76 h40 M222 86 h28 M222 96 h34" stroke="#F4B4DF" strokeOpacity="0.7" />
        <circle cx="256" cy="92" r="3" fill="#F4B4DF" />
      </g>
      {/* signal waves */}
      <g className={`diorama-signal${focus === 'friend-signal' ? ' is-lit' : ''}`} fill="none" stroke="#FFD9A8" strokeWidth="2" strokeLinecap="round">
        <path d="M186 96 a20 20 0 0 1 0 26" />
        <path d="M196 88 a32 32 0 0 1 0 42" />
        <path d="M206 80 a44 44 0 0 1 0 58" />
      </g>
      {/* the little robot */}
      <g className={`diorama-robot${focus === 'friend-story' ? ' is-turned' : ''}`}>
        <rect x="132" y="104" width="56" height="48" rx="12" fill="#E8E2D8" stroke="#B8A6D9" strokeWidth="1.8" />
        <circle cx="160" cy="92" r="10" fill="#E8E2D8" stroke="#B8A6D9" strokeWidth="1.8" />
        <path d="M160 82 v-8" stroke="#B8A6D9" strokeWidth="2" strokeLinecap="round" />
        <circle cx="160" cy="71" r="3" fill="#F4B4DF" />
        <circle cx="150" cy="92" r="3.4" fill="#17172E" />
        <circle cx="170" cy="92" r="3.4" fill="#17172E" />
        {focus === 'friend-hug' ? (
          <path d="M150 106 q10 8 20 0" fill="none" stroke="#17172E" strokeWidth="2.4" strokeLinecap="round" />
        ) : (
          <circle cx="160" cy="106" r="3" fill="#17172E" />
        )}
        <path d="M126 118 h-8 M194 118 h8" stroke="#B8A6D9" strokeWidth="3" strokeLinecap="round" />
        <path d="M146 152 v10 M174 152 v10" stroke="#B8A6D9" strokeWidth="4" strokeLinecap="round" />
        <circle cx="160" cy="128" r="4" fill="#8FE3D8" opacity="0.85" />
      </g>
    </DioramaShell>
  )
}

/* ------------------------------------------------------------------ */
/* Q4 — Your Dream: ship, letter, orbit                                 */
/* ------------------------------------------------------------------ */

export function YourDreamDiorama({ focusedOptionId, confirmedOptionId }: RoutineVisualState) {
  const focus = confirmedOptionId ?? focusedOptionId
  return (
    <DioramaShell label="A small ship carrying a glowing letter along an orbit">
      <StarField />
      <path d="M40 150 Q160 190 290 110" fill="none" stroke="#8FE3D8" strokeOpacity="0.4" strokeDasharray="3 6" />
      <path className={`diorama-route${focus === 'dream-invention' ? ' is-lit' : ''}`}
        d="M40 150 Q160 190 290 110" fill="none" stroke="#8FE3D8" strokeWidth="2.2" strokeDasharray="5 5" />
      {/* hidden secret point */}
      <circle className={`diorama-secret${focus === 'dream-secret' ? ' is-lit' : ''}`} cx="238" cy="66" r="5" fill="#F4B4DF" opacity="0.35" />
      {/* connected stars */}
      <g className={`diorama-meaning${focus === 'dream-meaning' ? ' is-lit' : ''}`} stroke="#FFD9A8" fill="#FFD9A8">
        <path d="M70 60 L100 44 L128 58 M100 44 L112 76 M128 58 L150 40" strokeWidth="1" opacity="0.8" />
        <circle cx="70" cy="60" r="3" stroke="none" />
        <circle cx="100" cy="44" r="3" stroke="none" />
        <circle cx="128" cy="58" r="3" stroke="none" />
        <circle cx="112" cy="76" r="3" stroke="none" />
        <circle cx="150" cy="40" r="3" stroke="none" />
      </g>
      {/* ship */}
      <g className={`diorama-ship${focus === 'dream-first' ? ' is-advanced' : ''}`}>
        <path d="M84 118 q26 -26 52 -4 l10 6 -24 8 q-22 6 -38 -10z" fill="#E8E2D8" stroke="#B8A6D9" strokeWidth="1.8" />
        <circle cx="112" cy="116" r="5" fill="#8FE3D8" opacity="0.9" />
        <path d="M84 118 l-16 8 10 6z" fill="#F4B4DF" opacity="0.85" />
      </g>
      {/* letter */}
      <g className={`diorama-letter${focus === 'dream-letter' ? ' is-lit' : ''}`}>
        <rect x="196" y="112" width="42" height="28" rx="4" fill="#FFF3DC" stroke="#B8A6D9" strokeWidth="1.6" />
        <path d="M198 116 L217 128 L236 116" fill="none" stroke="#8C6D3F" strokeWidth="1.6" />
      </g>
    </DioramaShell>
  )
}

/** Thin-stroke icon for the hero's power (shown in the explorer card). */
export function AbilityIcon({ trait, className }: { trait: TraitId; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  }
  switch (trait) {
    case 'brave':
      // Second Chance: a loop arrow.
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <path d="M20 3.5V8h-4.5" />
        </svg>
      )
    case 'observant':
      // Explorer Vision: an eye.
      return (
        <svg {...common}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'methodical':
      // Mission Plan: a checklist.
      return (
        <svg {...common}>
          <path d="M4 6.5l2 2 3-3.5" />
          <path d="M4 13l2 2 3-3.5" />
          <path d="M4 19.5l2 2 3-3.5" />
          <path d="M13 7h7M13 14h7M13 20h5" />
        </svg>
      )
    case 'careful':
      // Safety Check: a shield with a warning mark.
      return (
        <svg {...common}>
          <path d="M12 2.8 5 5.2v6.1c0 4.6 3 7.7 7 9.4 4-1.7 7-4.8 7-9.4V5.2z" />
          <path d="M12 8.5v4" />
          <circle cx="12" cy="15.6" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'reflective':
      // Time to Think: a clock.
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.2 2" />
        </svg>
      )
  }
}

/** Generic stylized portrait silhouette for hero cards (no photos). */
export function HeroPortrait({ name, accent }: { name: string; accent: string }) {
  return (
    <svg className="hero-portrait" viewBox="0 0 100 100" role="img" aria-label={`Stylized portrait of ${name}`}>
      <defs>
        <radialGradient id="hero-portrait-glow" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="46" r="38" fill="url(#hero-portrait-glow)" />
      <circle cx="50" cy="42" r="17" fill="#3A2F4E" stroke={accent} strokeWidth="2" />
      <path d="M50 24 a17 17 0 0 1 17 17 l-4 0 a13 13 0 0 0-26 0 l-4 0 a17 17 0 0 1 17-17z" fill="#241A33" />
      <path d="M24 88 q4-26 26-26 t26 26z" fill="#3A2F4E" stroke={accent} strokeWidth="2" />
      <circle cx="50" cy="70" r="4" fill={accent} />
    </svg>
  )
}
