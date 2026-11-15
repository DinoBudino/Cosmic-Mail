import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { PALETTE } from './worldConfig'

/**
 * The look of the single scan, in the world:
 * - while holding, a ring of light climbs the target from bottom to top and
 *   small sparks rise inside it (the ring height IS the scan progress);
 * - when the scan finishes, a soft flash and a ring wave pop on the target.
 *
 * Cheap on purpose (children's PCs): one torus, one ring, one sphere and a
 * 28-point cloud, all additive basic materials, no post-processing. The
 * target's bounds are measured only when the target changes.
 */

const SPARKS = 28
const BURST_SECONDS = 0.8
const TMP_BOX = new THREE.Box3()
const TMP_SIZE = new THREE.Vector3()
const TMP_CENTER = new THREE.Vector3()

interface TargetBounds {
  key: string
  center: THREE.Vector3
  radius: number
  bottom: number
  height: number
}

function targetKeyOf(state: ReturnType<typeof useGameStore.getState>) {
  if (state.scannerEnvironmentalId) return `env:${state.scannerEnvironmentalId}`
  if (state.scannerSelectedComponentId) {
    return `part:${state.scannerSelectedComponentId}`
  }
  if (state.scannerDistractorId) return `distractor:${state.scannerDistractorId}`
  return null
}

function findTarget(scene: THREE.Scene, key: string): THREE.Object3D | null {
  const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
  const field =
    kind === 'env'
      ? 'scannerEnvironmentalId'
      : kind === 'part'
        ? 'scannerComponentId'
        : 'scannerDistractorId'
  let found: THREE.Object3D | null = null
  scene.traverse((object) => {
    if (found) return
    if (object.userData?.[field] === id) found = object
  })
  return found
}

function measure(object: THREE.Object3D, key: string): TargetBounds | null {
  object.updateWorldMatrix(true, true)
  TMP_BOX.makeEmpty()
  object.traverse((child) => {
    if (child.userData?.scannerIgnore) return
    if (!(child instanceof THREE.Mesh) || !child.visible) return
    // Skip invisible hit volumes (opacity 0): only the real shape counts.
    const material = Array.isArray(child.material)
      ? child.material[0]
      : child.material
    if (material && (material.visible === false || material.opacity === 0)) {
      return
    }
    TMP_BOX.expandByObject(child, false)
  })
  if (TMP_BOX.isEmpty()) return null
  TMP_BOX.getSize(TMP_SIZE)
  TMP_BOX.getCenter(TMP_CENTER)
  // Very large targets (the whole rover) keep a readable, local ring.
  const radius = Math.min(2.2, Math.max(0.4, Math.max(TMP_SIZE.x, TMP_SIZE.z) * 0.5))
  return {
    key,
    center: TMP_CENTER.clone(),
    radius,
    bottom: TMP_BOX.min.y,
    height: Math.min(3.2, Math.max(0.35, TMP_SIZE.y)),
  }
}

interface Sparks {
  geometry: THREE.BufferGeometry
  positions: Float32Array
  seeds: { angle: number; r: number; phase: number }[]
}

let sharedSparks: Sparks | null = null
let sparkTexture: THREE.Texture | null = null

/** A soft round dot, so sparks read as glints instead of squares. */
function getSparkTexture(): THREE.Texture | null {
  if (sparkTexture || typeof document === 'undefined') return sparkTexture
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.7)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 32, 32)
  sparkTexture = new THREE.CanvasTexture(canvas)
  return sparkTexture
}

/** One small spark cloud, shared (there is only one scan at a time). */
function getSparks(): Sparks {
  if (sharedSparks) return sharedSparks
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(SPARKS * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  // Each spark: angle, radius factor and phase, fixed for the session.
  const seeds = Array.from({ length: SPARKS }, (_, i) => ({
    angle: (i / SPARKS) * Math.PI * 2 + (i % 3) * 0.7,
    r: 0.25 + ((i * 37) % 10) / 20,
    phase: ((i * 53) % 100) / 100,
  }))
  sharedSparks = { geometry, positions, seeds }
  return sharedSparks
}

export function ScanFx() {
  const scene = useThree((state) => state.scene)
  const sweep = useRef<THREE.Group>(null)
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const discMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const sparkMaterial = useRef<THREE.PointsMaterial>(null)
  const burst = useRef<THREE.Group>(null)
  const burstRing = useRef<THREE.Mesh>(null)
  const burstRingMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const burstFlash = useRef<THREE.Mesh>(null)
  const burstFlashMaterial = useRef<THREE.MeshBasicMaterial>(null)

  const bounds = useRef<TargetBounds | null>(null)
  const alpha = useRef(0)
  const burstSeq = useRef(0)
  const burstAge = useRef(BURST_SECONDS)

  const sparks = getSparks()

  useFrame((state, delta) => {
    const store = useGameStore.getState()
    const dt = Math.min(delta, 0.05)

    // --------------------------------------------------- sweep while holding
    const key = store.scannerEquipped ? targetKeyOf(store) : null
    if (key && bounds.current?.key !== key) {
      const object = findTarget(scene, key)
      bounds.current = object ? measure(object, key) : null
    }
    const progress = store.scannerScanProgress
    const scanning =
      Boolean(key) &&
      bounds.current !== null &&
      store.scannerTriggerHeld &&
      store.scannerPhysicalState === 'valid' &&
      !isWorldPaused()
    alpha.current = THREE.MathUtils.damp(alpha.current, scanning ? 1 : 0, 10, dt)

    const group = sweep.current
    if (group) {
      group.visible = alpha.current > 0.02 && bounds.current !== null
      if (group.visible && bounds.current) {
        const b = bounds.current
        group.position.set(b.center.x, b.bottom + 0.04 + progress * b.height, b.center.z)
        const pulse = store.reducedMotion
          ? 1
          : 1 + Math.sin(state.clock.elapsedTime * 9) * 0.05
        group.scale.setScalar(b.radius * pulse)
        if (ringMaterial.current) ringMaterial.current.opacity = 0.9 * alpha.current
        if (discMaterial.current) discMaterial.current.opacity = 0.1 * alpha.current
        if (sparkMaterial.current) sparkMaterial.current.opacity = 0.95 * alpha.current

        // Sparks rise from the ring and fade, around the target's center.
        const t = state.clock.elapsedTime
        const spark = getSparks()
        for (let i = 0; i < SPARKS; i += 1) {
          const seed = spark.seeds[i]!
          const life = (t * 0.9 + seed.phase) % 1
          const angle = seed.angle + t * 0.6
          spark.positions[i * 3] = Math.cos(angle) * seed.r
          spark.positions[i * 3 + 1] = (life * 0.9) / Math.max(0.6, b.radius)
          spark.positions[i * 3 + 2] = Math.sin(angle) * seed.r
        }
        spark.geometry.attributes.position!.needsUpdate = true
      }
    }

    // ------------------------------------------------------- finish burst
    const celebration = store.scanCelebration
    if (celebration && celebration.seq !== burstSeq.current) {
      burstSeq.current = celebration.seq
      burstAge.current = 0
      const at = bounds.current?.center ?? null
      burst.current?.position.set(
        at?.x ?? celebration.at.x,
        at?.y ?? celebration.at.y,
        at?.z ?? celebration.at.z,
      )
    }
    if (burstAge.current < BURST_SECONDS) {
      burstAge.current += dt
      const k = Math.min(1, burstAge.current / BURST_SECONDS)
      const out = 1 - (1 - k) * (1 - k) * (1 - k)
      const size = (bounds.current?.radius ?? 1) * (0.6 + out * 2.2)
      if (burst.current) burst.current.visible = true
      burstRing.current?.scale.setScalar(size)
      burstFlash.current?.scale.setScalar((bounds.current?.radius ?? 1) * (0.35 + out * 0.45))
      if (burstRingMaterial.current) burstRingMaterial.current.opacity = (1 - k) * 0.9
      if (burstFlashMaterial.current) {
        burstFlashMaterial.current.opacity = (1 - k) * (1 - k) * 0.4
      }
    } else if (burst.current?.visible) {
      burst.current.visible = false
    }
  })

  return (
    <>
      <group ref={sweep} visible={false} userData={{ scannerIgnore: true }}>
        <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ scannerIgnore: true }} renderOrder={6}>
          <torusGeometry args={[1, 0.022, 6, 56]} />
          <meshBasicMaterial
            ref={ringMaterial}
            color={PALETTE.accent}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ scannerIgnore: true }} renderOrder={5}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial
            ref={discMaterial}
            color={PALETTE.dust}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <points geometry={sparks.geometry} userData={{ scannerIgnore: true }} frustumCulled={false}>
          <pointsMaterial
            ref={sparkMaterial}
            color={PALETTE.dust}
            map={getSparkTexture()}
            size={0.12}
            sizeAttenuation
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>

      <group ref={burst} visible={false} userData={{ scannerIgnore: true }}>
        <mesh ref={burstRing} rotation={[-Math.PI / 2, 0, 0]} userData={{ scannerIgnore: true }}>
          <ringGeometry args={[0.86, 1, 48]} />
          <meshBasicMaterial
            ref={burstRingMaterial}
            color={PALETTE.accent}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh ref={burstFlash} userData={{ scannerIgnore: true }}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshBasicMaterial
            ref={burstFlashMaterial}
            color={PALETTE.dust}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </>
  )
}
