import * as THREE from 'three'
import { getScanAnchors, SPIRIT_SITE } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { PALETTE } from './worldConfig'

/**
 * Explorer parts that light up during the parts hunt. The part to find
 * now glows on the model itself (a soft warm glow plus a bright outline
 * around its real shape), so the child sees exactly which piece to scan
 * instead of guessing from a box drawn in the air.
 */

export interface GlowInput {
  /** Scanner out (or its panel open) on this explorer. */
  scannerActive: boolean
  /** The explorer has been identified: the parts hunt is on. */
  discovered: boolean
  isNext: boolean
  isAimed: boolean
  isRecorded: boolean
  /** PIP is pointing at this part (Ask PIP hint or a story). */
  hinted: boolean
  hintKind: 'hint' | 'other' | null
  /** 0..1 while holding the scan on this part. */
  scanProgress: number
  /** 0..1 slow breathing (0.5 when motion is reduced). */
  pulse: number
}

export interface GlowLevel {
  /** Emissive strength on the part's own materials. */
  emissive: number
  /** Outline opacity (0 hides it). */
  outline: number
  tone: 'target' | 'aimed' | 'hint'
}

const OFF: GlowLevel = { emissive: 0, outline: 0, tone: 'target' }

/** Pure rule: how much one part glows right now. */
export function getPartGlow(input: GlowInput): GlowLevel {
  if (input.hinted) {
    return {
      emissive: 0.45 + input.pulse * 0.5,
      outline: 0.6 + input.pulse * 0.4,
      tone: input.hintKind === 'hint' ? 'hint' : 'target',
    }
  }
  if (!input.scannerActive || !input.discovered || input.isRecorded) return OFF
  if (input.isAimed) {
    return {
      emissive: 0.35 + input.scanProgress * 0.65,
      outline: 1,
      tone: input.isNext ? 'aimed' : 'target',
    }
  }
  if (input.isNext) {
    return { emissive: 0.18 + input.pulse * 0.32, outline: 0.5 + input.pulse * 0.45, tone: 'target' }
  }
  return OFF
}

const TONES: Record<GlowLevel['tone'], THREE.Color> = {
  target: new THREE.Color(PALETTE.accent),
  aimed: new THREE.Color('#FFF1D6'),
  hint: new THREE.Color('#FFE3A8'),
}
const OUTLINE_TONES: Record<GlowLevel['tone'], THREE.Color> = {
  target: new THREE.Color('#FFB36B'),
  aimed: new THREE.Color('#FFFFFF'),
  hint: new THREE.Color('#FFE3A8'),
}

/** Outline shell: the part's own mesh pushed out along its normals and
 * drawn from behind, so a clean rim of light traces its silhouette. The
 * push is in view space and grows with distance, so the rim keeps about
 * the same width on screen. */
const OUTLINE_VERTEX = /* glsl */ `
  uniform float uThickness;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    mv.xyz += n * uThickness * max(0.6, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const OUTLINE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`

export interface PartGlow {
  componentId: string
  materials: THREE.MeshStandardMaterial[]
  outline: THREE.ShaderMaterial
  shells: THREE.Mesh[]
}

/**
 * Gives one named model part its own materials (so it can glow alone) and
 * an outline shell per mesh. The shells are ignored by the scanner ray.
 */
export function preparePartGlow(target: THREE.Object3D, componentId: string): PartGlow {
  const materials: THREE.MeshStandardMaterial[] = []
  const outline = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: OUTLINE_TONES.target.clone() },
      uOpacity: { value: 0 },
      uThickness: { value: 0.011 },
    },
    vertexShader: OUTLINE_VERTEX,
    fragmentShader: OUTLINE_FRAGMENT,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const meshes: THREE.Mesh[] = []
  target.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object)
  })
  const shells: THREE.Mesh[] = []
  for (const mesh of meshes) {
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const cloned = source.map((material) => {
      const copy = (material as THREE.MeshStandardMaterial).clone()
      copy.emissive = new THREE.Color(0, 0, 0)
      materials.push(copy)
      return copy
    })
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!
    if (!mesh.geometry.getAttribute('normal')) continue
    const shell = new THREE.Mesh(mesh.geometry, outline)
    shell.name = `${mesh.name}_Glow`
    shell.visible = false
    shell.renderOrder = 2
    shell.raycast = () => {}
    shell.userData.scannerIgnore = true
    mesh.add(shell)
    shells.push(shell)
  }
  return { componentId, materials, outline, shells }
}

export function disposePartGlows(glows: readonly PartGlow[]): void {
  for (const glow of glows) {
    for (const material of glow.materials) material.dispose()
    glow.outline.dispose()
  }
}

/** Per frame: reads the scanner, the save and PIP, and lights the parts. */
export function updatePartGlows(glows: readonly PartGlow[], elapsed: number): void {
  if (glows.length === 0) return
  const game = useGameStore.getState()
  const attention = useNarrativeStore.getState().attention
  const progress = useJourneyStore.getState().save?.missions[SPIRIT_SITE.missionId]
  const scanned = progress?.scannedComponentIds ?? []
  const nextId =
    getScanAnchors()
      .map((anchor) => anchor.componentId)
      .find((id) => !scanned.includes(id)) ?? null
  const scannerActive =
    (game.scannerEquipped || game.scannerOpen) &&
    game.scannerMissionId === SPIRIT_SITE.missionId
  const pulse = game.reducedMotion ? 0.5 : 0.5 + Math.sin(elapsed * 3.2) * 0.5
  for (const glow of glows) {
    const isAimed = scannerActive && game.scannerSelectedComponentId === glow.componentId
    const level = getPartGlow({
      scannerActive,
      discovered: Boolean(progress?.discovered),
      isNext: glow.componentId === nextId,
      isAimed,
      isRecorded: scanned.includes(glow.componentId),
      hinted: attention?.componentId === glow.componentId,
      hintKind: attention ? (attention.kind === 'hint' ? 'hint' : 'other') : null,
      scanProgress: isAimed ? game.scannerScanProgress : 0,
      pulse,
    })
    for (const material of glow.materials) {
      if (level.emissive === 0 && material.emissiveIntensity === 0) continue
      material.emissive.copy(TONES[level.tone])
      material.emissiveIntensity = level.emissive
    }
    const showOutline = level.outline > 0.01
    glow.outline.uniforms.uOpacity.value = level.outline
    glow.outline.uniforms.uColor.value.copy(OUTLINE_TONES[level.tone])
    for (const shell of glow.shells) shell.visible = showOutline
  }
}
