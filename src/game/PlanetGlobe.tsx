import { useFrame, useLoader } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * Planet globes built from the Blender models in blender/Earth,
 * blender/Mars and blender/Moon.
 *
 * Earth from blender/Earth/earth.blend: day color map, city lights on the
 * night side, ocean shine (spec mask) and a separate cloud layer. The
 * Blender textures are huge (up to 21600 px); public/textures/earth holds
 * web copies (≤2048 px, ~1 MB total) so it stays light on any PC.
 */
const BASE = `${import.meta.env.BASE_URL}textures/earth/`
const DAY = `${BASE}earth-day.jpg`
const NIGHT = `${BASE}earth-night.jpg`
const CLOUDS = `${BASE}earth-clouds.jpg`
const ROUGHNESS = `${BASE}earth-roughness.jpg`
const BUMP = `${BASE}earth-bump.jpg`
const TEXTURES = `${import.meta.env.BASE_URL}textures/`

/** Same direction as the scene's key light (world space). */
const SUN_WORLD = new THREE.Vector3(-6, 8, 10).normalize()
/** Same proportions as earth.blend: clouds 2.024 m, atmosphere 2.034 m (/2 m). */
const CLOUD_SCALE = 1.012
const ATMOSPHERE_SCALE = 1.017
const CLOUD_OPACITY = 0.8

/** Blue rim of air, brightest at the edge (Fresnel), added on top. */
function makeAtmosphereMaterial(color: string, strength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
    },
    vertexShader: `varying vec3 vNormal; varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength;
varying vec3 vNormal; varying vec3 vView;
void main() {
  float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.6) * uStrength;
  gl_FragColor = vec4(uColor * rim, rim);
}`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

const EARTH_TEXTURE_URLS = [DAY, NIGHT, CLOUDS, ROUGHNESS, BUMP]

/** Sets color space and filtering as each texture arrives. */
class PlanetTextureLoader extends THREE.TextureLoader {
  override load(
    url: string,
    onLoad?: (texture: THREE.Texture<HTMLImageElement>) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): THREE.Texture<HTMLImageElement> {
    return super.load(
      url,
      (texture) => {
        if (url === DAY || url === NIGHT || url.endsWith('-color.jpg')) texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 4
        onLoad?.(texture)
      },
      onProgress,
      onError,
    )
  }
}

export function EarthSurface({ radius, spin }: { radius: number; spin: boolean }) {
  const [day, night, clouds, roughness, bump] = useLoader(
    PlanetTextureLoader,
    EARTH_TEXTURE_URLS,
  )
  const cloudsRef = useRef<THREE.Mesh>(null)
  const sunView = useMemo(() => ({ value: new THREE.Vector3() }), [])

  // City lights only on the side facing away from the sun, like the
  // ColorRamp mix in the Blender "day" material.
  const surface = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      map: day,
      roughnessMap: roughness,
      roughness: 1,
      metalness: 0,
      bumpMap: bump,
      bumpScale: 1.6,
      emissiveMap: night,
      emissive: new THREE.Color('#ffd9a0'),
      emissiveIntensity: 1.4,
    })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSunView = sunView
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 uSunView;\nvoid main() {')
        .replace(
          '#include <emissivemap_fragment>',
          `#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
  float nightSide = smoothstep( 0.1, -0.3, dot( normal, uSunView ) );
  totalEmissiveRadiance *= emissiveColor.rgb * nightSide;
#endif`,
        )
    }
    return material
  }, [day, night, roughness, bump, sunView])

  const cloudMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        alphaMap: clouds,
        transparent: true,
        opacity: CLOUD_OPACITY,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      }),
    [clouds],
  )

  const atmosphere = useMemo(() => makeAtmosphereMaterial('#5fa8ff', 1.3), [])

  useEffect(
    () => () => {
      surface.dispose()
      cloudMaterial.dispose()
      atmosphere.dispose()
    },
    [surface, cloudMaterial, atmosphere],
  )

  useFrame(({ camera }, delta) => {
    sunView.value.copy(SUN_WORLD).transformDirection(camera.matrixWorldInverse)
    // Clouds drift a little faster than the ground below.
    if (spin && cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.006
  })

  return (
    <group>
      <mesh material={surface}>
        <sphereGeometry args={[radius, 64, 48]} />
      </mesh>
      <mesh
        ref={cloudsRef}
        scale={CLOUD_SCALE}
        material={cloudMaterial}
        userData={{ baseOpacity: CLOUD_OPACITY }}
      >
        <sphereGeometry args={[radius, 64, 48]} />
      </mesh>
      <mesh scale={ATMOSPHERE_SCALE} material={atmosphere} userData={{ baseOpacity: 1 }}>
        <sphereGeometry args={[radius, 64, 48]} />
      </mesh>
    </group>
  )
}

/**
 * Mars (blender/Mars/Mars_2K.blend, its cube-mapped textures baked to a
 * sphere map in Blender) and the Moon (blender/Moon/Moon.glb, LROC color
 * map). Relief comes from a grayscale copy of the color map.
 */
const ROCKY = {
  mars: {
    color: `${TEXTURES}mars/mars-color.jpg`,
    bump: `${TEXTURES}mars/mars-bump.jpg`,
    bumpScale: 1.2,
    // Thin dusty air, as the "Atmosphere" shell in Mars_2K.blend.
    air: { color: '#ffb27a', strength: 0.9, scale: 1.0126 },
  },
  moon: {
    color: `${TEXTURES}moon/moon-color.jpg`,
    bump: `${TEXTURES}moon/moon-bump.jpg`,
    bumpScale: 1.6,
    air: null,
  },
} as const

export type RockyPlanet = keyof typeof ROCKY

export function RockySurface({ kind, radius }: { kind: RockyPlanet; radius: number }) {
  const spec = ROCKY[kind]
  const [color, bump] = useLoader(PlanetTextureLoader, [spec.color, spec.bump])
  const surface = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: color,
        bumpMap: bump,
        bumpScale: spec.bumpScale,
        roughness: 0.95,
        metalness: 0,
      }),
    [color, bump, spec.bumpScale],
  )
  const air = spec.air
  const atmosphere = useMemo(
    () => (air ? makeAtmosphereMaterial(air.color, air.strength) : null),
    [air],
  )
  useEffect(
    () => () => {
      surface.dispose()
      atmosphere?.dispose()
    },
    [surface, atmosphere],
  )
  return (
    <group>
      <mesh material={surface}>
        <sphereGeometry args={[radius, 64, 48]} />
      </mesh>
      {air && atmosphere && (
        <mesh scale={air.scale} material={atmosphere} userData={{ baseOpacity: 1 }}>
          <sphereGeometry args={[radius, 64, 48]} />
        </mesh>
      )}
    </group>
  )
}
