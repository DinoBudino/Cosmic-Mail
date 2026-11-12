import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

/**
 * A hologram projected INSIDE the Cosmic Memory Window as a circular
 * 3D mesh behind PIP. Depth ordering guarantees PIP passes in front,
 * and the circle geometry clips anything that would escape the round
 * window frame. The caller supplies standalone SVG markup; it is
 * rasterized into a canvas texture whenever it changes.
 */
export function WindowHologram({
  svg,
  radius = 1.52,
}: {
  svg: string | null
  radius?: number
}) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  const lastTextureIdRef = useRef<string>('')
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  // Gentle fade-in whenever the projection changes (moment): the new hologram materializes instead of popping in.
  useFrame((_, delta) => {
    const material = materialRef.current
    const current = textureRef.current
    if (!material || !current) return
    // New projection: start from invisible and fade in.
    if (lastTextureIdRef.current !== current.uuid) {
      lastTextureIdRef.current = current.uuid
      material.opacity = 0
    }
    const target = 0.96
    material.opacity = reducedMotion
      ? target
      : THREE.MathUtils.damp(material.opacity, target, 4, delta)
  })

  useEffect(() => {
    if (!svg) return
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, 512, 512)
      ctx.drawImage(image, 0, 0, 512, 512)
      const next = new THREE.CanvasTexture(canvas)
      next.colorSpace = THREE.SRGBColorSpace
      next.anisotropy = 4
      textureRef.current?.dispose()
      textureRef.current = next
      setTexture(next)
    }
    image.onerror = () => {
      if (import.meta.env.DEV) console.warn('[WindowHologram] SVG failed to decode')
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    return () => {
      cancelled = true
    }
  }, [svg])

  useEffect(
    () => () => {
      textureRef.current?.dispose()
      textureRef.current = null
    },
    [],
  )

  if (!svg || !texture) return null
  return (
    <mesh position={[0, 0.3, -4.4]} renderOrder={4}>
      <circleGeometry args={[radius, 64]} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        transparent
        opacity={reducedMotion ? 0.96 : 0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
