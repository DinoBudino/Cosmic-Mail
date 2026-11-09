import * as THREE from 'three'
import { mulberry32 } from './random'

/** Stars sit just inside the sky dome so the terrain still occludes them. */
export const STAR_RADIUS = 385

const BAND_NORMAL = new THREE.Vector3(0.34, 0.72, -0.6).normalize()

const STAR_COLORS = ['#FFF0E8', '#E0D4FF', '#FFD9E8', '#D8C4FF'] as const

/**
 * Builds a deterministic upper-hemisphere starfield with a denser galactic
 * band. The band is decorative: it is a stylistic "dust lane", not an
 * astronomical map.
 */
export function buildStarGeometry(count: number): THREE.BufferGeometry {
  const random = mulberry32(0x57a25)
  const starCount = Math.max(1, Math.floor(count))
  const bandCount = Math.floor(starCount * 0.36)

  const positions = new Float32Array(starCount * 3)
  const colors = new Float32Array(starCount * 3)
  const sizes = new Float32Array(starCount)
  const phases = new Float32Array(starCount)
  const alphas = new Float32Array(starCount)

  const color = new THREE.Color()
  const white = new THREE.Color('#ffffff')
  const bandColor = new THREE.Color('#D8C4FF')
  const direction = new THREE.Vector3()

  const bandU = new THREE.Vector3(1, 0, 0).cross(BAND_NORMAL).normalize()
  const bandV = new THREE.Vector3().crossVectors(BAND_NORMAL, bandU).normalize()

  for (let index = 0; index < starCount; index += 1) {
    const inBand = index < bandCount

    if (inBand) {
      const angle = random() * Math.PI * 2
      const scatter = (random() + random() + random() - 1.5) * 0.16
      direction
        .copy(bandU)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(bandV, Math.sin(angle))
        .addScaledVector(BAND_NORMAL, scatter)
        .normalize()
    } else {
      const y = random()
      const phi = random() * Math.PI * 2
      const radius = Math.sqrt(1 - y * y)
      direction.set(Math.cos(phi) * radius, y, Math.sin(phi) * radius)
    }

    const horizonFade = THREE.MathUtils.smoothstep(direction.y, 0.02, 0.32)
    const bright = !inBand && random() > 0.985
    const baseSize = bright
      ? 3.4 + random() * 2.4
      : inBand
        ? 0.7 + random() * 0.9
        : 0.9 + random() * 2.1
    const size = baseSize * (0.55 + horizonFade * 0.45)

    const baseAlpha = inBand
      ? 0.28 + random() * 0.3
      : 0.45 + random() * 0.45
    const alpha = (bright ? 0.95 : baseAlpha) * horizonFade

    if (inBand) {
      color.copy(bandColor).lerp(white, random() * 0.7)
    } else {
      const paletteColor =
        STAR_COLORS[Math.floor(random() * STAR_COLORS.length)] ??
        STAR_COLORS[0]
      color.set(paletteColor)
    }

    positions[index * 3] = direction.x * STAR_RADIUS
    positions[index * 3 + 1] = direction.y * STAR_RADIUS
    positions[index * 3 + 2] = direction.z * STAR_RADIUS

    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b

    sizes[index] = size
    phases[index] = random() * Math.PI * 2
    alphas[index] = alpha
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
  geometry.computeBoundingSphere()
  return geometry
}
