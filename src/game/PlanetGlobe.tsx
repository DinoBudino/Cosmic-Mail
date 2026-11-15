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
        // Sharper at grazing angles: the landing dive looks across the globe.
        texture.anisotropy = 8
        onLoad?.(texture)
      },
      onProgress,
      onError,
    )
  }
}

/**
 * Start downloading every planet texture as soon as this module loads
 * (with the menu), Earth first. The menu then shows the real textured
 * Earth from its first frames instead of a plain stand-in, and Mars and
 * the Moon are ready long before the orbit screen or the cabin window
 * needs them.
 */
function preloadPlanetTextures() {
  useLoader.preload(PlanetTextureLoader, EARTH_TEXTURE_URLS)
  for (const spec of Object.values(ROCKY)) {
    useLoader.preload(PlanetTextureLoader, [spec.color, spec.bump])
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
    // Fine iron-oxide dust gives Mars its orange glow.
    air: { color: '#ff9a55', strength: 1.35, scale: 1.016 },
    // Close-up grain for the landing dive (see addSurfaceDetail).
    detail: { relief: 0.0045, contrast: 0.34 },
  },
  moon: {
    color: `${TEXTURES}moon/moon-color.jpg`,
    bump: `${TEXTURES}moon/moon-bump.jpg`,
    bumpScale: 1.6,
    air: null,
    detail: { relief: 0.006, contrast: 0.3 },
  },
} as const

export type RockyPlanet = keyof typeof ROCKY

/**
 * The globe textures are 2048 px wide: fine from orbit, but the landing
 * dive brings the camera so close that one texel covers a dozen pixels
 * and the ground turns to blur. This adds procedural grain and relief
 * (noise in the sphere's own space, so it never swims) that only fades
 * in as the camera nears the surface, so the orbit view is unchanged.
 */
function addSurfaceDetail(
  material: THREE.MeshStandardMaterial,
  detail: { relief: number; contrast: number },
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDetailRelief = { value: detail.relief }
    shader.uniforms.uDetailContrast = { value: detail.contrast }
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vDetailPos;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDetailPos = normalize(position);')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `varying vec3 vDetailPos;
uniform float uDetailRelief;
uniform float uDetailContrast;
float detailHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float detailNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(detailHash(i), detailHash(i + vec3(1, 0, 0)), f.x),
        mix(detailHash(i + vec3(0, 1, 0)), detailHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(detailHash(i + vec3(0, 0, 1)), detailHash(i + vec3(1, 0, 1)), f.x),
        mix(detailHash(i + vec3(0, 1, 1)), detailHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float detailFbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int k = 0; k < 6; k++) {
    sum += amp * detailNoise(p);
    p = p * 2.07 + 13.1;
    amp *= 0.5;
  }
  return sum;
}
void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  // 0 from orbit, 1 in the last part of the dive.
  float detailFade = smoothstep(2.6, 0.9, length(vViewPosition));
  float detailHeight = 0.0;
  if (detailFade > 0.0) {
    detailHeight = detailFbm(vDetailPos * 70.0);
    // Ridged layer: crisp crater rims and dune crests.
    float ridge = 1.0 - abs(detailNoise(vDetailPos * 410.0) * 2.0 - 1.0);
    detailHeight = detailHeight * 0.75 + ridge * ridge * 0.25;
    diffuseColor.rgb *= mix(1.0, 1.0 + (detailHeight - 0.5) * 2.0 * uDetailContrast, detailFade);
  }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps.replace(
          'normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );',
          `vec2 detailSlope = vec2(dFdx(detailHeight), dFdy(detailHeight)) * uDetailRelief * 220.0 * detailFade;
  normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd() + detailSlope, faceDirection );`,
        ),
      )
  }
}

export function RockySurface({ kind, radius }: { kind: RockyPlanet; radius: number }) {
  const spec = ROCKY[kind]
  const [color, bump] = useLoader(PlanetTextureLoader, [spec.color, spec.bump])
  const surface = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      map: color,
      bumpMap: bump,
      bumpScale: spec.bumpScale,
      roughness: 0.95,
      metalness: 0,
    })
    addSurfaceDetail(material, spec.detail)
    return material
  }, [color, bump, spec])
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

preloadPlanetTextures()
