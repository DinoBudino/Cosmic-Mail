/**
 * Keepsakes for a finished journey, drawn in the browser on a canvas (no
 * server, no images to load): the Master Carrier certificate and PIP's
 * postcard. Both are plain PNG downloads the child can print.
 *
 * Content rules: English only, the child's own name, the explorers' names
 * and where they rest. No agency names, logos or insignia.
 */

export interface KeepsakeExplorer {
  /** Mission id: also the portrait file, public/finale/<id>.webp. */
  id: string
  name: string
  world: 'Moon' | 'Mars'
  year: string
}

export interface KeepsakeData {
  carrierName: string
  carrierId: string
  /** Shown as written, e.g. "15 November 2026". */
  date: string
  explorers: readonly KeepsakeExplorer[]
}

/**
 * Pictures drawn on the keepsakes: PIP's real portrait (the game's model,
 * public/album/pip.webp) and a render of each explorer's game model
 * (public/finale/<id>.webp). Loaded once; drawing falls back to simple
 * shapes if an image is missing.
 */
export interface KeepsakeArt {
  pip: HTMLImageElement | null
  explorers: Record<string, HTMLImageElement | null>
}

const BASE = import.meta.env.BASE_URL ?? '/'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

let artCache: Promise<KeepsakeArt> | null = null

export function explorerPortraitUrl(id: string): string {
  return `${BASE}finale/${id}.webp`
}

export const PIP_PORTRAIT_URL = `${BASE}album/pip.webp`

export function loadKeepsakeArt(ids: readonly string[]): Promise<KeepsakeArt> {
  if (!artCache) {
    artCache = Promise.all([loadImage(PIP_PORTRAIT_URL), ...ids.map((id) => loadImage(explorerPortraitUrl(id)))]).then(
      ([pip, ...rest]) => ({ pip: pip ?? null, explorers: Object.fromEntries(ids.map((id, i) => [id, rest[i] ?? null])) }),
    )
  }
  return artCache
}

/** Draws an image centred in a box, keeping its proportions. */
function drawContained(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, box: number): void {
  const k = box / Math.max(img.naturalWidth, img.naturalHeight)
  const w = img.naturalWidth * k
  const h = img.naturalHeight * k
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
}

const PLUM = '#1b1029'
const PLUM_2 = '#33203f'
const CREAM = '#fdf4ec'
const PAPER = '#fff8ef'
const PEACH = '#ffd9a8'
const ORANGE = '#ff8a22'
const ORANGE_DARK = '#e8590c'
const BLUE = '#5a9bff'
const SANS = "'Inter', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif"
const MONO = "'JetBrains Mono', 'Cascadia Mono', Consolas, monospace"

const WORLD_COLOR: Record<KeepsakeExplorer['world'], [string, string]> = {
  Moon: ['#d6d3cf', '#6d6a66'],
  Mars: ['#f2a271', '#9b3f22'],
}

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: string, family: string): void {
  let px = size
  ctx.font = `${weight} ${px}px ${family}`
  while (ctx.measureText(text).width > maxWidth && px > 12) {
    px -= 2
    ctx.font = `${weight} ${px}px ${family}`
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  ctx.closePath()
}

function planet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, [light, dark]: [string, string]): void {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
  g.addColorStop(0, light)
  g.addColorStop(1, dark)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function earth(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  planet(ctx, x, y, r, ['#bfe3ff', '#2a3fa8'])
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#6fd28a'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.25, y - r * 0.15, r * 0.32, r * 0.22, -0.5, 0, Math.PI * 2)
  ctx.ellipse(x + r * 0.35, y + r * 0.3, r * 0.25, r * 0.16, 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(191,227,255,0.8)'
  ctx.lineWidth = r * 0.06
  ctx.beginPath()
  ctx.arc(x, y, r * 1.04, 0, Math.PI * 2)
  ctx.stroke()
}

/** PIP's face, as in the game's avatar (PipSpeech PipAvatar). */
function pip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, art?: KeepsakeArt): void {
  if (art?.pip) {
    drawContained(ctx, art.pip, x, y, size * 1.15)
    return
  }
  const k = size / 48
  ctx.save()
  ctx.translate(x - size / 2, y - size / 2)
  ctx.scale(k, k)
  ctx.fillStyle = '#2A1D3B'
  ctx.beginPath()
  ctx.arc(24, 24, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#F2EAE5'
  ctx.beginPath()
  ctx.arc(24, 24, 19, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#17172E'
  ctx.beginPath()
  ctx.ellipse(24, 26, 14, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#F2B5E2'
  roundRect(ctx, 15, 28, 18, 2.4, 1.2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(19.5, 23.5, 2.4, 0, Math.PI * 2)
  ctx.arc(28.5, 23.5, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#F2B5E2'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(34, 8)
  ctx.quadraticCurveTo(37.5, 10, 38.3, 14)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(38.6, 15.6, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** A postage stamp with perforated edges for one explorer. */
function explorerStamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, explorer: KeepsakeExplorer, tilt: number, art?: KeepsakeArt): void {
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(tilt)
  ctx.translate(-w / 2, -h / 2)
  ctx.shadowColor = 'rgba(27,16,41,0.25)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, w, h)
  ctx.shadowColor = 'transparent'
  // perforations
  ctx.fillStyle = PAPER
  const hole = 7
  for (let px = hole; px < w; px += hole * 2.6) {
    ctx.beginPath()
    ctx.arc(px, 0, hole, 0, Math.PI * 2)
    ctx.arc(px, h, hole, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let py = hole; py < h; py += hole * 2.6) {
    ctx.beginPath()
    ctx.arc(0, py, hole, 0, Math.PI * 2)
    ctx.arc(w, py, hole, 0, Math.PI * 2)
    ctx.fill()
  }
  // picture area
  const pad = 22
  const g = ctx.createLinearGradient(0, pad, 0, h * 0.62)
  g.addColorStop(0, PLUM_2)
  g.addColorStop(1, PLUM)
  ctx.fillStyle = g
  ctx.fillRect(pad, pad, w - pad * 2, h * 0.58)
  const rand = seeded(explorer.name.length * 97 + explorer.year.length)
  ctx.fillStyle = CREAM
  for (let i = 0; i < 18; i += 1) {
    ctx.globalAlpha = 0.4 + rand() * 0.5
    ctx.beginPath()
    ctx.arc(pad + rand() * (w - pad * 2), pad + rand() * h * 0.3, 1 + rand() * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.save()
  ctx.beginPath()
  ctx.rect(pad, pad, w - pad * 2, h * 0.58)
  ctx.clip()
  planet(ctx, w / 2, pad + h * 0.58 + w * 0.22, w * 0.5, WORLD_COLOR[explorer.world])
  ctx.restore()
  const portrait = art?.explorers[explorer.id]
  if (portrait) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(pad, pad, w - pad * 2, h * 0.58)
    ctx.clip()
    drawContained(ctx, portrait, w / 2, pad + h * 0.31, Math.min(w - pad * 2, h * 0.58) * 1.02)
    ctx.restore()
  } else {
    ctx.fillStyle = PEACH
    star(ctx, w / 2, pad + h * 0.24, 26, 11)
    ctx.fill()
  }
  // text
  ctx.fillStyle = PLUM
  ctx.textAlign = 'center'
  fitText(ctx, explorer.name, w - pad * 2, 34, '800', SANS)
  ctx.fillText(explorer.name, w / 2, h * 0.58 + pad + 52)
  ctx.font = `700 20px ${MONO}`
  ctx.fillStyle = ORANGE_DARK
  ctx.fillText(`${explorer.world.toUpperCase()} · ${explorer.year}`, w / 2, h * 0.58 + pad + 88)
  ctx.restore()
}

/** Master Carrier certificate, 2400 × 1700 px (prints well on A4/Letter). */
export function drawCertificate(canvas: HTMLCanvasElement, data: KeepsakeData, art?: KeepsakeArt): void {
  const W = 2400
  const H = 1700
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)

  // double frame
  ctx.strokeStyle = PLUM
  ctx.lineWidth = 14
  roundRect(ctx, 40, 40, W - 80, H - 80, 40)
  ctx.stroke()
  ctx.strokeStyle = ORANGE
  ctx.lineWidth = 5
  roundRect(ctx, 72, 72, W - 144, H - 144, 28)
  ctx.stroke()

  // night-sky header band with the route Earth → Moon → Mars
  ctx.save()
  roundRect(ctx, 72, 72, W - 144, 360, 28)
  ctx.clip()
  const sky = ctx.createLinearGradient(0, 72, 0, 432)
  sky.addColorStop(0, '#2a1840')
  sky.addColorStop(1, PLUM)
  ctx.fillStyle = sky
  ctx.fillRect(72, 72, W - 144, 360)
  const rand = seeded(42)
  ctx.fillStyle = CREAM
  for (let i = 0; i < 160; i += 1) {
    ctx.globalAlpha = 0.3 + rand() * 0.6
    ctx.beginPath()
    ctx.arc(72 + rand() * (W - 144), 72 + rand() * 360, 0.8 + rand() * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.setLineDash([18, 16])
  ctx.strokeStyle = PEACH
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(330, 260)
  ctx.quadraticCurveTo(1000, -10, 1840, 140)
  ctx.moveTo(1930, 190)
  ctx.quadraticCurveTo(2040, 200, 2100, 250)
  ctx.stroke()
  ctx.setLineDash([])
  earth(ctx, 250, 290, 90)
  planet(ctx, 1890, 160, 42, WORLD_COLOR.Moon)
  planet(ctx, 2170, 310, 78, WORLD_COLOR.Mars)
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.fillStyle = PEACH
  ctx.font = `700 34px ${MONO}`
  ctx.fillText('C O S M I C   A R C H I V E', W / 2, 170)
  ctx.fillStyle = CREAM
  ctx.font = `900 108px ${SANS}`
  ctx.fillText('Certificate of Delivery', W / 2, 300)

  ctx.fillStyle = PLUM_2
  ctx.font = `500 46px ${SANS}`
  ctx.fillText('This certifies that', W / 2, 540)
  ctx.fillStyle = PLUM
  fitText(ctx, data.carrierName, W - 600, 150, '900', SANS)
  ctx.fillText(data.carrierName, W / 2, 700)
  ctx.strokeStyle = ORANGE
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(W / 2 - 520, 740)
  ctx.lineTo(W / 2 + 520, 740)
  ctx.stroke()

  // rank ribbon
  ctx.fillStyle = ORANGE
  roundRect(ctx, W / 2 - 330, 785, 660, 96, 48)
  ctx.fill()
  ctx.fillStyle = PLUM
  ctx.font = `900 56px ${SANS}`
  ctx.fillText('MASTER CARRIER', W / 2, 853)

  ctx.fillStyle = PLUM_2
  ctx.font = `500 42px ${SANS}`
  ctx.fillText(`brought the stories of ${data.explorers.length} space explorers home to Earth.`, W / 2, 960)

  // stamps
  const sw = 300
  const sh = 330
  const gap = 56
  const total = data.explorers.length * sw + (data.explorers.length - 1) * gap
  data.explorers.forEach((explorer, i) => {
    explorerStamp(ctx, (W - total) / 2 + i * (sw + gap), 1030, sw, sh, explorer, (i % 2 === 0 ? -1 : 1) * 0.035, art)
  })

  // footer: date, carrier ID, PIP's signature
  ctx.textAlign = 'left'
  ctx.fillStyle = PLUM_2
  ctx.font = `700 30px ${MONO}`
  ctx.fillText(`DATE  ${data.date}`, 180, 1520)
  ctx.fillText(`CARRIER ID  ${data.carrierId}`, 180, 1570)
  ctx.textAlign = 'right'
  pip(ctx, W - 520, 1520, 120, art)
  ctx.fillStyle = PLUM
  ctx.font = `italic 700 54px ${SANS}`
  ctx.fillText('PIP', W - 180, 1515)
  ctx.font = `500 28px ${SANS}`
  ctx.fillStyle = PLUM_2
  ctx.fillText('Mailwing companion', W - 180, 1560)
  ctx.textAlign = 'center'
}

/** PIP's postcard, 1800 × 1200 px: picture side on the left, message on the right. */
export function drawPostcard(canvas: HTMLCanvasElement, data: KeepsakeData, art?: KeepsakeArt): void {
  const W = 1800
  const H = 1200
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)

  // picture side
  const PX = 60
  const PW = 900
  ctx.save()
  roundRect(ctx, PX, 60, PW, H - 120, 34)
  ctx.clip()
  const sky = ctx.createLinearGradient(0, 60, 0, H)
  sky.addColorStop(0, '#3a2150')
  sky.addColorStop(1, '#0b0614')
  ctx.fillStyle = sky
  ctx.fillRect(PX, 60, PW, H - 120)
  const rand = seeded(7)
  ctx.fillStyle = CREAM
  for (let i = 0; i < 220; i += 1) {
    ctx.globalAlpha = 0.3 + rand() * 0.7
    ctx.beginPath()
    ctx.arc(PX + rand() * PW, 60 + rand() * (H - 120), 0.8 + rand() * 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  planet(ctx, PX + 760, 260, 110, WORLD_COLOR.Mars)
  planet(ctx, PX + 220, 380, 70, WORLD_COLOR.Moon)
  earth(ctx, PX + 380, 1010, 260)
  // the letters' route home
  ctx.setLineDash([16, 14])
  ctx.strokeStyle = PEACH
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(PX + 700, 340)
  ctx.quadraticCurveTo(PX + 640, 620, PX + 420, 760)
  ctx.moveTo(PX + 260, 440)
  ctx.quadraticCurveTo(PX + 300, 600, PX + 360, 740)
  ctx.stroke()
  ctx.setLineDash([])
  // envelope
  ctx.save()
  ctx.translate(PX + 520, 560)
  ctx.rotate(-0.25)
  ctx.fillStyle = CREAM
  ctx.strokeStyle = PLUM
  ctx.lineWidth = 7
  roundRect(ctx, -80, -52, 160, 104, 12)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-74, -46)
  ctx.lineTo(0, 10)
  ctx.lineTo(74, -46)
  ctx.stroke()
  ctx.restore()
  ctx.restore()
  ctx.fillStyle = CREAM
  ctx.textAlign = 'left'
  ctx.font = `900 64px ${SANS}`
  ctx.fillText('Greetings from', PX + 50, 160)
  ctx.fillStyle = PEACH
  ctx.fillText('the Cosmic Archive!', PX + 50, 236)

  // message side
  const MX = 1020
  ctx.strokeStyle = 'rgba(27,16,41,0.25)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(MX, 90)
  ctx.lineTo(MX, H - 90)
  ctx.stroke()

  // stamp + postmark
  ctx.save()
  ctx.translate(W - 250, 110)
  ctx.fillStyle = CREAM
  ctx.shadowColor = 'rgba(27,16,41,0.25)'
  ctx.shadowBlur = 12
  ctx.fillRect(0, 0, 170, 200)
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = PLUM
  ctx.fillRect(14, 14, 142, 172)
  pip(ctx, 85, 88, 108, art)
  ctx.fillStyle = PEACH
  ctx.font = `800 18px ${MONO}`
  ctx.textAlign = 'center'
  ctx.fillText('MAILWING', 85, 172)
  ctx.restore()
  ctx.save()
  ctx.translate(W - 470, 250)
  ctx.strokeStyle = 'rgba(232,89,12,0.75)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(0, 0, 92, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 70, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(232,89,12,0.85)'
  ctx.textAlign = 'center'
  ctx.font = `800 17px ${MONO}`
  ctx.fillText('COSMIC MAIL', 0, -10)
  ctx.font = `700 13px ${MONO}`
  ctx.fillText(data.date.toUpperCase(), 0, 16)
  ctx.restore()

  ctx.textAlign = 'left'
  ctx.fillStyle = PLUM
  ctx.font = `800 52px ${SANS}`
  ctx.fillText(`Dear ${data.carrierName},`, MX + 60, 450)
  ctx.font = `500 38px ${SANS}`
  ctx.fillStyle = PLUM_2
  const message = [
    'Thanks to you, the stories of',
    `${data.explorers.length} space explorers found their way`,
    'home. My memories are back too!',
    'Keep looking up. There are always',
    'more stories waiting out there.',
  ]
  message.forEach((line, i) => ctx.fillText(line, MX + 60, 530 + i * 58))
  ctx.font = `italic 700 46px ${SANS}`
  ctx.fillStyle = PLUM
  ctx.fillText('Your friend, PIP', MX + 60, 880)

  // address lines
  ctx.strokeStyle = 'rgba(27,16,41,0.3)'
  ctx.lineWidth = 3
  ctx.font = `600 32px ${SANS}`
  ctx.fillStyle = PLUM_2
  const address = [`${data.carrierName}`, 'Master Carrier', 'Planet Earth']
  address.forEach((line, i) => {
    const y = 980 + i * 62
    ctx.fillText(line, MX + 300, y)
    ctx.beginPath()
    ctx.moveTo(MX + 280, y + 16)
    ctx.lineTo(W - 90, y + 16)
    ctx.stroke()
  })
  ctx.fillStyle = BLUE
  ctx.font = `700 22px ${MONO}`
  ctx.fillText(`CARRIER ID ${data.carrierId}`, MX + 60, 930)
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'carrier'
}

/** Draws a keepsake and starts a PNG download. */
export async function downloadKeepsake(kind: 'certificate' | 'postcard', data: KeepsakeData): Promise<void> {
  const art = await loadKeepsakeArt(data.explorers.map((e) => e.id))
  const canvas = document.createElement('canvas')
  if (kind === 'certificate') drawCertificate(canvas, data, art)
  else drawPostcard(canvas, data, art)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cosmic-mail-${kind}-${safeName(data.carrierName)}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, 'image/png')
}
