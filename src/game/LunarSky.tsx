import { useFrame, useLoader } from '@react-three/fiber'
import { lazy, Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getActiveExplorer, type MoonExplorerId } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { LUNAR_SITES } from './lunarGround'
import { Starfield } from './Starfield.tsx'
import { makeGlowTexture } from './textures'
import { QUALITY_PRESETS, type Quality } from './worldConfig'

const SceneEffects = lazy(() => import('./SceneEffects'))

const EARTH_DAY = `${import.meta.env.BASE_URL}textures/earth/earth-day.jpg`
/** Sky shell radius: everything on it follows the camera. */
const SKY = 400
/**
 * Earth seen from the Moon spans about 1.9 deg (four times the Sun). On a
 * game screen that disc is too small to notice, so it is drawn twice as
 * large (the only scale liberty in the sky). It is lit by the same Sun as
 * the ground, so its phase is the real one for the scene's Sun direction.
 */
const EARTH_DISPLAY_SCALE = 2
const EARTH_RADIUS = SKY * Math.tan((1.9 / 2) * (Math.PI / 180)) * EARTH_DISPLAY_SCALE
/** The Sun is about 0.53 deg across. */
const SUN_RADIUS = SKY * Math.tan((0.53 / 2) * (Math.PI / 180))

function Earth({ direction }: { direction: THREE.Vector3 }) {
  const day = useLoader(THREE.TextureLoader, EARTH_DAY)
  const material = useMemo(() => {
    const map = day.clone()
    map.colorSpace = THREE.SRGBColorSpace
    map.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0, fog: false })
  }, [day])
  const position = useMemo(() => direction.clone().multiplyScalar(SKY * 0.95), [direction])
  return (
    <mesh position={position} material={material} rotation={[0.41, 0, 0]}>
      <sphereGeometry args={[EARTH_RADIUS, 48, 32]} />
    </mesh>
  )
}

/**
 * The Moon's sky: no air, so it is black even in daylight, the Sun is a
 * small hard disc and shadows are sharp and almost black. Earth hangs high
 * in the sky at the real angle for each landing site. A faint star field
 * stays for wonder (in daylight photos the bright ground hides the stars).
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
        <Starfield count={Math.round(preset.starCount * 0.6)} reducedMotion={reducedMotion} />
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
        <Suspense fallback={null}>
          <Earth direction={earth} />
        </Suspense>
      </group>

      {/* Sunlight only, plus a weak fill standing in for light bounced off
          the ground, so shadowed sides stay readable for children. */}
      <ambientLight intensity={0.12} color="#c9ccd6" />
      <hemisphereLight args={['#20242e', '#8a8680', 0.55]} />
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
