/**
 * Procedural hologram visuals for the cinematic intro — generated in
 * code (SVG + CSS animation), no image files. Planets use the
 * approved Cosmic Mail palette (see ZONES accents): pale Moon,
 * rust Mars, lavender deep space. Deep space has no planet, only
 * stars and a probe on an orbit path.
 */

export type DestinationKind = 'moon' | 'mars' | 'deep'

const STARS: ReadonlyArray<{ cx: number; cy: number; r: number; delay: string }> = [
  { cx: 14, cy: 18, r: 1.4, delay: '0s' },
  { cx: 30, cy: 10, r: 1, delay: '0.6s' },
  { cx: 52, cy: 16, r: 1.5, delay: '1.1s' },
  { cx: 78, cy: 12, r: 1.1, delay: '0.3s' },
  { cx: 102, cy: 20, r: 1.6, delay: '1.6s' },
  { cx: 20, cy: 44, r: 1.1, delay: '1.9s' },
  { cx: 100, cy: 52, r: 1, delay: '0.9s' },
  { cx: 12, cy: 82, r: 1.3, delay: '1.4s' },
  { cx: 88, cy: 96, r: 1.2, delay: '0.2s' },
  { cx: 40, cy: 104, r: 1, delay: '2.2s' },
]

function StarField() {
  return (
    <g aria-hidden="true">
      {STARS.map((star, index) => (
        <circle
          key={index}
          className="holo-star"
          cx={star.cx}
          cy={star.cy}
          r={star.r}
          fill="#FDF4EC"
          style={{ animationDelay: star.delay }}
        />
      ))}
    </g>
  )
}

export function HoloDestination({ kind, label }: { kind: DestinationKind; label: string }) {
  return (
    <svg className="holo-scene" viewBox="0 0 120 120" role="img" aria-label={label}>
      <defs>
        <radialGradient id={`holo-${kind}-body`} cx="35%" cy="30%" r="80%">
          {kind === 'moon' && (
            <>
              <stop offset="0%" stopColor="#F5EFE4" />
              <stop offset="55%" stopColor="#CFC7BA" />
              <stop offset="100%" stopColor="#8D867A" />
            </>
          )}
          {kind === 'mars' && (
            <>
              <stop offset="0%" stopColor="#FFDDB4" />
              <stop offset="45%" stopColor="#F2B28C" />
              <stop offset="100%" stopColor="#B85C38" />
            </>
          )}
        </radialGradient>
        <radialGradient id={`holo-${kind}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#8FE3D8" stopOpacity="0" />
          <stop offset="100%" stopColor="#8FE3D8" stopOpacity="0.35" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="60" r="52" fill={`url(#holo-${kind}-glow)`} />
      <StarField />

      {kind !== 'deep' && (
        <g className="holo-float">
          <circle cx="60" cy="62" r="34" fill={`url(#holo-${kind}-body)`} />
          {kind === 'moon' && (
            <g fill="rgba(60,52,44,0.28)">
              <circle cx="48" cy="52" r="6" />
              <circle cx="70" cy="66" r="8" />
              <circle cx="56" cy="78" r="4" />
              <circle cx="76" cy="48" r="3.5" />
            </g>
          )}
          {kind === 'mars' && (
            <g>
              <ellipse cx="60" cy="34" rx="16" ry="6" fill="rgba(253,244,236,0.85)" />
              <path d="M36 62 Q52 54 66 62 T94 60 Q88 78 64 82 T40 76 Z" fill="rgba(122,52,30,0.35)" />
              <circle cx="78" cy="52" r="3" fill="rgba(122,52,30,0.3)" />
              <circle cx="50" cy="74" r="2.4" fill="rgba(122,52,30,0.3)" />
            </g>
          )}
          <ellipse className="holo-shine" cx="60" cy="62" rx="34" ry="12" fill="rgba(255,255,255,0.12)" />
          <circle cx="60" cy="62" r="34" fill="none" stroke="#8FE3D8" strokeOpacity="0.55" strokeWidth="1.2" />
        </g>
      )}

      {kind === 'deep' && (
        <g>
          <ellipse cx="60" cy="60" rx="44" ry="20" fill="none" stroke="#B8A6D9" strokeOpacity="0.7" strokeDasharray="3 5" />
          <ellipse cx="60" cy="60" rx="28" ry="11" fill="none" stroke="#8FE3D8" strokeOpacity="0.45" strokeDasharray="2 4" />
          <g className="holo-orbit">
            <circle cx="104" cy="60" r="3.2" fill="#FDF4EC" />
            <path d="M104 60 l-7 -3 l2 5 z" fill="#F4B4DF" />
          </g>
          <circle cx="60" cy="60" r="5" fill="#B8A6D9" />
          <circle cx="60" cy="60" r="9" fill="none" stroke="#B8A6D9" strokeOpacity="0.5" />
          <text x="60" y="104" textAnchor="middle" fontSize="7" fill="#B8A6D9" letterSpacing="2">
            VOYAGER
          </text>
        </g>
      )}
    </svg>
  )
}

/**
 * Totally invented generic rover silhouette for the "forgotten"
 * moment — a narrative stand-in, not a specific NASA mission. Its
 * status light starts lit, dies, and a warm rim light remains.
 */
export function RoverSilhouette() {
  const wheels = [
    { cx: 58, cy: 126 },
    { cx: 110, cy: 134 },
    { cx: 162, cy: 126 },
  ]
  return (
    <svg className="holo-scene holo-scene--rover" viewBox="0 0 220 160" role="img" aria-label="A quiet forgotten rover">
      <defs>
        <linearGradient id="holo-rover-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B5A80" />
          <stop offset="100%" stopColor="#33284A" />
        </linearGradient>
        <radialGradient id="holo-rover-wheel" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#4A3E60" />
          <stop offset="100%" stopColor="#1E1730" />
        </radialGradient>
      </defs>

      {/* soft shadow + dusty ground */}
      <ellipse cx="110" cy="146" rx="80" ry="9" fill="#000000" opacity="0.32" />
      <path d="M12 140 H208" stroke="#8FE3D8" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 6" />
      <path d="M18 140 l8-6 8 6z M192 140 l7-5 7 5z" fill="#241A33" stroke="#8FE3D8" strokeOpacity="0.25" />

      {/* rocker-bogie suspension */}
      <path d="M74 102 L58 126 M110 102 L110 134 M146 102 L162 126 M58 126 L84 118 L110 134 M110 134 L136 118 L162 126"
        stroke="#CFC7BA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />

      {/* wheels with hubs and spokes */}
      {wheels.map((wheel) => (
        <g key={wheel.cx}>
          <circle cx={wheel.cx} cy={wheel.cy} r="14" fill="url(#holo-rover-wheel)" stroke="#CFC7BA" strokeWidth="3" />
          <path
            d={`M${wheel.cx - 9} ${wheel.cy} H${wheel.cx + 9} M${wheel.cx} ${wheel.cy - 9} V${wheel.cy + 9} M${wheel.cx - 6.4} ${wheel.cy - 6.4} L${wheel.cx + 6.4} ${wheel.cy + 6.4} M${wheel.cx + 6.4} ${wheel.cy - 6.4} L${wheel.cx - 6.4} ${wheel.cy + 6.4}`}
            stroke="#8FE3D8" strokeOpacity="0.45" strokeWidth="1.4"
          />
          <circle cx={wheel.cx} cy={wheel.cy} r="4" fill="#8FE3D8" opacity="0.85" />
        </g>
      ))}

      {/* hull + deck + solar panel */}
      <rect x="58" y="74" width="104" height="30" rx="9" fill="url(#holo-rover-body)" stroke="#8FE3D8" strokeOpacity="0.55" strokeWidth="1.5" />
      <rect x="72" y="60" width="76" height="16" rx="6" fill="#463A5C" stroke="#8FE3D8" strokeOpacity="0.4" />
      <rect x="78" y="64" width="64" height="8" fill="none" stroke="#8FE3D8" strokeOpacity="0.35" />
      <path d="M94 64 V72 M110 64 V72 M126 64 V72" stroke="#8FE3D8" strokeOpacity="0.35" />
      <circle cx="66" cy="82" r="2.4" fill="#8FE3D8" opacity="0.7" />
      <rect x="118" y="84" width="34" height="6" rx="3" fill="#241A33" opacity="0.8" />

      {/* science arm with scoop (front-left) */}
      <path d="M64 98 L40 114 L27 110" stroke="#CFC7BA" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M27 110 l-8 4 6 6 8-4z" fill="#463A5C" stroke="#8FE3D8" strokeOpacity="0.4" />

      {/* mast + camera head + dish antenna */}
      <path d="M138 60 L154 24" stroke="#CFC7BA" strokeWidth="4" strokeLinecap="round" />
      <path d="M176 6 a11 11 0 0 1 10 12" fill="none" stroke="#CFC7BA" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="136" y="10" width="42" height="20" rx="5" fill="url(#holo-rover-body)" stroke="#8FE3D8" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="148" cy="20" r="3.2" fill="#F4B4DF" />
      <circle cx="160" cy="20" r="3.2" fill="#F4B4DF" />
      {/* status light: lit, then dies (CSS animation) */}
      <circle className="rover-light" cx="170" cy="20" r="2.8" fill="#FFD9A8" />

      {/* warm rim light that stays */}
      <path d="M58 78 q-5 10 0 24" stroke="#FFD9A8" strokeOpacity="0.8" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M138 16 q-4 8 0 12" stroke="#FFD9A8" strokeOpacity="0.6" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** The little holographic letter, floating over the console. */
export function EnvelopeHologram({ facing }: { facing: boolean }) {
  return (
    <svg className={`holo-scene holo-scene--envelope${facing ? ' is-facing' : ''}`} viewBox="0 0 140 110" role="img" aria-label="A glowing letter for a forgotten explorer">
      <defs>
        <linearGradient id="holo-envelope" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3DC" />
          <stop offset="100%" stopColor="#F2DDB4" />
        </linearGradient>
      </defs>
      <ellipse cx="70" cy="96" rx="36" ry="6" fill="#8FE3D8" opacity="0.18" />
      <g className="holo-float">
        <rect x="28" y="30" width="84" height="56" rx="8" fill="url(#holo-envelope)" stroke="#B8A6D9" strokeOpacity="0.8" strokeWidth="1.5" />
        <path d="M30 34 L70 62 L110 34" fill="none" stroke="#8C6D3F" strokeWidth="2" strokeLinecap="round" />
        <circle cx="70" cy="66" r="4" fill="#B8A6D9" />
        <path d="M70 66 l0 10 M66 72 h8" stroke="#B8A6D9" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <path d="M20 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFD9A8" className="holo-star" />
      <path d="M118 22 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="#F4B4DF" className="holo-star" style={{ animationDelay: '1.2s' }} />
    </svg>
  )
}

const SPIRIT_STARS: ReadonlyArray<{ x: number; y: number; label: string }> = [
  { x: 80, y: 30, label: 'Brave' },
  { x: 118, y: 58, label: 'Observant' },
  { x: 96, y: 96, label: 'Methodical' },
  { x: 48, y: 96, label: 'Careful' },
  { x: 28, y: 58, label: 'Reflective' },
]

/** The five-star spirit constellation (equal weight, no result yet). */
export function SpiritConstellation() {
  return (
    <svg className="holo-scene holo-scene--constellation" viewBox="0 0 150 120" role="img" aria-label="A constellation of five explorer spirits">
      <path
        className="constellation-lines"
        d="M80 30 L118 58 L96 96 L48 96 L28 58 Z"
        fill="none"
        stroke="#8FE3D8"
        strokeOpacity="0.55"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <path d="M80 30 L96 96 M118 58 L48 96 M28 58 L96 96" stroke="#B8A6D9" strokeOpacity="0.3" strokeWidth="0.8" />
      {SPIRIT_STARS.map((star, index) => (
        <g key={star.label}>
          <circle className="holo-star" cx={star.x} cy={star.y} r="4.5" fill="#FFD9A8" style={{ animationDelay: `${index * 0.45}s` }} />
          <circle cx={star.x} cy={star.y} r="8" fill="none" stroke="#FFD9A8" strokeOpacity="0.35" />
          <text x={star.x} y={star.y - 12} textAnchor="middle" fontSize="7.5" fill="#FDF4EC" letterSpacing="0.5">
            {star.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
