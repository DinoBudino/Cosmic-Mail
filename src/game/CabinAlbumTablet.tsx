import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * The Cosmic Album as a rugged kids' tablet resting on the cabin console
 * (it replaces the old book from the cabin GLB). Same look as the album
 * screen: slate frame, orange corner bumpers, camera, cream screen with a
 * small preview of the album drawn once on a canvas.
 *
 * ALBUM anchor frame: +Y up out of the console, -Z toward the window.
 * The tablet leans back a little so its screen faces the pilot.
 */
const W = 0.76
const D = 0.52
const T = 0.04
const TILT = 0.32

export function CabinAlbumTablet({ hovered }: { hovered: boolean }) {
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const screen = useMemo(() => makeScreenTexture(), [])
  useEffect(() => () => screen.dispose(), [screen])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const k = 1 - Math.exp(-delta * 10)
    const target = hovered ? 1.06 : 1
    g.scale.setScalar(g.scale.x + (target - g.scale.x) * k)
    if (glow.current) {
      glow.current.opacity = hovered ? 0.5 : 0.08 + Math.sin(state.clock.elapsedTime * 2) * 0.04
    }
  })

  const bumper = (x: number, z: number) => {
    const sx = Math.sign(x)
    const sz = Math.sign(z)
    return (
      <group key={`${x}-${z}`} position={[x, 0, z]}>
        <mesh position={[-sx * 0.045, 0, 0]}>
          <boxGeometry args={[0.11, T + 0.014, 0.03]} />
          <meshStandardMaterial color="#ff8a2a" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0, -sz * 0.045]}>
          <boxGeometry args={[0.03, T + 0.014, 0.11]} />
          <meshStandardMaterial color="#ff8a2a" roughness={0.55} />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[0, 0.06, 0.02]} rotation={[TILT, 0, 0]}>
      <group ref={group}>
        {/* Kickstand */}
        <mesh position={[0, -0.05, -0.12]} rotation={[-0.9, 0, 0]}>
          <boxGeometry args={[0.3, 0.012, 0.16]} />
          <meshStandardMaterial color="#20243c" roughness={0.6} />
        </mesh>
        {/* Slate body */}
        <RoundedBox args={[W, T, D]} radius={0.016} smoothness={3}>
          <meshStandardMaterial color="#2c3150" roughness={0.55} metalness={0.1} />
        </RoundedBox>
        {bumper(W / 2, D / 2)}
        {bumper(-W / 2, D / 2)}
        {bumper(W / 2, -D / 2)}
        {bumper(-W / 2, -D / 2)}
        {/* Side rails */}
        <mesh position={[W / 2 + 0.004, 0, 0]}>
          <boxGeometry args={[0.014, T * 0.7, D * 0.4]} />
          <meshStandardMaterial color="#ff8a2a" roughness={0.55} />
        </mesh>
        <mesh position={[-W / 2 - 0.004, 0, 0]}>
          <boxGeometry args={[0.014, T * 0.7, D * 0.4]} />
          <meshStandardMaterial color="#ff8a2a" roughness={0.55} />
        </mesh>
        {/* Orange rim + screen */}
        <mesh position={[0, T / 2 + 0.0008, 0.004]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 0.12, D - 0.11]} />
          <meshBasicMaterial color="#ff8a2a" toneMapped={false} />
        </mesh>
        <mesh position={[0, T / 2 + 0.0016, 0.004]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 0.135, D - 0.125]} />
          <meshBasicMaterial map={screen} color="#d8ccbc" toneMapped={false} />
        </mesh>
        {/* Soft screen glow so it reads as "on" */}
        <mesh position={[0, T / 2 + 0.003, 0.004]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 0.02, D - 0.02]} />
          <meshBasicMaterial
            ref={glow}
            color="#ffb054"
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            alphaMap={GLOW_MASK()}
          />
        </mesh>
        {/* Camera on the top bezel (far side) */}
        <mesh position={[0, T / 2 + 0.001, -D / 2 + 0.018]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.008, 16]} />
          <meshBasicMaterial color="#05060b" />
        </mesh>
      </group>
    </group>
  )
}

let glowMask: THREE.Texture | null = null
/** A rim-only alpha mask: the glow hugs the edge, not the screen. */
function GLOW_MASK(): THREE.Texture {
  if (glowMask) return glowMask
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#000'
  ctx.fillRect(4, 4, 56, 56)
  glowMask = new THREE.CanvasTexture(canvas)
  return glowMask
}

/** A tiny, legible preview of the album screen. */
function makeScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 680
  const ctx = canvas.getContext('2d')!
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
  }

  // Cream screen
  const bg = ctx.createLinearGradient(0, 0, 0, 680)
  bg.addColorStop(0, '#fff3e3')
  bg.addColorStop(1, '#fde6c9')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1024, 680)

  // Brand tab + title
  ctx.fillStyle = '#2b2063'
  round(-40, -40, 290, 132, 40)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'italic 900 40px Arial Rounded MT Bold, Arial, sans-serif'
  ctx.fillText('COSMIC', 30, 44)
  ctx.fillStyle = '#ffb054'
  ctx.fillText('MAIL', 30, 82)
  ctx.fillStyle = '#2b2063'
  ctx.font = '900 64px Arial Rounded MT Bold, Arial, sans-serif'
  ctx.fillText('Cosmic Album', 300, 72)
  ctx.fillStyle = '#ff8a2a'
  ctx.fillText('✦', 760, 70)

  // PIP and his bubble
  ctx.fillStyle = '#f2ebe4'
  ctx.beginPath()
  ctx.arc(110, 210, 68, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#17172e'
  ctx.beginPath()
  ctx.ellipse(110, 218, 50, 40, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(92, 212, 9, 0, Math.PI * 2)
  ctx.arc(128, 212, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff8a2a'
  round(60, 150, 100, 18, 9)
  ctx.fill()
  // Progress panel
  ctx.fillStyle = '#2b2063'
  round(30, 310, 260, 60, 16)
  ctx.fill()
  ctx.fillStyle = '#fff'
  round(30, 356, 260, 150, 16)
  ctx.fill()
  ctx.fillStyle = '#ebe7f4'
  round(50, 400, 220, 16, 8)
  ctx.fill()
  round(50, 460, 220, 16, 8)
  ctx.fill()
  ctx.fillStyle = '#ff8a2a'
  round(50, 400, 120, 16, 8)
  ctx.fill()
  ctx.fillStyle = '#2f86e8'
  round(50, 460, 90, 16, 8)
  ctx.fill()
  // Carrier pill
  ctx.fillStyle = '#2b2063'
  round(50, 560, 220, 58, 29)
  ctx.fill()
  ctx.fillStyle = '#ff8a2a'
  ctx.fillRect(18, 572, 30, 34)
  ctx.fillRect(272, 572, 30, 34)

  // Three stamp-edged explorer cards
  const cards = ['#e2622b', '#c75a2a', '#8a90a6']
  cards.forEach((tone, i) => {
    const x = 330 + i * 228
    const y = 130
    ctx.fillStyle = '#fffaf2'
    ctx.fillRect(x, y, 206, 500)
    ctx.fillStyle = '#fde6c9'
    for (let k = 0; k <= 12; k += 1) {
      ctx.beginPath()
      ctx.arc(x + (k * 206) / 12, y, 6, 0, Math.PI * 2)
      ctx.arc(x + (k * 206) / 12, y + 500, 6, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let k = 0; k <= 28; k += 1) {
      ctx.beginPath()
      ctx.arc(x, y + (k * 500) / 28, 6, 0, Math.PI * 2)
      ctx.arc(x + 206, y + (k * 500) / 28, 6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#2b2063'
    round(x + 18, y + 26, 110, 22, 11)
    ctx.fill()
    const photo = ctx.createLinearGradient(0, y + 70, 0, y + 230)
    photo.addColorStop(0, i === 2 ? '#3a3f55' : '#f0a070')
    photo.addColorStop(1, tone)
    ctx.fillStyle = photo
    round(x + 16, y + 66, 174, 160, 14)
    ctx.fill()
    ctx.fillStyle = '#e6e2ee'
    round(x + 16, y + 250, 174, 32, 16)
    ctx.fill()
    ctx.fillStyle = '#2fb768'
    round(x + 16, y + 250, [174, 110, 0][i]!, 32, 16)
    if (i < 2) ctx.fill()
    ctx.fillStyle = '#ffc21a'
    for (let s = 0; s < 3; s += 1) {
      ctx.beginPath()
      ctx.arc(x + 68 + s * 36, y + 330, 12, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#ff8a2a'
    round(x + 16, y + 410, 174, 46, 23)
    ctx.fill()
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
