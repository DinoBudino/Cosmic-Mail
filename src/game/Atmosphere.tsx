import { useFrame } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { mulberry32 } from './random'
import { makeGlowTexture } from './textures'
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

// Direction-based gradients avoid UV banding and stay coherent when orbiting.
// This is an artistic dusk atmosphere, not a physical model of the Martian sky.
const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uUpper;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uFloor;
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform vec3 uSun;
  varying vec3 vDirection;
  void main() {
    vec3 direction = normalize(vDirection);
    float height = max(direction.y, 0.0);
    vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.22, height));
    sky = mix(sky, uUpper, smoothstep(0.16, 0.55, height));
    sky = mix(sky, uZenith, smoothstep(0.42, 1.0, height));
    sky = mix(sky, uFloor, smoothstep(0.0, 0.32, -direction.y));

    float sunFacing = max(dot(direction.xz, normalize(uSun.xz)), 0.0);
    float horizon = exp(-abs(direction.y - 0.03) * 8.0);
    float upperWash = smoothstep(0.65, 0.0, height);
    sky += uWarm * horizon * pow(sunFacing, 3.0) * 0.34;
    sky += uWarm * upperWash * pow(sunFacing, 1.5) * 0.045;
    float opposite = max(dot(direction.xz, -normalize(uSun.xz)), 0.0);
    sky = mix(sky, uCool, horizon * pow(opposite, 1.4) * 0.24);
    // A cool violet wash keeps the anti-sun side from turning uniformly pink.
    float coolWash = smoothstep(0.7, 0.0, height);
    sky = mix(sky, uCool, coolWash * pow(opposite, 1.3) * 0.1);
    // A pale luminous seam where the terrain meets the sky.
    sky += uWarm * exp(-abs(direction.y - 0.01) * 80.0) * pow(sunFacing, 6.0) * 0.2;
    // Broad horizontal dust layers, stationary and very low contrast.
    float veil = sin(height * 26.0 + direction.x * 2.4) * 0.5 + 0.5;
    sky += uWarm * veil * horizon * 0.01;
    // Small dither removes visible gradient banding on cheap displays.
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    sky += (dither - 0.5) / 255.0;
    gl_FragColor = vec4(max(sky, vec3(0.0)), 1.0);
    #include <colorspace_fragment>
  }
`


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
  gradient.addColorStop(0, '#FFF4E8')
  gradient.addColorStop(0.55, '#E8D2C2')
  gradient.addColorStop(0.86, '#C2A69E')
  gradient.addColorStop(1, '#8A707E')

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
    context.fillStyle = `rgba(92, 58, 96, ${0.08 + random() * 0.14})`
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
  const dustGroupRef = useRef<THREE.Group>(null)

  const skyUniforms = useMemo(() => ({
    uZenith: { value: new THREE.Color(PALETTE.skyZenith) },
    uUpper: { value: new THREE.Color(PALETTE.skyUpper) },
    uMid: { value: new THREE.Color(PALETTE.skyMid) },
    uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    uFloor: { value: new THREE.Color(PALETTE.skyFloor) },
    uWarm: { value: new THREE.Color(PALETTE.skyGlowWarm) },
    uCool: { value: new THREE.Color(PALETTE.skyGlowCool) },
    uSun: { value: new THREE.Vector3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z).normalize() },
  }), [])
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
  // Three parallax layers of drifting dust: fine near motes, mid haze and
  // large far motes. Total points stay at preset.dustCount (cheap).
  const dustLayers = useMemo(() => {
    const makeLayer = (count: number, spread: number, maxHeight: number, seed: number) => {
      const random = mulberry32(seed)
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(count * 3)
      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = (random() - 0.5) * spread
        positions[index * 3 + 1] = random() * maxHeight
        positions[index * 3 + 2] = (random() - 0.5) * spread
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.computeBoundingSphere()
      return geometry
    }
    const total = preset.dustCount
    return [
      { geometry: makeLayer(Math.round(total * 0.55), 56, 7, 0xc05a1c), size: 0.09, opacity: 0.3, rotationSpeed: 0.012, bobSpeed: 0.5, bobAmplitude: 0.25 },
      { geometry: makeLayer(Math.round(total * 0.32), 74, 14, 0xd051), size: 0.18, opacity: 0.2, rotationSpeed: -0.007, bobSpeed: 0.32, bobAmplitude: 0.45 },
      { geometry: makeLayer(Math.max(8, total - Math.round(total * 0.87)), 92, 22, 0xe0517), size: 0.42, opacity: 0.1, rotationSpeed: 0.004, bobSpeed: 0.2, bobAmplitude: 0.7 },
    ]
  }, [preset.dustCount])

  useEffect(() => {
    return () => {
      glowTexture?.dispose()
      moonTexture?.dispose()
    }
  }, [glowTexture, moonTexture])

  useEffect(() => {
    return () => dustLayers.forEach((layer) => layer.geometry.dispose())
  }, [dustLayers])

  useFrame(({ camera, clock }, delta) => {
    if (skyRef.current) skyRef.current.position.copy(camera.position)

    const elapsed = clock.elapsedTime
    const dustGroup = dustGroupRef.current
    if (!dustGroup) return
    for (let index = 0; index < dustLayers.length; index += 1) {
      const dust = dustGroup.children[index] as THREE.Points | undefined
      if (!dust) continue
      dust.position.x = camera.position.x
      dust.position.z = camera.position.z
      if (!reducedMotion) {
        dust.rotation.y += delta * dustLayers[index]!.rotationSpeed
        dust.position.y = Math.sin(elapsed * dustLayers[index]!.bobSpeed + index * 2.1) * dustLayers[index]!.bobAmplitude
      }
    }
  })

  return (
    <>
      <color attach="background" args={[PALETTE.fog]} />
      <fog attach="fog" args={[PALETTE.fog, preset.fogNear, preset.fogFar]} />

      <group ref={skyRef}>
        <mesh renderOrder={-20} frustumCulled={false}>
          <sphereGeometry args={[400, 48, 32]} />
          <shaderMaterial
            uniforms={skyUniforms}
            vertexShader={SKY_VERTEX}
            fragmentShader={SKY_FRAGMENT}
            side={THREE.BackSide}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </mesh>

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
          scale={[230, 230, 1]}
          renderOrder={-15}
        >
          <spriteMaterial
            map={glowTexture ?? undefined}
            color={PALETTE.skyGlowWarm}
            transparent
            opacity={0.16}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        <sprite position={sunPosition} scale={[80, 80, 1]} renderOrder={-14}>
          <spriteMaterial
            map={glowTexture ?? undefined}
            color={PALETTE.sun}
            transparent
            opacity={0.55}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>

        <sprite position={sunPosition} scale={[12, 12, 1]} renderOrder={-13}>
          <spriteMaterial
            map={glowTexture ?? undefined}
            color="#FFF0E8"
            transparent
            opacity={0.95}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      </group>

      <ambientLight intensity={0.32} color={PALETTE.ambient} />
      <hemisphereLight args={[PALETTE.hemiSky, PALETTE.hemiGround, 0.85]} />
      <directionalLight
        position={lightPosition}
        intensity={2.55}
        color={PALETTE.sun}
        castShadow={preset.shadows}
        shadow-mapSize={[preset.shadowMapSize, preset.shadowMapSize]}
        shadow-camera-left={-105}
        shadow-camera-right={105}
        shadow-camera-top={105}
        shadow-camera-bottom={-105}
        shadow-camera-near={10}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      <directionalLight
        position={[-30, 18, 40]}
        intensity={0.4}
        color={PALETTE.skyGlowCool}
      />

      <group ref={dustGroupRef}>
      {dustLayers.map((layer, index) => (
        <points
          key={index}
          geometry={layer.geometry}
          frustumCulled={false}
        >
          <pointsMaterial
            map={glowTexture ?? undefined}
            color={PALETTE.dust}
            size={layer.size}
            sizeAttenuation
            transparent
            opacity={layer.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </points>
      ))}
      </group>

      {preset.postprocessing && (
        <Suspense fallback={null}>
          <SceneEffects />
        </Suspense>
      )}
    </>
  )
}
