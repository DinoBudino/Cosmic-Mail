import * as THREE from 'three'
import { mulberry32 } from './random'

/**
 * Procedural surface detail for the CM-01 cabin. The Blender build has
 * flat colours and no textures (and not every mesh has UVs), which made
 * the room look plain next to the detailed PIP model. Instead of baking
 * textures, each standard material gets a small shader patch driven by
 * 3D noise in world space — no UVs needed, no seams:
 *
 * - mottle: large, soft tone variation (worn paint, slight grime)
 * - grain: fine speckle in colour and micro-relief
 * - streaks: brushed lines along the horizontal for metal panels
 * - plate: raised diamond tread for the floor
 * - panels: seams and corner rivets projected on the dominant face axis
 * - roughness varies with the same noise, so highlights break up.
 *
 * Performance: the cabin fills the whole screen, so this runs for almost
 * every pixel and must stay light on integrated GPUs. Noise is a single
 * texture fetch from a small precomputed 3D lattice (not hashed math),
 * each term is evaluated ONCE per pixel (in the colour chunk) and reused
 * by the roughness and relief chunks, and features a preset does not use
 * are compiled out with #defines.
 */
export interface SurfacePreset {
  /** Soft tone variation amount (fraction of the base colour). */
  mottle: number
  /** Fine speckle amount. */
  grain: number
  /** Brushed horizontal streaks amount. */
  streaks: number
  /** Micro-relief strength (bump). */
  bump: number
  /** Roughness variation amount. */
  rough: number
  /** Diamond-plate tread (floor only). */
  plate: boolean
  /** World-space scale of the fine grain (higher = finer). */
  grainScale: number
  /** Sci-fi panel seams with corner rivets (0 = none, 1 = full). */
  panels: number
}

const PAINTED: SurfacePreset = { mottle: 0.1, grain: 0.03, streaks: 0, bump: 0.3, rough: 0.14, plate: false, grainScale: 45, panels: 0 }
const METAL: SurfacePreset = { mottle: 0.12, grain: 0.03, streaks: 0.04, bump: 0.3, rough: 0.16, plate: false, grainScale: 55, panels: 1 }
/** White hull panels: painted, with seams and rivets. */
const HULL: SurfacePreset = { mottle: 0.1, grain: 0.03, streaks: 0, bump: 0.3, rough: 0.14, plate: false, grainScale: 45, panels: 1 }
const DARK: SurfacePreset = { mottle: 0.11, grain: 0.04, streaks: 0.05, bump: 0.3, rough: 0.18, plate: false, grainScale: 55, panels: 0 }
const FABRIC: SurfacePreset = { mottle: 0.07, grain: 0.07, streaks: 0, bump: 0.45, rough: 0.05, plate: false, grainScale: 120, panels: 0 }
const FLOOR: SurfacePreset = { mottle: 0.2, grain: 0.06, streaks: 0, bump: 0.8, rough: 0.15, plate: true, grainScale: 60, panels: 0 }

/** Which cabin materials get which surface; emissive and glass stay clean. */
export const CABIN_SURFACES: Readonly<Record<string, SurfacePreset>> = {
  CM_PANEL_LIGHT: METAL,
  CM_PANEL_MID: METAL,
  CM_PANEL_WHITE: HULL,
  CM_PANEL_DARK: DARK,
  CM_NIGHT: DARK,
  CM_SEAM: DARK,
  CM_ORANGE: PAINTED,
  CM_HAZARD_Y: PAINTED,
  CM_HAZARD_K: DARK,
  CM_GOLD: METAL,
  CM_RED: PAINTED,
  CM_SEAT_CREAM: FABRIC,
  CM_SEAT_DARK: FABRIC,
  CM_ALBUM_COVER: FABRIC,
  CM_FLOOR: FLOOR,
}

const glslFloat = (value: number) => (Number.isInteger(value) ? `${value}.0` : `${value}`)

/** Preset values as compile-time constants (unused features vanish). */
export function surfaceDefines(preset: SurfacePreset): string {
  const lines = [
    `#define CM_MOTTLE ${glslFloat(preset.mottle)}`,
    `#define CM_GRAIN ${glslFloat(preset.grain)}`,
    `#define CM_BUMP ${glslFloat(preset.bump)}`,
    `#define CM_ROUGH ${glslFloat(preset.rough)}`,
    `#define CM_GRAIN_SCALE ${glslFloat(preset.grainScale)}`,
  ]
  if (preset.streaks > 0) lines.push(`#define CM_STREAKS ${glslFloat(preset.streaks)}`)
  if (preset.plate) lines.push('#define CM_PLATE')
  if (preset.panels > 0) lines.push(`#define CM_PANELS ${glslFloat(preset.panels)}`)
  return lines.join('\n')
}

/** Edge of the tiling noise lattice (texels); 64 m of noise space per tile. */
export const NOISE_SIZE = 64

let noiseTexture: THREE.Data3DTexture | null = null

/**
 * Shared tiling lattice of random values (64³, 256 KB) for cmNoise.
 * Built once, on first use, and reused by every cabin material.
 */
export function cabinNoiseTexture(): THREE.Data3DTexture {
  if (noiseTexture) return noiseTexture
  const random = mulberry32(0xc4b1)
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE * NOISE_SIZE)
  for (let index = 0; index < data.length; index += 1) data[index] = Math.floor(random() * 256)
  const texture = new THREE.Data3DTexture(data, NOISE_SIZE, NOISE_SIZE, NOISE_SIZE)
  texture.format = THREE.RedFormat
  texture.type = THREE.UnsignedByteType
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.wrapR = THREE.RepeatWrapping
  texture.unpackAlignment = 1
  texture.generateMipmaps = false
  texture.needsUpdate = true
  noiseTexture = texture
  return texture
}

const NOISE_GLSL = /* glsl */ `
varying vec3 vCmPos;
varying vec3 vCmNormal;

uniform highp sampler3D cmNoiseTex;

// Value noise read from a precomputed lattice (one hardware-filtered
// texture fetch instead of eight hashes). Snapping the sample position
// to the texel grid plus a smoothstep inside the cell keeps the soft
// look of the original procedural value noise.
float cmNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return texture(cmNoiseTex, (i + f + 0.5) * (1.0 / ${NOISE_SIZE}.0)).r;
}

// Fine detail fades out where it would be smaller than a pixel, so it
// never shimmers into static.
float cmFade(vec3 p, float scale) {
  return clamp(1.6 - length(fwidth(p * scale)) * 1.4, 0.0, 1.0);
}

#ifdef CM_PLATE
// Diamond tread on the floor plane (XZ): raised lozenges in a grid.
float cmPlate(vec3 p) {
  vec2 q = p.xz * 9.0;
  vec2 cell = fract(q) - 0.5;
  float row = mod(floor(q.y), 2.0);
  vec2 r = row > 0.5 ? vec2(cell.x + cell.y, cell.x - cell.y) : vec2(cell.x - cell.y, cell.x + cell.y);
  float lozenge = 1.0 - smoothstep(0.08, 0.12, abs(r.x));
  return lozenge * (1.0 - smoothstep(0.25, 0.32, abs(r.y)));
}
#endif

#ifdef CM_PANELS
// Panel seams + rivets on the plane of the dominant face axis. Returns
// x = seam mask (1 on the groove), y = rivet mask (1 on the rivet head).
vec2 cmPanelMask(vec3 p, vec3 n) {
  vec3 a = abs(n);
  vec2 uv = a.x > a.y && a.x > a.z ? p.zy : (a.y > a.z ? p.xz : p.xy);
  vec2 size = vec2(0.62, 0.42);
  vec2 cell = uv / size;
  vec2 f = fract(cell);
  vec2 edge = min(f, 1.0 - f) * size;
  float d = min(edge.x, edge.y);
  float w = max(fwidth(d), 1e-4);
  float seam = 1.0 - smoothstep(0.0025, 0.0025 + w * 1.5, d);
  // Rivets just inside each panel corner.
  vec2 corner = edge - vec2(0.03);
  float r = length(corner);
  float rivet = 1.0 - smoothstep(0.007, 0.007 + w * 1.5, r);
  float fade = clamp(1.6 - length(fwidth(cell)) * 18.0, 0.0, 1.0);
  return vec2(seam, rivet) * fade * CM_PANELS;
}
#endif

vec3 cmPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sigmaX = dFdx(surfPos);
  vec3 sigmaY = dFdy(surfPos);
  vec3 r1 = cross(sigmaY, surfNorm);
  vec3 r2 = cross(surfNorm, sigmaX);
  float det = dot(sigmaX, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}

// Per-pixel terms, computed once in the colour chunk and reused below.
float cmMottleV;
float cmGrainV;
float cmHeightV;
`

/** Colour: every noise term evaluated here exactly once. */
const COLOR_GLSL = /* glsl */ `
{
  vec3 p = vCmPos;
  // Mottle: 3-octave value noise (soft, large).
  vec3 q = p * 1.6;
  float n0 = cmNoise(q);
  float n1 = cmNoise(q * 2.03);
  float n2 = cmNoise(q * 4.12);
  cmMottleV = n0 * 0.5714 + n1 * 0.2857 + n2 * 0.1429 - 0.5;
  cmGrainV = (cmNoise(p * CM_GRAIN_SCALE) - 0.5) * cmFade(p, CM_GRAIN_SCALE);
  float tone = 1.0 + cmMottleV * CM_MOTTLE * 2.0 + cmGrainV * CM_GRAIN * 2.0;
  // Relief: one medium-scale octave (dents, waves) plus the patterns.
  cmHeightV = (cmNoise(p * 7.0) - 0.5) * 0.5;
#ifdef CM_STREAKS
  tone += (cmNoise(vec3(p.x * 2.0, p.y * 45.0, p.z * 2.0)) - 0.5) * cmFade(p, 45.0) * CM_STREAKS;
#endif
#ifdef CM_PLATE
  float plate = cmPlate(p);
  tone -= plate * 0.12;
  cmHeightV += plate * 0.6;
#endif
#ifdef CM_PANELS
  vec2 panel = cmPanelMask(p, vCmNormal);
  tone *= 1.0 - panel.x * 0.38 + panel.y * 0.12;
  cmHeightV += -panel.x * 0.8 + panel.y * 0.9;
#endif
  diffuseColor.rgb *= tone;
}
`

const ROUGHNESS_GLSL = /* glsl */ `
roughnessFactor = clamp(roughnessFactor + cmMottleV * CM_ROUGH * 2.0 + cmGrainV * CM_ROUGH, 0.08, 1.0);
`

const NORMAL_GLSL = /* glsl */ `
{
  vec2 cmD = vec2(dFdx(cmHeightV), dFdy(cmHeightV)) * CM_BUMP * 0.04;
  normal = cmPerturb(-vViewPosition, normal, cmD, faceDirection);
}
`

/**
 * Patches a cabin material with the procedural surface. Safe to call once
 * per material (the GLB shares materials between meshes).
 */
export function applyCabinSurface(material: THREE.Material, preset: SurfacePreset): void {
  const standard = material as THREE.MeshStandardMaterial
  if (!standard.isMeshStandardMaterial) return
  const defines = surfaceDefines(preset)
  standard.onBeforeCompile = (shader) => {
    shader.uniforms.cmNoiseTex = { value: cabinNoiseTexture() }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCmPos;\nvarying vec3 vCmNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvCmPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCmNormal = normalize(mat3(modelMatrix) * objectNormal);',
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${defines}\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${COLOR_GLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${ROUGHNESS_GLSL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${NORMAL_GLSL}`)
  }
  standard.customProgramCacheKey = () => `cm-surface-${defines}`
  standard.needsUpdate = true
}
