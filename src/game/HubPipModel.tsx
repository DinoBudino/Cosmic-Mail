import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import * as THREE from 'three'

/**
 * Production PIP (V2) used in the onboarding cabin/hub and on Mars.
 *
 * The exported model faces +Z, Y-up, with its root at the body centre.
 * The cabin's pose logic handles placement, facing the camera, bob and
 * body sway. This component handles the character-level animation:
 * visor expression, talking mouth, blink, antenna and glow pulses.
 */
export type HubPipExpression =
  | 'welcome'
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'satisfied'
  | 'analyzing'
  | 'curious'
  | 'surprised'
  | 'sad'
  | 'confused'
  | 'worried'
  | 'thoughtful'

interface HubPipModelProps {
  expression: HubPipExpression
  talking?: boolean
  reducedMotion?: boolean
  /** Resting antenna sway from the cabin's narrative pose. */
  antennaAmplitude?: number
  /** Scales the 1.0-unit body down to the cabin PIP size. */
  scale?: number
}

/**
 * PIP V2 (blender/PIPV2, exported by scripts/12_export_web.py). The GLB
 * keeps every visor expression as its own mesh group under CTRL_FACE;
 * this component shows exactly one group at a time.
 */
export const PIP_ASSET_URL = 'models/pip-v2.glb'
const PIP_URL = PIP_ASSET_URL
/** The V2 body is ~1.79 units wide; callers size PIP as a 1.0-unit body. */
const BODY_NORMALIZE = 1 / 1.79

type V2Group =
  | 'EXP_01_NEUTRAL'
  | 'EXP_02_ALEGRE'
  | 'EXP_03_GUINO'
  | 'EXP_04_EMOCIONADO'
  | 'EXP_05_CURIOSO'
  | 'EXP_06_ANALIZANDO'
  | 'EXP_07_SATISFECHO'
  | 'EXP_08_SORPRENDIDO'
  | 'EXP_09_PENSATIVO'
  | 'EXP_10_ALEGRE_VISTA_PRINCIPAL'

const V2_GROUPS: V2Group[] = [
  'EXP_01_NEUTRAL',
  'EXP_02_ALEGRE',
  'EXP_03_GUINO',
  'EXP_04_EMOCIONADO',
  'EXP_05_CURIOSO',
  'EXP_06_ANALIZANDO',
  'EXP_07_SATISFECHO',
  'EXP_08_SORPRENDIDO',
  'EXP_09_PENSATIVO',
  'EXP_10_ALEGRE_VISTA_PRINCIPAL',
]

/**
 * Narrative emotion -> visor face. Most emotions use one authored row of
 * the V2 sheet as-is. The sheet has no sad or worried face (its three
 * dots mean "thinking", not sorrow), so those two are composed from the
 * neutral eyes, narrowed, with the happy smile flipped into a frown.
 */
interface FaceStyle {
  group: V2Group
  /** Vertical eye scale: < 1 narrows the eyes (heavy lids). */
  eyeScaleY?: number
  /** Composed frown (thin downturned arc) [width, height] scale; omitted = none. */
  frown?: [number, number]
  /** Eye roll (radians, mirrored per eye): outer corners droop. */
  eyeTilt?: number
  /** Worried brows: slant in radians, inner ends raised (/ \). */
  brows?: number
}

const FACE_STYLE: Record<HubPipExpression, FaceStyle> = {
  welcome: { group: 'EXP_10_ALEGRE_VISTA_PRINCIPAL' },
  neutral: { group: 'EXP_01_NEUTRAL' },
  happy: { group: 'EXP_02_ALEGRE' },
  excited: { group: 'EXP_04_EMOCIONADO' },
  satisfied: { group: 'EXP_07_SATISFECHO' },
  analyzing: { group: 'EXP_06_ANALIZANDO' },
  curious: { group: 'EXP_05_CURIOSO' },
  surprised: { group: 'EXP_08_SORPRENDIDO' },
  // "Huh? That's strange": PIP scans the problem with the target reticle.
  confused: { group: 'EXP_06_ANALIZANDO' },
  thoughtful: { group: 'EXP_09_PENSATIVO' },
  // Brows raised at the inner ends are what make these two read at a
  // glance (a child should see "PIP is worried" without the text).
  worried: { group: 'EXP_01_NEUTRAL', eyeScaleY: 0.85, frown: [1, 1], brows: 0.42 },
  sad: { group: 'EXP_01_NEUTRAL', eyeScaleY: 0.5, frown: [1.1, 1.25], eyeTilt: 0.38, brows: 0.55 },
}

/** Face whose glowing eye material the composed brows and frown share. */
const ARC_SOURCE: V2Group = 'EXP_02_ALEGRE'
/** Composed features in face space (neutral eyes sit at x ±0.315, y 0). */
const BROW_X = 0.3
const BROW_Y = 0.15
const BROW_LENGTH = 0.13
const BROW_RADIUS = 0.02
const FROWN_Y = -0.17
const FROWN_RADIUS = 0.085
/** Visor bulges forward in the centre: mouths sit at the authored mouth depth. */
const FROWN_Z = -0.003

/** Mouth used while speaking when the active face has none of its own. */
// The small round "o" mouth: neutral while speaking. A borrowed smile
// made the analysing reticle and the thinking dots grin mid-sentence.
const TALK_MOUTH_GROUP: V2Group = 'EXP_08_SORPRENDIDO'
/** Warm white of the main-view face, used for every expression. */
const FACE_COLOR = new THREE.Color(1, 0.79, 0.79)

interface FaceGroup {
  group: THREE.Object3D
  eyes: THREE.Mesh[]
  mouths: THREE.Mesh[]
}

interface ClonedPip {
  root: THREE.Group
  faces: Partial<Record<V2Group, FaceGroup>>
  materials: THREE.Material[]
  geometries: THREE.BufferGeometry[]
  antenna?: THREE.Object3D
  /** Composed brows [left, right], hidden unless the face asks for them. */
  brows: THREE.Mesh[]
  /** Composed frown (thin ∩ arc), hidden unless the face asks for it. */
  frown?: THREE.Mesh
  glow: {
    thruster?: THREE.MeshStandardMaterial
    antenna?: THREE.MeshStandardMaterial
  }
  glowBase: {
    thruster: number
    antenna: number
  }
}

/** Re-centres a facial mesh on its own bounds so blink/talk scaling
 *  happens in place. The geometry is cloned first: GLTF clones share it. */
function centreMesh(mesh: THREE.Mesh, geometries: THREE.BufferGeometry[]): void {
  const geometry = mesh.geometry.clone()
  geometry.computeBoundingBox()
  const centre = new THREE.Vector3()
  geometry.boundingBox?.getCenter(centre)
  geometry.translate(-centre.x, -centre.y, -centre.z)
  mesh.geometry = geometry
  mesh.position.add(centre)
  geometries.push(geometry)
}

function clonePip(scene: THREE.Group): ClonedPip {
  const root = scene.clone(true)
  const materials: THREE.Material[] = []
  const geometries: THREE.BufferGeometry[] = []
  const shared = new Map<THREE.Material, THREE.MeshStandardMaterial>()
  let thruster: THREE.MeshStandardMaterial | undefined
  let antennaGlow: THREE.MeshStandardMaterial | undefined

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    const source = Array.isArray(node.material) ? node.material[0] : node.material
    if (!(source instanceof THREE.MeshStandardMaterial)) return
    const name = source.name
    const isFace = name.startsWith('MAT_FACE_EMISSION') || name.startsWith('MAT_MOUTH_EMISSION')
    const isGlow = name === 'MAT_THRUSTER_EMISSION' || name === 'MAT_ANTENNA_EMISSION'
    const isVisor = name === 'MAT_VISOR_OPTICAL_BLACK' || name === 'MAT_VISOR_REFLECTION'
    if (!isFace && !isGlow && !isVisor) return
    // One instance-local copy per source material (glow pulses and the
    // unified face colour must not leak into other PIP instances).
    let material = shared.get(source)
    if (!material) {
      material = source.clone()
      if (isFace) {
        material.emissive.copy(FACE_COLOR)
        material.color.copy(FACE_COLOR)
      }
      if (name === 'MAT_VISOR_OPTICAL_BLACK') {
        // The studio visor is a near-mirror; under the many cabin lights
        // it showed a bright highlight per lamp. Dimmer specular keeps it dark
        // glass with soft sheens.
        material.roughness = 0.12
        if (material instanceof THREE.MeshPhysicalMaterial) {
          material.clearcoat = 0
          material.specularIntensity = 0.12
        }
      }
      // Painted reflection streaks: present but subtle.
      if (name === 'MAT_VISOR_REFLECTION') material.emissiveIntensity = 0.45
      // Thruster: warm yellow-orange flame (reference sheet), not white.
      if (name === 'MAT_THRUSTER_EMISSION') {
        material.emissive.set('#FFB43C')
        material.emissiveIntensity = 3.2
      }
      shared.set(source, material)
      materials.push(material)
      if (name === 'MAT_THRUSTER_EMISSION') thruster = material
      if (name === 'MAT_ANTENNA_EMISSION') antennaGlow = material
    }
    node.material = material
  })

  const faces: Partial<Record<V2Group, FaceGroup>> = {}
  for (const id of V2_GROUPS) {
    const group = root.getObjectByName(id)
    if (!group) continue
    const eyes: THREE.Mesh[] = []
    const mouths: THREE.Mesh[] = []
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      centreMesh(child, geometries)
      if (/_Eye[LR]$/.test(child.name)) eyes.push(child)
      else if (/(Mouth|001)$/.test(child.name)) mouths.push(child)
    })
    group.visible = false
    faces[id] = { group, eyes, mouths }
  }

  // Composed features for worried/sad, in the visor's own glowing
  // material so they read as part of the face: two short rounded brow
  // bars and a thin downturned arc as frown.
  const brows: THREE.Mesh[] = []
  let frown: THREE.Mesh | undefined
  const arc = faces[ARC_SOURCE]?.eyes.find((eye) => /EyeL$/.test(eye.name))
  const faceRoot = faces.EXP_01_NEUTRAL?.group.parent
  if (arc && faceRoot) {
    const browGeometry = new THREE.CapsuleGeometry(BROW_RADIUS, BROW_LENGTH, 4, 12)
    browGeometry.rotateZ(Math.PI / 2)
    geometries.push(browGeometry)
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(browGeometry, arc.material)
      brow.name = side < 0 ? 'COMPOSED_BrowL' : 'COMPOSED_BrowR'
      brow.position.set(side * BROW_X, BROW_Y, arc.position.z)
      brow.scale.z = 0.5
      brow.visible = false
      faceRoot.add(brow)
      brows.push(brow)
    }
    // Symmetric ∩ arc: a torus section centred on the top.
    const FROWN_ARC = Math.PI * 0.62
    const frownGeometry = new THREE.TorusGeometry(FROWN_RADIUS, BROW_RADIUS * 0.85, 8, 24, FROWN_ARC)
    frownGeometry.rotateZ((Math.PI - FROWN_ARC) / 2)
    frownGeometry.computeBoundingBox()
    const frownCentre = new THREE.Vector3()
    frownGeometry.boundingBox?.getCenter(frownCentre)
    frownGeometry.translate(-frownCentre.x, -frownCentre.y, 0)
    geometries.push(frownGeometry)
    frown = new THREE.Mesh(frownGeometry, arc.material)
    frown.name = 'COMPOSED_Frown'
    frown.position.set(0, FROWN_Y, FROWN_Z)
    frown.visible = false
    faceRoot.add(frown)
  }

  // The studio shadow disc is not part of the character.
  const shadow = root.getObjectByName('STUDIO_SHADOW_DISC')
  if (shadow) shadow.visible = false
  // The thruster halo is a soft volumetric glow in Blender; exported it
  // becomes a flat disc under PIP. The emissive core (with bloom in the
  // cabin) already reads as the flame, so the disc is hidden.
  const halo = root.getObjectByName('THRUSTER_HALO')
  if (halo) halo.visible = false
  // Only the large painted streak stays on the visor; the small one
  // added a second bright spot next to the lamp highlights.
  const smallReflection = root.getObjectByName('VISOR_REFLECTION_SMALL')
  if (smallReflection) smallReflection.visible = false

  return {
    root,
    faces,
    brows,
    frown,
    materials,
    geometries,
    antenna: root.getObjectByName('CTRL_ANTENNA') ?? undefined,
    glow: { thruster, antenna: antennaGlow },
    glowBase: {
      thruster: thruster?.emissiveIntensity ?? 1,
      antenna: antennaGlow?.emissiveIntensity ?? 1,
    },
  }
}

/** Keeps a missing/corrupt PIP GLB from taking down the onboarding scene. */
class PipAssetBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.warn('PIP GLB could not be loaded; continuing without the companion.', error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function HubPipModel({
  expression,
  talking = false,
  reducedMotion = false,
  antennaAmplitude = 0.06,
  scale = 0.64,
}: HubPipModelProps) {
  const { scene } = useGLTF(PIP_URL)
  const cloned = useMemo(() => clonePip(scene as THREE.Group), [scene])
  const talkingRef = useRef(talking)
  const antennaAmpRef = useRef(antennaAmplitude)
  const activeRef = useRef<V2Group>(FACE_STYLE[expression].group)

  const styleRef = useRef<FaceStyle>(FACE_STYLE[expression])

  // Exactly one visor expression visible at a time (plus the borrowed
  // frown for composed faces). While speaking, a face without its own
  // mouth borrows the main-view smile.
  useEffect(() => {
    const style = FACE_STYLE[expression]
    const active = style.group
    activeRef.current = active
    styleRef.current = style
    talkingRef.current = talking
    for (const id of V2_GROUPS) {
      const face = cloned.faces[id]
      if (!face) continue
      face.group.visible = id === active
      for (const mouth of face.mouths) {
        mouth.visible = true
        mouth.scale.set(1, 1, 1)
      }
      for (const eye of face.eyes) {
        eye.visible = true
        eye.scale.set(1, id === active ? (style.eyeScaleY ?? 1) : 1, 1)
        const tilt = id === active ? (style.eyeTilt ?? 0) : 0
        // Inner corners up (sad/worried); the opposite slant read as angry.
        eye.rotation.z = /EyeL$/.test(eye.name) ? tilt : -tilt
      }
    }
    // Inner ends up: the left brow turns counter-clockwise, the right
    // one clockwise.
    cloned.brows.forEach((brow, index) => {
      brow.visible = Boolean(style.brows)
      brow.rotation.z = (index === 0 ? 1 : -1) * (style.brows ?? 0)
    })
    if (cloned.frown) {
      cloned.frown.visible = Boolean(style.frown)
      if (style.frown) cloned.frown.scale.set(style.frown[0], style.frown[1], 1)
    }
    if (style.frown) return
    const activeFace = cloned.faces[active]
    const talkFace = cloned.faces[TALK_MOUTH_GROUP]
    if (talking && activeFace && activeFace.mouths.length === 0 && talkFace && active !== TALK_MOUTH_GROUP) {
      talkFace.group.visible = true
      for (const eye of talkFace.eyes) eye.visible = false
    }
  }, [expression, talking, cloned])

  useEffect(() => {
    return () => {
      for (const material of cloned.materials) material.dispose()
      for (const geometry of cloned.geometries) geometry.dispose()
    }
  }, [cloned])

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    const active = cloned.faces[activeRef.current]
    const style = styleRef.current
    const eyeBase = style.eyeScaleY ?? 1
    // Mouth that moves while talking, and its resting vertical scale
    // (the composed frown keeps its own height).
    const talkFace =
      active && active.mouths.length === 0 ? cloned.faces[TALK_MOUTH_GROUP] : active
    const talkMouths: THREE.Mesh[] = style.frown
      ? cloned.frown
        ? [cloned.frown]
        : []
      : (talkFace?.mouths ?? [])
    const mouthBase = style.frown ? style.frown[1] : 1
    const { antenna } = cloned

    if (reducedMotion) {
      for (const face of Object.values(cloned.faces)) {
        for (const mesh of face.eyes) mesh.scale.y = face === active ? eyeBase : 1
      }
      for (const mouth of talkMouths) mouth.scale.y = mouthBase
      if (antenna) antenna.rotation.set(0, 0, 0)
      if (cloned.glow.thruster) cloned.glow.thruster.emissiveIntensity = cloned.glowBase.thruster
      if (cloned.glow.antenna) cloned.glow.antenna.emissiveIntensity = cloned.glowBase.antenna
      return
    }

    // Double micro-blink every few seconds: alive, but never cartoonish.
    const blinkCycle = time % 4.6
    const blinking =
      (blinkCycle > 4.38 && blinkCycle < 4.5) || (blinkCycle > 4.56 && blinkCycle < 4.66)
    if (active) for (const eye of active.eyes) eye.scale.y = blinking ? 0.12 : eyeBase

    // Talking: the visible mouth opens and closes in syllables.
    const syllable = talkingRef.current
      ? Math.abs(Math.sin(time * 13) * 0.7 + Math.sin(time * 7.3) * 0.3)
      : 0
    for (const mouth of talkMouths) mouth.scale.y = mouthBase * (1 + syllable * 0.75)

    // The antenna pivot sits at its base: X/Z sway around it.
    antennaAmpRef.current = THREE.MathUtils.damp(
      antennaAmpRef.current,
      talkingRef.current ? 0.18 : antennaAmplitude,
      5,
      delta,
    )
    if (antenna) {
      antenna.rotation.x = Math.sin(time * 4) * antennaAmpRef.current
      antenna.rotation.z = Math.sin(time * 3.3 + 0.5) * antennaAmpRef.current * 0.35
    }

    // Warm, slow glow pulses on the thruster and the antenna bulb.
    if (cloned.glow.thruster) {
      cloned.glow.thruster.emissiveIntensity =
        cloned.glowBase.thruster * (1 + Math.sin(time * 1.3) * 0.12)
    }
    if (cloned.glow.antenna) {
      cloned.glow.antenna.emissiveIntensity =
        cloned.glowBase.antenna * (1 + Math.sin(time * 2.1 + 1.1) * 0.1)
    }
  })

  return <primitive object={cloned.root} scale={scale * BODY_NORMALIZE} />
}

/**
 * Safe mount point: local Suspense while the GLB loads, and an error
 * boundary so a missing asset degrades to "no PIP" instead of a blank
 * onboarding scene.
 */
export function HubPip(props: HubPipModelProps) {
  return (
    <PipAssetBoundary>
      <Suspense fallback={null}>
        <HubPipModel {...props} />
      </Suspense>
    </PipAssetBoundary>
  )
}

useGLTF.preload(PIP_URL)
