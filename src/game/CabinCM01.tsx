import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { CABIN_OFFSET, CABIN_SCALE, CABIN_URL } from './cabinLayout'
import { cabinLaunchPulse, launchClock } from './launchTimeline'
import { CABIN_SURFACES, applyCabinSurface } from './cabinSurface'

/** Emissive strength of the window ring and amber signage (bloom source). */
const RING_GLOW = 3.2

/**
 * Cabin glow pass: pronounced bloom on the emissive lights (window
 * ring, signage, lanterns, ceiling panel) and a soft violet vignette,
 * the "aura" of the CM-01 reference sheet. The composer disables the
 * renderer tone mapping, so ACES is re-applied as the last effect.
 */
export function CabinEffects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.9} luminanceThreshold={0.8} luminanceSmoothing={0.25} mipmapBlur radius={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.42} />
      <SMAA />
    </EffectComposer>
  )
}

/**
 * Cabina de mando CM-01 Explorer (blender/CabinCM01/scripts/build_cabin.py).
 *
 * The static room comes from the GLB; interactive parts (navigation
 * screen, main button with its safety dome, mission album, side
 * monitors) are mounted on the ANCHOR_* empties exported with it.
 * Anchor frame in three.js: local +Y = surface normal (toward the
 * room), local -Z = "up" of the screen (toward the window), +X right.
 */
export type CabinSlot = 'NAV' | 'BUTTON' | 'ALBUM' | 'SCREEN_L' | 'SCREEN_R'

type CabinProps = {
  slots: Partial<Record<CabinSlot, ReactNode>>
  /** Launch countdown: the ring and amber lights flash with every count. */
  launching?: boolean
  reducedMotion?: boolean
}

export function CabinCM01({ slots, launching = false, reducedMotion = false }: CabinProps) {
  const { scene } = useGLTF(CABIN_URL)
  const model = useMemo(() => {
    const root = scene.clone(true)
    root.updateMatrixWorld(true)
    const anchors: Partial<Record<CabinSlot, THREE.Matrix4>> = {}
    const lanterns: THREE.MeshStandardMaterial[] = []
    const ringLights: THREE.MeshStandardMaterial[] = []
    const seen = new Set<THREE.Material>()
    root.traverse((node) => {
      if (node.name.startsWith('ANCHOR_')) {
        const key = node.name.slice('ANCHOR_'.length) as CabinSlot
        anchors[key] = node.matrixWorld.clone()
      }
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh) return
      // Materials are shared by every mesh using them; collect each once.
      const material = mesh.material as THREE.MeshStandardMaterial
      if (!seen.has(material)) {
        seen.add(material)
        if (material.transparent) material.depthWrite = false
        const surface = CABIN_SURFACES[material.name]
        if (surface) applyCabinSurface(material, surface)
        if (material.name === 'CM_LANTERN_CORE') {
          material.emissive.set('#FF9A2A')
          lanterns.push(material)
        }
        if (material.name === 'CM_RING_LIGHT' || material.name === 'CM_AMBER') {
          // Saturated orange so ACES keeps the glow warm, not cream.
          material.emissive.set('#FF6A12')
          material.emissiveIntensity = RING_GLOW
        }
        if (material.name === 'CM_RING_LIGHT') ringLights.push(material)
      }
    })
    // The old album book of the GLB is replaced by the tablet mounted on
    // the ALBUM anchor (CabinAlbumTablet).
    const album = root.getObjectByName('ALBUM')
    if (album) album.visible = false
    return { root, anchors, lanterns, ringLights }
  }, [scene])

  const lanternL = useRef<THREE.PointLight>(null)
  const lanternR = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    // Launch alert: the window ring and amber strips ramp up on ignition
    // and flash on every number of the countdown (bloom makes them glow).
    const pulse = launching ? cabinLaunchPulse(launchClock.value, reducedMotion) : 0
    if (reducedMotion) {
      for (const material of model.ringLights) material.emissiveIntensity = RING_GLOW + pulse * 2
      return
    }
    const t = state.clock.elapsedTime
    const flicker = 1 + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 5.3) * 0.04
    for (const material of model.lanterns) material.emissiveIntensity = 4.5 * flicker
    for (const material of model.ringLights) {
      material.emissiveIntensity = RING_GLOW + Math.sin(t * 0.8) * 0.4 + pulse * 6
    }
    if (lanternL.current) lanternL.current.intensity = 1.6 * flicker
    if (lanternR.current) lanternR.current.intensity = 1.6 * (2 - flicker)
  })

  return (
    <group scale={CABIN_SCALE} position={CABIN_OFFSET}>
      <primitive object={model.root} />
      {(Object.keys(slots) as CabinSlot[]).map((key) => {
        const matrix = model.anchors[key]
        if (!matrix) return null
        return (
          <group key={key} matrix={matrix} matrixAutoUpdate={false}>
            {slots[key]}
          </group>
        )
      })}
      {/* Warm "luminaria" glow from the two console lanterns. */}
      <pointLight ref={lanternL} position={[-2.25, 0.0, -1.55]} color="#FFB45A" intensity={1.6} distance={2.6} />
      <pointLight ref={lanternR} position={[2.25, 0.0, -1.45]} color="#FFB45A" intensity={1.6} distance={2.6} />
    </group>
  )
}

useGLTF.preload(CABIN_URL)

/* ------------------------------------------------------------------ */
/* Side monitors: "Pantalla de nave" (left) and "Monitor de misión"    */
/* (right), drawn once into canvas textures in the teal console UI.     */
/* ------------------------------------------------------------------ */

const TEAL = '#5FE0CF'
const TEAL_DIM = 'rgba(95,224,207,0.35)'

function screenBase(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0B2A30')
  bg.addColorStop(1, '#061619')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(95,224,207,0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x <= w; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += 32) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.strokeStyle = TEAL_DIM
  ctx.lineWidth = 3
  ctx.strokeRect(10, 10, w - 20, h - 20)
}

function drawShipBlueprint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  screenBase(ctx, w, h)
  const cx = w * 0.42
  const cy = h * 0.52
  ctx.strokeStyle = TEAL
  ctx.lineWidth = 3
  ctx.shadowColor = TEAL
  ctx.shadowBlur = 10
  // Hull: a rounded capsule with a pointed nose and fins.
  ctx.beginPath()
  ctx.moveTo(cx - 190, cy)
  ctx.quadraticCurveTo(cx - 170, cy - 62, cx - 40, cy - 66)
  ctx.lineTo(cx + 120, cy - 54)
  ctx.quadraticCurveTo(cx + 205, cy - 30, cx + 220, cy)
  ctx.quadraticCurveTo(cx + 205, cy + 30, cx + 120, cy + 54)
  ctx.lineTo(cx - 40, cy + 66)
  ctx.quadraticCurveTo(cx - 170, cy + 62, cx - 190, cy)
  ctx.closePath()
  ctx.stroke()
  for (const sign of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx - 120, cy + sign * 60)
    ctx.lineTo(cx - 175, cy + sign * 112)
    ctx.lineTo(cx - 95, cy + sign * 112)
    ctx.lineTo(cx - 40, cy + sign * 64)
    ctx.stroke()
  }
  ctx.lineWidth = 2
  for (let i = 0; i < 6; i += 1) {
    const x = cx - 130 + i * 48
    ctx.beginPath()
    ctx.moveTo(x, cy - 60 + Math.abs(i - 2) * 2)
    ctx.lineTo(x, cy + 60 - Math.abs(i - 2) * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(cx - 185, cy)
  ctx.lineTo(cx + 215, cy)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx + 150, cy, 18, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
  // Side controls column.
  const colX = w - 118
  for (let i = 0; i < 4; i += 1) {
    const y = 48 + i * 82
    ctx.strokeStyle = TEAL_DIM
    ctx.lineWidth = 2
    ctx.strokeRect(colX, y, 78, 62)
    ctx.fillStyle = i === 0 ? '#F47B38' : TEAL
    ctx.beginPath()
    if (i % 2 === 0) {
      ctx.moveTo(colX + 39, y + 16)
      ctx.lineTo(colX + 57, y + 46)
      ctx.lineTo(colX + 21, y + 46)
    } else {
      ctx.moveTo(colX + 24, y + 18)
      ctx.lineTo(colX + 56, y + 31)
      ctx.lineTo(colX + 24, y + 44)
    }
    ctx.closePath()
    ctx.fill()
  }
  // Status bars along the bottom.
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < 4 ? TEAL : 'rgba(95,224,207,0.25)'
    ctx.fillRect(40 + i * 46, h - 52, 36, 14)
  }
}

function drawMissionMonitor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  screenBase(ctx, w, h)
  // Mars, the playable destination, tracked on the mission monitor.
  const px = w * 0.64
  const py = h * 0.5
  const r = h * 0.3
  ctx.save()
  ctx.shadowColor = '#F47B38'
  ctx.shadowBlur = 30
  const body = ctx.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r)
  body.addColorStop(0, '#E9875A')
  body.addColorStop(0.6, '#B9502E')
  body.addColorStop(1, '#6A2618')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = 'rgba(90,30,20,0.45)'
  for (const [dx, dy, cr] of [[-0.3, 0.1, 0.16], [0.25, -0.3, 0.1], [0.2, 0.35, 0.12], [-0.05, -0.05, 0.07]]) {
    ctx.beginPath()
    ctx.arc(px + dx * r, py + dy * r, cr * r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = TEAL_DIM
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(px, py, r + 26, -0.4, Math.PI * 1.2)
  ctx.stroke()
  // Data column: horizontal bars and a small bar graph.
  ctx.fillStyle = TEAL
  const widths = [150, 110, 132, 90]
  widths.forEach((bw, i) => {
    ctx.globalAlpha = 0.85
    ctx.fillRect(40, 54 + i * 34, bw, 10)
  })
  ctx.globalAlpha = 1
  const bars = [40, 70, 55, 95, 120]
  bars.forEach((bh, i) => {
    ctx.fillStyle = i === bars.length - 1 ? '#F47B38' : TEAL
    ctx.fillRect(44 + i * 34, h - 40 - bh, 22, bh)
  })
}

function makeMonitorTexture(kind: 'ship' | 'mission'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 420
  const ctx = canvas.getContext('2d')!
  if (kind === 'ship') drawShipBlueprint(ctx, canvas.width, canvas.height)
  else drawMissionMonitor(ctx, canvas.width, canvas.height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** A monitor face, lying in the anchor's XZ plane (normal +Y). */
export function CabinMonitor({ kind }: { kind: 'ship' | 'mission' }) {
  const texture = useMemo(() => makeMonitorTexture(kind), [kind])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <planeGeometry args={[0.94, 0.6]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
