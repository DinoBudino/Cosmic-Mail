import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { isWorldPaused, useGameStore } from '../store/gameStore'

/**
 * The hand-held Cosmic Scanner, from blender/Scanner/
 * Cosmic_Mail_Scanner_Master.blend (public/models/cosmic-scanner.glb).
 * Meshes are merged by material and lightly decimated for the web
 * (14 meshes, ~19k triangles).
 *
 * Device frame used by the rest of the game (unchanged): +Z forward, +Y up,
 * origin where the old device had it, so AstronautModel's hand mount, the
 * first-person view and the beam emitter keep working. The Blender model is
 * +X forward / +Z up, 0.18 m tall; here it is turned to +Z forward, scaled
 * to the astronaut's chunky hands and shifted so the grip sits in the palm
 * and the red lens lands where the old emitter was.
 */
const SCANNER_URL = 'models/cosmic-scanner.glb'
const SCALE = 1.7
const MODEL_OFFSET: [number, number, number] = [0, -0.1356, 0.0355]
/** Front of the red lens in device space (the beam starts here). */
const LENS_FRONT: [number, number, number] = [0, 0.114, 0.15]
/** Button pivot travel (glTF x) when the trigger is held, from Button_Press. */
const BUTTON_REST_X = 0.0095
const BUTTON_PRESSED_X = 0.0083

/**
 * Light states authored in the .blend (MAT_*_READY / SCANNING /
 * SCAN_COMPLETE): emission strength per glowing material.
 */
const GLOW = {
  MAT_CyanEmission_READY: { ready: 3, scanning: 7, complete: 4.5 },
  MAT_RedSensor_READY: { ready: 1, scanning: 2.5, complete: 0.8 },
  MAT_OrangeEmission_READY: { ready: 2.5, scanning: 1.2, complete: 6 },
} as const
type GlowName = keyof typeof GLOW

/** Scanning red is brighter than the resting sensor red. */
const RED_READY = new THREE.Color(0.3163, 0.0087, 0.0177)
const RED_SCANNING = new THREE.Color(1, 0.03, 0.051)

export function CosmicScannerDevice({
  emitterName = 'ScannerEmitter',
}: {
  emitterName?: string
}) {
  return (
    <group name="CosmicScannerDevice">
      {/* The emitter exists at once, even while the model is loading. */}
      <group name={emitterName} position={LENS_FRONT} />
      <Suspense fallback={null}>
        <ScannerModel />
      </Suspense>
    </group>
  )
}

function ScannerModel() {
  const { scene } = useGLTF(SCANNER_URL)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const glow = useRef<THREE.Mesh>(null)

  // Own copy per hand/first-person view, with its own glow materials.
  const rig = useMemo(() => buildRig(scene), [scene])

  useEffect(
    () => () => {
      for (const material of rig.glowing.values()) material.dispose()
    },
    [rig],
  )

  useFrame((state, delta) => {
    const store = useGameStore.getState()
    const held = store.scannerEquipped && store.scannerTriggerHeld && !isWorldPaused()
    const scanning =
      held &&
      Boolean(store.scannerSelectedComponentId || store.scannerEnvironmentalId)
    const progress = scanning ? store.scannerScanProgress : 0
    const pulse = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 9) * 0.5 + 0.5
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 12)
    animateRig(rig, { held, scanning, progress, pulse, k })
    if (glow.current) {
      glow.current.visible = scanning
      glow.current.scale.setScalar(1 + progress * 0.7)
    }
  })

  return (
    <>
      <group position={MODEL_OFFSET} rotation={[0, -Math.PI / 2, 0]} scale={SCALE}>
        <primitive object={rig.model} />
      </group>
      {/* Red reading glow at the lens, only while holding the scan. */}
      <mesh ref={glow} position={LENS_FRONT} visible={false}>
        <sphereGeometry args={[0.04, 12, 8]} />
        <meshBasicMaterial
          color="#ff6a5a"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

type ScannerRig = {
  source: THREE.Object3D
  model: THREE.Object3D
  glowing: Map<GlowName, THREE.MeshStandardMaterial>
  button: THREE.Object3D | null
}

function buildRig(scene: THREE.Object3D): ScannerRig {
  const model = scene.clone(true)
  const glowing = new Map<GlowName, THREE.MeshStandardMaterial>()
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    const material = toStandard(mesh.material as THREE.MeshStandardMaterial)
    mesh.material = material
    if (material.name in GLOW) {
      const own = glowing.get(material.name as GlowName) ?? material.clone()
      glowing.set(material.name as GlowName, own)
      mesh.material = own
    }
  })
  return {
    source: scene,
    model,
    glowing,
    button: model.getObjectByName('CTRL_ActivationButton_Pivot') ?? null,
  }
}

/**
 * The .blend uses Blender-only niceties that glTF brings in as
 * MeshPhysicalMaterial: lens transmission (re-renders the whole scene every
 * frame), clearcoat and anisotropy (needs tangents/UVs this model has not,
 * which yields NaN pixels that the bloom pass spreads into a black screen).
 * A plain standard material looks the same at hand size and is light.
 */
const standardCache = new Map<THREE.Material, THREE.MeshStandardMaterial>()
function toStandard(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  if (!(material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return material
  const cached = standardCache.get(material)
  if (cached) return cached
  const glass = (material as THREE.MeshPhysicalMaterial).transmission > 0
  const plain = new THREE.MeshStandardMaterial({
    name: material.name,
    color: material.color,
    roughness: glass ? 0.12 : material.roughness,
    metalness: glass ? 0.3 : material.metalness,
    emissive: material.emissive,
    emissiveIntensity: material.emissiveIntensity,
  })
  standardCache.set(material, plain)
  return plain
}

/** Per-frame light and button state; lives outside the component on purpose. */
function animateRig(
  rig: ScannerRig,
  frame: { held: boolean; scanning: boolean; progress: number; pulse: number; k: number },
) {
  const { held, scanning, progress, pulse, k } = frame
  for (const [name, material] of rig.glowing) {
    const level = GLOW[name]
    const target = !scanning
      ? level.ready
      : progress > 0.92
        ? level.complete
        : level.scanning * (0.8 + pulse * 0.2)
    material.emissiveIntensity += (target - material.emissiveIntensity) * k
    if (name === 'MAT_RedSensor_READY') {
      material.emissive.lerp(scanning ? RED_SCANNING : RED_READY, k)
    }
  }
  if (rig.button) {
    const x = held ? BUTTON_PRESSED_X : BUTTON_REST_X
    rig.button.position.x += (x - rig.button.position.x) * k
  }
}

useGLTF.preload(SCANNER_URL)
