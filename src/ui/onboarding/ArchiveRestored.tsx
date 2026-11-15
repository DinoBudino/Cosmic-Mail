import { useEffect, useMemo, useRef, useState } from 'react'
import { pipLine } from '../../data/pipVoiceCatalog'
import { emitAudio } from '../../game/audio/audioEvents'
import { speakPip, stopPipVoice } from '../../game/pipVoice'
import { useGameStore } from '../../store/gameStore'
import { useJourneyStore } from '../../store/journeyStore'
import { keepsakeDataFor } from '../keepsakeData'
import { downloadKeepsake, drawCertificate, drawPostcard } from '../keepsakes'
import { PipAvatar } from '../PipSpeech'
import './archiveRestored.css'

/**
 * The end of the journey: "The Archive lights up". It plays in the cabin,
 * right after the last story reaches Earth, as a real-time scene (SVG and
 * canvas, no video):
 *
 *   wake → files → memory → name → keepsakes
 *
 * It answers the intro: there, the Cosmic Archive's files went dark one by
 * one after the solar storm and PIP lost some of his memories. Here every
 * explorer's file lights up again, the links come back, PIP remembers, the
 * child's name is written in stars and they become a Master Carrier, with a
 * certificate and a postcard from PIP to download.
 */
type Beat = 'wake' | 'files' | 'memory' | 'name' | 'keepsakes'

/** When each beat starts (ms) and the PIP line it plays. */
const TIMELINE: readonly { beat: Beat; at: number; line: string }[] = [
  { beat: 'wake', at: 400, line: 'finale-wake' },
  { beat: 'files', at: 4300, line: 'finale-files' },
  { beat: 'memory', at: 10200, line: 'finale-memory' },
  { beat: 'name', at: 15600, line: 'finale-thanks' },
  { beat: 'keepsakes', at: 22000, line: 'finale-keepsake' },
]
const BEATS: readonly Beat[] = ['wake', 'files', 'memory', 'name', 'keepsakes']

const TEAL = '#8FE3D8'
const PEACH = '#FFD9A8'
const CREAM = '#FDF4EC'
const LAVENDER = '#B8A6D9'
const ORANGE = '#FF8A22'

// Hologram layout (viewBox 0 0 800 460): the Archive hub, five explorer
// files on an arc and Earth on the right.
const HUB = { x: 400, y: 92 }
const EARTH = { x: 700, y: 120 }
const CARDS = [
  { x: 120, y: 300 },
  { x: 260, y: 330 },
  { x: 400, y: 342 },
  { x: 540, y: 330 },
  { x: 680, y: 300 },
] as const

function linkPath(i: number): string {
  const c = CARDS[i]!
  return `M${HUB.x} ${HUB.y + 30} C${HUB.x} ${HUB.y + 120} ${c.x} ${c.y - 120} ${c.x} ${c.y - 44}`
}

function ArchiveHologram({ beat, names, worlds, elapsed }: { beat: Beat; names: string[]; worlds: string[]; elapsed: number }) {
  const step = BEATS.indexOf(beat)
  const filesStart = TIMELINE[1]!.at
  const lit = (i: number) => step > 1 || (step === 1 && elapsed - filesStart > 700 + i * 900)
  const hubOn = step >= 1
  const allOn = step >= 2
  return (
    <svg className="restored__holo" viewBox="0 0 800 460" role="img" aria-label="The Cosmic Archive reconnects every explorer's file">
      <defs>
        <radialGradient id="rs-glow-teal" cx="50%" cy="50%" r="50%">
          <stop offset="20%" stopColor={TEAL} stopOpacity="0.55" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rs-glow-peach" cx="50%" cy="50%" r="50%">
          <stop offset="20%" stopColor={PEACH} stopOpacity="0.6" />
          <stop offset="100%" stopColor={PEACH} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rs-earth" cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#bfe3ff" />
          <stop offset="100%" stopColor="#2a3fa8" />
        </radialGradient>
      </defs>
      <circle cx={400} cy={230} r={226} fill="none" stroke={LAVENDER} strokeOpacity="0.2" />
      <circle cx={400} cy={230} r={190} fill="none" stroke={TEAL} strokeOpacity="0.12" strokeDasharray="3 9" />
      <text x={400} y={34} textAnchor="middle" className="restored__caption">
        COSMIC ARCHIVE
      </text>

      {/* links from the hub to each file */}
      {CARDS.map((_, i) => (
        <path
          key={i}
          d={linkPath(i)}
          pathLength={1}
          className={`restored__link${lit(i) ? ' is-on' : ''}`}
          stroke={lit(i) ? TEAL : LAVENDER}
        />
      ))}
      {CARDS.map((c, i) =>
        lit(i) ? (
          <circle key={`pulse-${i}`} r="4" fill={TEAL} className="restored__pulse">
            <animateMotion dur={`${1.6 + i * 0.15}s`} repeatCount="indefinite" path={linkPath(i)} />
          </circle>
        ) : (
          <circle key={`pulse-${i}`} cx={c.x} cy={c.y} r="0" />
        ),
      )}

      {/* link to Earth: the files are home */}
      <path
        d={`M${HUB.x + 30} ${HUB.y} Q ${(HUB.x + EARTH.x) / 2} ${HUB.y - 60} ${EARTH.x - 40} ${EARTH.y}`}
        pathLength={1}
        className={`restored__link restored__link--earth${allOn ? ' is-on' : ''}`}
        stroke={PEACH}
      />
      <g className={`restored__earth${allOn ? ' is-on' : ''}`}>
        <circle cx={EARTH.x} cy={EARTH.y} r={58} fill="url(#rs-glow-teal)" />
        <circle cx={EARTH.x} cy={EARTH.y} r={34} fill="url(#rs-earth)" />
        <path d={`M${EARTH.x - 16} ${EARTH.y - 6} q 10 -14 22 -2 q 8 10 18 2`} fill="none" stroke="#6fd28a" strokeWidth="6" strokeLinecap="round" />
        <text x={EARTH.x} y={EARTH.y + 58} textAnchor="middle" className="restored__tag">
          EARTH
        </text>
      </g>

      {/* the hub */}
      <g className={`restored__hub${hubOn ? ' is-on' : ''}${allOn ? ' is-bright' : ''}`}>
        <circle cx={HUB.x} cy={HUB.y} r={allOn ? 70 : 52} fill="url(#rs-glow-teal)" />
        <circle cx={HUB.x} cy={HUB.y} r={32} fill="none" stroke={PEACH} strokeWidth="2.4" strokeOpacity="0.8" />
        <circle cx={HUB.x} cy={HUB.y} r={20} fill="rgba(143,227,216,0.12)" stroke={hubOn ? TEAL : LAVENDER} strokeWidth="2" strokeDasharray={hubOn ? undefined : '4 5'} />
        <circle cx={HUB.x} cy={HUB.y} r={hubOn ? (allOn ? 9 : 7) : 0} fill={TEAL} />
      </g>

      {/* the five explorer files */}
      {CARDS.map((c, i) => {
        const on = lit(i)
        return (
          <g key={i} className={`restored__card${on ? ' is-on' : ''}`} style={{ transformOrigin: `${c.x}px ${c.y}px` }}>
            {on && <circle cx={c.x} cy={c.y} r={62} fill="url(#rs-glow-peach)" />}
            <rect x={c.x - 46} y={c.y - 44} width={92} height={104} rx={8} fill={on ? 'rgba(255,217,168,0.16)' : 'rgba(253,244,236,0.05)'} stroke={on ? PEACH : LAVENDER} strokeWidth={on ? 2.4 : 1.4} strokeDasharray={on ? undefined : '5 5'} />
            <circle cx={c.x} cy={c.y - 14} r={17} fill="none" stroke={on ? PEACH : LAVENDER} strokeWidth="1.6" />
            <path
              d={`M${c.x} ${c.y - 25} l3 6.5 7 .8 -5.2 4.8 1.4 7 -6.2 -3.5 -6.2 3.5 1.4 -7 -5.2 -4.8 7 -.8 z`}
              fill={on ? PEACH : LAVENDER}
              opacity={on ? 1 : 0.5}
            />
            <text x={c.x} y={c.y + 22} textAnchor="middle" className="restored__name" fill={on ? CREAM : LAVENDER}>
              {on ? names[i] : '?'}
            </text>
            <text x={c.x} y={c.y + 44} textAnchor="middle" className="restored__world" fill={on ? ORANGE : LAVENDER}>
              {on ? worlds[i]!.toUpperCase() : ''}
            </text>
          </g>
        )
      })}
      {allOn && (
        <g className="restored__ok">
          <rect x={330} y={170} width={140} height={30} rx={15} fill="rgba(143,227,216,0.16)" stroke={TEAL} />
          <text x={400} y={190} textAnchor="middle" className="restored__tag" fill={TEAL}>
            ALL LINKS OK
          </text>
        </g>
      )}
    </svg>
  )
}

/** The child's name written in stars that appear and join like a constellation. */
function NameConstellation({ name, reducedMotion }: { name: string; reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = 1200
    const H = 300
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Sample the name's letters on a grid: each sample becomes a star.
    const probe = document.createElement('canvas')
    probe.width = W
    probe.height = H
    const p = probe.getContext('2d')!
    let size = 210
    p.font = `900 ${size}px 'Inter', 'Segoe UI', system-ui, sans-serif`
    while (p.measureText(name).width > W - 80 && size > 60) {
      size -= 10
      p.font = `900 ${size}px 'Inter', 'Segoe UI', system-ui, sans-serif`
    }
    p.textAlign = 'center'
    p.textBaseline = 'middle'
    p.fillStyle = '#fff'
    p.fillText(name, W / 2, H / 2)
    const data = p.getImageData(0, 0, W, H).data
    const step = Math.max(9, Math.round(size / 16))
    const stars: { x: number; y: number; at: number; r: number }[] = []
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3]! > 128) {
          const jitter = ((x * 13 + y * 7) % 5) - 2
          stars.push({ x: x + jitter, y: y - jitter, at: (x / W) * 1600 + ((x + y) % 7) * 40, r: 1.6 + ((x + y) % 3) * 0.7 })
        }
      }
    }
    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const t = reducedMotion ? 99999 : now - start
      ctx.clearRect(0, 0, W, H)
      // faint lines between close neighbours: the constellation
      ctx.strokeStyle = 'rgba(255,217,168,0.28)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let i = 0; i < stars.length; i += 1) {
        const a = stars[i]!
        if (t < a.at + 300) continue
        for (let j = i + 1; j < Math.min(stars.length, i + 6); j += 1) {
          const b = stars[j]!
          if (t < b.at + 300) continue
          if (Math.hypot(a.x - b.x, a.y - b.y) < step * 1.6) {
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
          }
        }
      }
      ctx.stroke()
      for (const s of stars) {
        const k = Math.min(1, Math.max(0, (t - s.at) / 350))
        if (k <= 0) continue
        const twinkle = 0.75 + 0.25 * Math.sin(now / 220 + s.x)
        ctx.fillStyle = `rgba(255,236,200,${k * twinkle})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * (1 + (1 - k) * 2), 0, Math.PI * 2)
        ctx.fill()
        if (k > 0.6) {
          ctx.fillStyle = `rgba(255,217,168,${0.12 * twinkle})`
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [name, reducedMotion])
  return <canvas ref={canvasRef} className="restored__constellation" aria-label={name} role="img" />
}

function KeepsakePreview({ kind, data }: { kind: 'certificate' | 'postcard'; data: ReturnType<typeof keepsakeDataFor> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ref.current) return
    if (kind === 'certificate') drawCertificate(ref.current, data)
    else drawPostcard(ref.current, data)
  }, [kind, data])
  return <canvas ref={ref} className="restored__preview" aria-hidden="true" />
}

export function ArchiveRestored({ onClose }: { onClose: () => void }) {
  const save = useJourneyStore((state) => state.save)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const data = useMemo(() => keepsakeDataFor(save), [save])
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Reduced motion starts at the end: the keepsakes, with no animation.
  const [elapsed, setElapsed] = useState(() => (reducedMotion ? TIMELINE[TIMELINE.length - 1]!.at : 0))
  const startRef = useRef<number | null>(null)

  const current = [...TIMELINE].reverse().find((entry) => elapsed >= entry.at) ?? TIMELINE[0]!
  const beat: Beat = elapsed < TIMELINE[0]!.at ? 'wake' : current.beat

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    emitAudio('archiveActivated')
    return () => {
      stopPipVoice()
      if (dialog?.open) dialog.close()
    }
  }, [])

  // One clock drives the whole scene; reduced motion jumps to the end.
  useEffect(() => {
    if (reducedMotion) return
    let frame = 0
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      setElapsed(now - startRef.current)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [reducedMotion])

  // PIP's line and a sound for each beat, once.
  const spoken = useRef(new Set<Beat>())
  useEffect(() => {
    if (elapsed < TIMELINE[0]!.at && !reducedMotion) return
    if (spoken.current.has(beat)) return
    spoken.current.add(beat)
    const entry = TIMELINE.find((item) => item.beat === beat)!
    speakPip(pipLine(entry.line), voiceEnabled, beat === 'files' ? 'happy' : 'excited')
    if (beat === 'memory') emitAudio('memoryRecovered')
    if (beat === 'name') emitAudio('historyRestored')
    if (beat === 'keepsakes') emitAudio('stampEarned')
  }, [beat, elapsed, voiceEnabled, reducedMotion])

  // A soft chime as each file lights up.
  const chimed = useRef(0)
  useEffect(() => {
    if (beat !== 'files') return
    const lit = Math.min(5, Math.floor((elapsed - TIMELINE[1]!.at - 700) / 900) + 1)
    if (lit > chimed.current) {
      chimed.current = lit
      emitAudio('passportStamped')
    }
  }, [beat, elapsed])

  const step = BEATS.indexOf(beat)
  const names = data.explorers.map((e) => e.name)
  const worlds = data.explorers.map((e) => e.world)

  return (
    <dialog
      ref={dialogRef}
      className="restored"
      data-beat={beat}
      aria-labelledby="restored-title"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="restored__sky" aria-hidden="true" />
      <h2 id="restored-title" className="sr-only">
        The Cosmic Archive is restored
      </h2>

      <div className={`restored__stage${step >= 3 ? ' is-small' : ''}`}>
        <ArchiveHologram beat={beat} names={names} worlds={worlds} elapsed={elapsed} />
      </div>

      {step >= 2 && (
        <div className={`restored__pip${step === 2 ? ' is-remembering' : ''}`} aria-hidden="true">
          <PipAvatar />
          {step === 2 && (
            <span className="restored__sparks">
              {Array.from({ length: 10 }).map((_, i) => (
                <i key={i} style={{ '--i': i } as React.CSSProperties} />
              ))}
            </span>
          )}
        </div>
      )}

      {step >= 3 && (
        <div className="restored__finale">
          <NameConstellation name={data.carrierName} reducedMotion={reducedMotion} />
          <p className="restored__thanks">
            Thank you, <b>{data.carrierName}</b>!
          </p>
          <div className="restored__badge">
            <span className="restored__badge-face" aria-hidden="true">
              <PipAvatar />
            </span>
            <span>
              <small>Cosmic Carrier · ID {data.carrierId}</small>
              <strong>Master Carrier</strong>
            </span>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="restored__confetti" aria-hidden="true">
          {Array.from({ length: 34 }).map((_, i) => (
            <i
              key={i}
              style={
                {
                  '--i': i,
                  left: `${(i * 37) % 100}%`,
                  animationDelay: `${2.6 + ((i * 0.53) % 1.6)}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {step >= 4 && (
        <div className="restored__keepsakes">
          <div className="restored__keepsake">
            <KeepsakePreview kind="certificate" data={data} />
            <button
              type="button"
              className="restored__download"
              onClick={() => {
                emitAudio('uiConfirm')
                downloadKeepsake('certificate', data)
              }}
            >
              Download my certificate
            </button>
          </div>
          <div className="restored__keepsake">
            <KeepsakePreview kind="postcard" data={data} />
            <button
              type="button"
              className="restored__download"
              onClick={() => {
                emitAudio('uiConfirm')
                downloadKeepsake('postcard', data)
              }}
            >
              Download PIP's postcard
            </button>
          </div>
          <button type="button" className="restored__close" onClick={onClose}>
            Back to Mailwing
          </button>
        </div>
      )}

      <p className="restored__pip-line" aria-live="polite">
        <strong>PIP</strong> {pipLine(TIMELINE.find((item) => item.beat === beat)!.line)}
      </p>
    </dialog>
  )
}
