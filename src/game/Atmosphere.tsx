import { useFrame } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { mulberry32 } from './random'
import { Starfield } from './Starfield'
import {
  MOON_DIRECTION,
  PALETTE,
  QUALITY_PRESETS,
  SUN_DIRECTION,
  type Quality,
} from './worldConfig'

const SceneEffects = lazy(() => import('./SceneEffects'))

interface AtmosphereProps {
  quality: Quality
}

function makeSkyTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) return null

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, PALETTE.skyZenith)
  gradient.addColorStop(0.34, PALETTE.skyUpper)
  gradient.addColorStop(0.46, PALETTE.skyMid)
  gradient.addColorStop(0.505, PALETTE.skyHorizon)
  gradient.addColorStop(0.56, PALETTE.skyBelow)
  gradient.addColorStop(1, PALETTE.skyFloor)
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function makeGlowTexture(): THREE.CanvasTexture | null {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.16, 'rgba(255, 244, 220, 0.95)')
  gradient.addColorStop(0.42, 'rgba(255, 205, 160, 0.32)')
  gradient.addColorStop(1, 'rgba(255, 180, 130, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function makeMoonTexture(): THREE.CanvasTexture | null {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null

  const center = size / 2
  const radius = size / 2 - 4
  const gradient = context.createRadialGradient(
    size * 0.36,
    size * 0.3,
    2,
    center,
    center,
    radius,
  )
  gradient.addColorStop(0, '#fff7ea')
  gradient.addColorStop(0.55, '#e6cdb8')
  gradient.addColorStop(0.86, '#bda096')
  gradient.addColorStop(1, '#8d7182')

  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.fillStyle = gradient
  context.fill()

  context.save()
  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.clip()

  const random = mulberry32(0x90a)
  for (let index = 0; index < 11; index += 1) {
    const craterX = center + (random() - 0.5) * radius * 1.5
    const craterY = center + (random() - 0.5) * radius * 1.5
    const craterRadius = 2 + random() * 7
    context.beginPath()
    context.arc(craterX, craterY, craterRadius, 0, Math.PI * 2)
    context.fillStyle = `rgba(92, 70, 86, ${0.08 + random() * 0.14})`
    context.fill()
  }
  context.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function Atmosphere({ quality }: AtmosphereProps) {
  const preset = QUALITY_PRESETS[quality]
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const skyRef = useRef<THREE.Group>(null)
  const dustRef = useRef<THREE.Points>(null)

  const skyTexture = useMemo(() => makeSkyTexture(), [])
  const glowTexture = useMemo(() => makeGlowTexture(), [])
  const moonTexture = useMemo(() => makeMoonTexture(), [])
  const sunDirection = useMemo(
    () =>
      new THREE.Vector3(
        SUN_DIRECTION.x,
        SUN_DIRECTION.y,
        SUN_DIRECTION.z,
      ).normalize(),
    [],
  )
  const sunPosition = useMemo(
    () => sunDirection.clone().multiplyScalar(380),
    [sunDirection],
  )
  const lightPosition = useMemo(
    () => sunDirection.clone().multiplyScalar(70),
    [sunDirection],
  )
  const moonDirection = useMemo(
    () =>
      new THREE.Vector3(
        MOON_DIRECTION.x,
        MOON_DIRECTION.y,
        MOON_DIRECTION.z,
      ).normalize(),
    [],
  )
  const moonPosition = useMemo(
    () => moonDirection.clone().multiplyScalar(350),
    [moonDirection],
  )
  const warmHorizonPosition = useMemo(
    () =>
      new THREE.Vector3(sunDirection.x, 0.08, sunDirection.z)
        .normalize()
        .multiplyScalar(330),
    [sunDirection],
  )
  const coolHorizonPosition = useMemo(
    () =>
      new THREE.Vector3(-sunDirection.x, 0.1, -sunDirection.z)
        .normalize()
        .multiplyScalar(330),
    [sunDirection],
  )

  const dustGeometry = useMemo(() => {
    const random = mulberry32(0xc05a1c)
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(preset.dustCount * 3)
    for (let index = 0; index < preset.dustCount; index += 1) {
      positions[index * 3] = (random() - 0.5) * 72
      positions[index * 3 + 1] = random() * 16
      positions[index * 3 + 2] = (random() - 0.5) * 72
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.computeBoundingSphere()
    return geometry
  }, [preset.dustCount])

  useEffect(() => {
    return () => {
      skyTexture?.dispose()
      glowTexture?.dispose()
      moonTexture?.dispose()
    }
  }, [skyTexture, glowTexture, moonTexture])

  useEffect(() => {
    return () => dustGeometry.dispose()
  }, [dustGeometry])

  useFrame(({ camera }, delta) => {
    if (skyRef.current) skyRef.current.position.copy(camera.position)

    const dust = dustRef.current
    if (!dust) return
    dust.position.x = camera.position.x
    dust.position.z = camera.position.z
    if (!reducedMotion) dust.rotation.y += delta * 0.008
  })

  return (
    <>
      <color attach="background" args={[PALETTE.fog]} />
      <fog attach="fog" args={[PALETTE.fog, preset.fogNear, preset.fogFar]} />

      <group ref={skyRef}>
        <mesh renderOrder={-20} frustumCulled={false}>
          <sphereGeometry args={[400, 64, 48]} />
          <meshBasicMaterial
            map={skyTexture ?? undefined}
            side={THREE.BackSide}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </mesh>

        <sprite
          position={warmHorizonPosition}
          scale={[300, 300, 1]}
          renderOrder={-19}
        >
          <spriteMaterial
            map={glowTexture ?? undefined}
            color={PALETTE.skyGlowWarm}
            transparent
            opacity={0.18}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        <sprite
          position={coolHorizonPosition}
          scale={[320, 320, 1]}
          renderOrder={-19}
        >
          <spriteMaterial
            map={glowTexture ?? undefined}
            color={PALETTE.skyGlowCool}
            transparent
            opacity={0.12}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        <Starfield count={preset.starCount} reducedMotion={reducedMotion} />

        <sprite
          position={moonPosition}
          scale={[36, 36, 1]}
          renderOrder={-17}
        >
          <spriteMaterial
            map={glowTexture ?? undefined}
            color={PALETTE.moonGlow}
            transparent
            opacity={0.22}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        <sprite position={moonPosition} scale={[13, 13, 1]} renderOrder={-16}>
          <spriteMaterial
            map={moonTexture ?? undefined}
            transparent
            opacity={0.95}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </sprite>

        <sprite
          position={sunPosition}
          scale={[210, 210, 1]}
          renderOrder={-15}
        >
          <spriteMaterial
            map={glowTexture ?? undefined}
            color={PALETTE.skyGlowWarm}
            transparent
            opacity={0.2}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        <sprite position={sunPosition} scale={[92, 92, 1]} renderOrder={-14}>
          <spriteMaterial
            map={glowTexture ?? undefined}
            color={PALETTE.sun}
            transparent
            opacity={0.85}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        <sprite position={sunPosition} scale={[20, 20, 1]} renderOrder={-13}>
          <spriteMaterial
            map={glowTexture ?? undefined}
            color="#fff4dc"
            transparent
            opacity={0.95}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      </group>

      <ambientLight intensity={0.28} color={PALETTE.ambient} />
      <hemisphereLight args={[PALETTE.hemiSky, PALETTE.hemiGround, 0.95]} />
      <directionalLight
        position={lightPosition}
        intensity={2.35}
        color={PALETTE.sun}
        castShadow={preset.shadows}
        shadow-mapSize={[preset.shadowMapSize, preset.shadowMapSize]}
        shadow-camera-left={-58}
        shadow-camera-right={58}
        shadow-camera-top={58}
        shadow-camera-bottom={-58}
        shadow-camera-near={10}
        shadow-camera-far={170}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight
        position={[-30, 18, 40]}
        intensity={0.32}
        color="#9c8ad6"
      />

      <points ref={dustRef} geometry={dustGeometry} frustumCulled={false}>
        <pointsMaterial
          map={glowTexture ?? undefined}
          color={PALETTE.dust}
          size={0.18}
          sizeAttenuation
          transparent
          opacity={0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {preset.postprocessing && (
        <Suspense fallback={null}>
          <SceneEffects />
        </Suspense>
      )}
    </>
  )
}
