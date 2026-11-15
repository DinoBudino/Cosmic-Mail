import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

/** One still of a projection and when it appears (ms after the start). */
export interface HologramFrame {
  svg: string
  at: number
}

const TEXTURE_SIZE = 512

/** Rasterises standalone SVG markup into a canvas texture. */
function svgTexture(svg: string): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = TEXTURE_SIZE
      canvas.height = TEXTURE_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('2D canvas unavailable'))
        return
      }
      ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
      ctx.drawImage(image, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      resolve(texture)
    }
    image.onerror = () => reject(new Error('SVG failed to decode'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/**
 * A hologram projected INSIDE the Cosmic Memory Window as a circular
 * 3D mesh behind PIP. Depth ordering guarantees PIP passes in front,
 * and the circle geometry clips anything that would escape the round
 * window frame.
 *
 * It plays a short sequence of stills (`frames`), cross-fading from one
 * to the next on the frame clock. A new `playKey` (next line or Replay)
 * restarts the sequence from its first still, so a replayed failure is
 * seen connected again before it breaks. Reduced motion cuts directly.
 */
export function WindowHologram({
  frames,
  playKey,
  radius = 1.52,
}: {
  frames: readonly HologramFrame[]
  playKey: string
  radius?: number
}) {
  const [textures, setTextures] = useState<THREE.CanvasTexture[] | null>(null)
  const texturesRef = useRef<THREE.CanvasTexture[] | null>(null)
  const frontRef = useRef<THREE.MeshBasicMaterial>(null)
  const backRef = useRef<THREE.MeshBasicMaterial>(null)
  const startRef = useRef(-1)
  const shownRef = useRef(-1)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const timesRef = useRef<number[]>([])

  // Rasterise every still of the sequence before it starts, so swaps
  // never wait on decoding mid-animation.
  const signature = frames.map((frame) => frame.svg).join('\u0000')
  const timing = frames.map((frame) => frame.at).join(',')
  useEffect(() => {
    let cancelled = false
    const svgs = signature.split('\u0000')
    const times = timing.split(',').map(Number)
    Promise.all(svgs.map((svg) => svgTexture(svg)))
      .then((next) => {
        if (cancelled) {
          for (const texture of next) texture.dispose()
          return
        }
        for (const texture of texturesRef.current ?? []) texture.dispose()
        texturesRef.current = next
        timesRef.current = times
        startRef.current = -1
        shownRef.current = -1
        setTextures(next)
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('[WindowHologram]', error)
      })
    return () => {
      cancelled = true
    }
  }, [signature, timing])

  // Same frames, new play (Replay): restart from the first still.
  useEffect(() => {
    startRef.current = -1
    shownRef.current = -1
  }, [playKey])

  useEffect(
    () => () => {
      for (const texture of texturesRef.current ?? []) texture.dispose()
      texturesRef.current = null
    },
    [],
  )

  useFrame((state, delta) => {
    const front = frontRef.current
    const back = backRef.current
    const list = texturesRef.current
    if (!front || !back || !list || list.length === 0) return
    const now = state.clock.elapsedTime * 1000
    if (startRef.current < 0) startRef.current = now
    const elapsed = now - startRef.current

    // Reduced motion shows only the settled still.
    let index = list.length - 1
    if (!reducedMotion) {
      index = 0
      const times = timesRef.current
      for (let i = 0; i < times.length; i += 1) if (elapsed >= (times[i] ?? 0)) index = i
    }

    const target = 0.96
    if (index !== shownRef.current) {
      const first = front.map === null
      // The outgoing still (previous step, previous line or the frame
      // shown before a Replay) stays behind and fades while the new one
      // fades in on top. Only the very first projection materialises
      // from nothing.
      back.map = first ? null : front.map
      back.opacity = first ? 0 : front.opacity
      back.visible = !first
      back.needsUpdate = true
      front.map = list[index] ?? null
      front.opacity = reducedMotion ? target : first ? 0 : 0.25
      front.needsUpdate = true
      shownRef.current = index
    }
    if (reducedMotion) {
      front.opacity = target
      back.visible = false
      return
    }
    // Quick swaps inside a sequence, a gentler fade for a new line.
    const lambda = shownRef.current === 0 ? 4 : 9
    front.opacity = THREE.MathUtils.damp(front.opacity, target, lambda, delta)
    back.opacity = THREE.MathUtils.damp(back.opacity, 0, 10, delta)
    if (back.opacity < 0.01) back.visible = false
  })

  if (!textures) return null
  return (
    <group position={[0, 0.3, -4.4]}>
      <mesh renderOrder={4}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial
          ref={backRef}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.002]} renderOrder={5}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial
          ref={frontRef}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
