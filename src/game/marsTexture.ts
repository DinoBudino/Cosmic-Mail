import { mulberry32 } from './random'

/**
 * Painted, stylized Mars surface (equirectangular, wraps seamlessly).
 * Shared by the menu/launch scene and the Mars orbit.
 */
export function makeMarsCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const random = mulberry32(0x1a12)

  // Base dusty gradient, lighter at the poles.
  const gradient = ctx.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, '#D49A77')
  gradient.addColorStop(0.25, '#C07A5E')
  gradient.addColorStop(0.55, '#B77B65')
  gradient.addColorStop(0.85, '#A66A55')
  gradient.addColorStop(1, '#C98A6B')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1024, 512)

  // Every surface element is drawn at x, x-1024 and x+1024 so the
  // texture wraps seamlessly around the sphere (no UV seam cut).
  const wrapped = (_x: number, draw: (offset: number) => void) => {
    for (const offset of [0, -1024, 1024]) draw(offset)
  }

  // Dark maria patches (big soft blotches).
  for (let i = 0; i < 42; i += 1) {
    const x = random() * 1024
    const y = 60 + random() * 392
    const r = 28 + random() * 85
    const squash = 0.45 + random() * 0.4
    const rotation = random() * Math.PI
    wrapped(x, (offset) => {
      const g = ctx.createRadialGradient(x + offset, y, 0, x + offset, y, r)
      g.addColorStop(0, 'rgba(122,72,58,0.5)')
      g.addColorStop(1, 'rgba(122,72,58,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x + offset, y, r, r * squash, rotation, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Light dusty patches.
  for (let i = 0; i < 55; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const r = 18 + random() * 60
    wrapped(x, (offset) => {
      const g = ctx.createRadialGradient(x + offset, y, 0, x + offset, y, r)
      g.addColorStop(0, 'rgba(232,180,150,0.4)')
      g.addColorStop(1, 'rgba(232,180,150,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x + offset, y, r, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Small crater dots for extra relief.
  for (let i = 0; i < 90; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const r = 3 + random() * 9
    wrapped(x, (offset) => {
      ctx.fillStyle = 'rgba(90,52,42,0.4)'
      ctx.beginPath()
      ctx.arc(x + offset, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(253,244,236,0.28)'
      ctx.beginPath()
      ctx.arc(x + offset - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Fine speckle for grain.
  for (let i = 0; i < 5200; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const size = 1 + random() * 1.4
    const dark = random() > 0.5
    wrapped(x, (offset) => {
      ctx.fillStyle = dark ? 'rgba(90,52,42,0.22)' : 'rgba(240,200,170,0.18)'
      ctx.fillRect(x + offset, y, size, size)
    })
  }

  // Pale polar cap.
  const cap = ctx.createLinearGradient(0, 0, 0, 52)
  cap.addColorStop(0, 'rgba(253,244,236,0.75)')
  cap.addColorStop(1, 'rgba(253,244,236,0)')
  ctx.fillStyle = cap
  ctx.fillRect(0, 0, 1024, 52)

  return canvas
}
