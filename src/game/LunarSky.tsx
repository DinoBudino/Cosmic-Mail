import { useFrame, useLoader } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getActiveExplorer, type MoonExplorerId } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { LUNAR_SITES } from './lunarGround'
import { Starfield } from './Starfield.tsx'
import { makeGlowTexture } from './textures'
import { QUALITY_PRESETS, type Quality } from './worldConfig'

const SceneEffects = lazy(() => import('./SceneEffects'))

const EARTH_DAY = `${import.meta.env.BASE_URL}textures/earth/earth-day.jpg`
const EARTH_NIGHT = `${import.meta.env.BASE_URL}textures/earth/earth-night.jpg`
/** Sky shell radius: everything on it follows the camera. */
const SKY = 400
/**
 * Earth seen from the Moon spans about 1.9 deg (four times the Sun). On a
 * game screen that disc is too small to notice, so it is drawn twice as
 * large, and lower in the sky than it really is (see LunarSite.earth):
 * the two liberties taken so children can find it. It is lit by the same
 * Sun as the ground, so its phase is the real one for the scene's Sun.
 */
const EARTH_DISPLAY_SCALE = 2
const EARTH_RADIUS = SKY * Math.tan((1.9 / 2) * (Math.PI / 180)) * EARTH_DISPLAY_SCALE
/** The Sun is about 0.53 deg across. */
const SUN_RADIUS = SKY * Math.tan((0.53 / 2) * (Math.PI / 180))

/**
 * The Milky Way: a faint, uneven band of light across the black sky. With
 * no air in the way the Moon's sky shows it crisply, so it is a cheap way
 * to make the sky feel deep instead of empty. Additive and very dim.
 */
const MILKY_WAY_VERTEX = `varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const MILKY_WAY_FRAGMENT = `uniform vec3 uAxis; varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 d = normalize(vDir);
  float across = dot(d, uAxis);
  float band = exp(-across * across / 0.018);
  float clouds = noise(d * 6.0) * 0.6 + noise(d * 15.0) * 0.3 + noise(d * 38.0) * 0.1;
  // Dark dust lanes down the middle of the band.
  float lane = smoothstep(0.0, 0.05, abs(across + (noise(d * 9.0) - 0.5) * 0.06));
  float light = band * smoothstep(0.25, 0.85, clouds) * mix(0.45, 1.0, lane);
  gl_FragColor = vec4(vec3(0.78, 0.82, 0.95) * light * 0.16, 1.0);
}`

function MilkyWay() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uAxis: { value: new THREE.Vector3(0.35, 0.62, -0.7).normalize() } },
        vertexShader: MILKY_WAY_VERTEX,
        fragmentShader: MILKY_WAY_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh material={material} renderOrder={-19} frustumCulled={false}>
      <sphereGeometry args={[SKY * 0.98, 48, 24]} />
    </mesh>
  )
}

/**
 * Earth's own shader: the sunlit side bright (Earth reflects far more light
 * than the gray Moon), city lights faint on the night side, and a blue
 * fringe of air along the limb, so the disc reads as Earth at any phase.
 */
const EARTH_VERTEX = `varying vec2 vUv; varying vec3 vNormalW; varying vec3 vNormalV; varying vec3 vView;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`
const EARTH_FRAGMENT = `uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun;
varying vec2 vUv; varying vec3 vNormalW; varying vec3 vNormalV; varying vec3 vView;
void main() {
  float light = dot(normalize(vNormalW), normalize(uSun));
  float lit = smoothstep(-0.08, 0.25, light);
  vec3 day = texture2D(uDay, vUv).rgb * (0.25 + 1.45 * max(light, 0.0));
  vec3 night = texture2D(uNight, vUv).rgb * vec3(1.0, 0.85, 0.6) * 0.55 + vec3(0.02, 0.035, 0.07);
  vec3 color = mix(night, day, lit);
  float rim = pow(1.0 - max(dot(vNormalV, vView), 0.0), 3.0);
  color += vec3(0.3, 0.55, 1.0) * rim * (0.35 + 0.65 * lit);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`

function Earth({ direction, sun }: { direction: THREE.Vector3; sun: THREE.Vector3 }) {
  const [day, night] = useLoader(THREE.TextureLoader, [EARTH_DAY, EARTH_NIGHT])
  const glow = useMemo(() => makeGlowTexture(), [])
  const material = useMemo(() => {
    const dayMap = day.clone()
    dayMap.colorSpace = THREE.SRGBColorSpace
    dayMap.needsUpdate = true
    const nightMap = night.clone()
    nightMap.colorSpace = THREE.SRGBColorSpace
    nightMap.needsUpdate = true
    return new THREE.ShaderMaterial({
      uniforms: { uDay: { value: dayMap }, uNight: { value: nightMap }, uSun: { value: sun.clone() } },
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
      toneMapped: false,
    })
  }, [day, night, sun])
  const position = useMemo(() => direction.clone().multiplyScalar(SKY * 0.95), [direction])
  return (
    <group position={position}>
      {/* Soft blue halo of air behind the disc. */}
      <sprite scale={[EARTH_RADIUS * 3.2, EARTH_RADIUS * 3.2, 1]} renderOrder={-16}>
        <spriteMaterial
          map={glow ?? undefined}
          color="#5f9cff"
          transparent
          opacity={0.45}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <mesh material={material} rotation={[0.41, 0, 0]}>
        <sphereGeometry args={[EARTH_RADIUS, 48, 32]} />
      </mesh>
    </group>
  )
}

/**
 * The Moon's sky: no air, so it is black even in daylight, the Sun is a
 * small hard disc and shadows are sharp and almost black. Earth hangs high
 * in the sky at the real angle for each landing site. The stars stay for
 * wonder (in daylight photos the bright ground hides them), steady rather
 * than twinkling because there is no air, with the Milky Way behind them.
 */
export function LunarSky({ quality }: { quality: Quality }) {
  const preset = QUALITY_PRESETS[quality]
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const site = LUNAR_SITES[getActiveExplorer() as MoonExplorerId]
  const skyRef = useRef<THREE.Group>(null)
  const glow = useMemo(() => makeGlowTexture(), [])
  const sun = useMemo(() => new THREE.Vector3(site.sun.x, site.sun.y, site.sun.z).normalize(), [site])
  const earth = useMemo(() => new THREE.Vector3(site.earth.x, site.earth.y, site.earth.z).normalize(), [site])

  useFrame(({ camera }) => {
    if (skyRef.current) skyRef.current.position.copy(camera.position)
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <group ref={skyRef}>
        <MilkyWay />
        <Starfield count={preset.starCount} reducedMotion={reducedMotion} brightness={2.1} twinkle={false} />
        <mesh position={sun.clone().multiplyScalar(SKY * 0.95)} renderOrder={-14}>
          <sphereGeometry args={[SUN_RADIUS, 24, 16]} />
          <meshBasicMaterial color="#fffaf0" toneMapped={false} fog={false} />
        </mesh>
        <sprite position={sun.clone().multiplyScalar(SKY * 0.94)} scale={[22, 22, 1]} renderOrder={-15}>
          <spriteMaterial
            map={glow ?? undefined}
            color="#fff6e8"
            transparent
            opacity={0.5}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
        {/* Wide, faint glare: with no air to scatter it, the Sun's light
            only spreads inside the eye (or camera lens). */}
        <sprite position={sun.clone().multiplyScalar(SKY * 0.93)} scale={[70, 70, 1]} renderOrder={-16}>
          <spriteMaterial
            map={glow ?? undefined}
            color="#ffe9c8"
            transparent
            opacity={0.22}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
        <Suspense fallback={null}>
          <Earth direction={earth} sun={sun} />
        </Suspense>
      </group>

      {/* Sunlight only, plus a weak fill standing in for light bounced off
          the ground, so shadowed sides stay readable for children. */}
      <ambientLight intensity={0.12} color="#c9ccd6" />
      <hemisphereLight args={['#20242e', '#8a8680', 0.55]} />
      {/* Earthshine: sunlight bounced off Earth, a faint cool fill from
          Earth's direction (strongest on the Moon's night side, real). */}
      <directionalLight position={earth.clone().multiplyScalar(80)} intensity={0.18} color="#b9cdf2" />
      <directionalLight
        position={sun.clone().multiplyScalar(80)}
        intensity={3.4}
        color="#fffaf2"
        castShadow={preset.shadows}
        shadow-mapSize={[preset.shadowMapSize, preset.shadowMapSize]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={5}
        shadow-camera-far={260}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={2}
      />
      {preset.postprocessing && (
        <Suspense fallback={null}>
          <SceneEffects />
        </Suspense>
      )}
    </>
  )
}
