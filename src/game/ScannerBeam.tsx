import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { scannerAim } from './scannerAim'

interface SharedBeam {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
}

const BEAM_UP = new THREE.Vector3(0, 1, 0)
const BEAM_START = new THREE.Vector3()
const BEAM_END = new THREE.Vector3()
const BEAM_DIRECTION = new THREE.Vector3()
const BEAM_MIDPOINT = new THREE.Vector3()

let sharedBeam: SharedBeam | null = null

function getSharedBeam(): SharedBeam {
  if (sharedBeam) return sharedBeam
  const geometry = new THREE.CylinderGeometry(0.014, 0.014, 1, 6, 1, true)
  const material = new THREE.MeshBasicMaterial({
    color: '#E3D9FF',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.visible = false
  mesh.frustumCulled = false
  mesh.userData.scannerIgnore = true
  sharedBeam = { mesh, material }
  return sharedBeam
}

/**
 * Cheap reading beam from the hand device to the highlighted component.
 * A single reusable open cylinder, no particles or per-frame allocations.
 */
export function ScannerBeam() {
  const scene = useThree((state) => state.scene)
  const emitter = useRef<THREE.Object3D | null>(null)
  const emitterName = useRef<string | null>(null)

  useFrame(() => {
    const { mesh, material } = getSharedBeam()
    const store = useGameStore.getState()
    const firstPerson =
      store.scannerEquipped && store.scannerCamera === 'first-person'
    const active =
      store.scannerEquipped &&
      store.scannerTriggerHeld &&
      Boolean(
        store.scannerSelectedComponentId || store.scannerEnvironmentalId,
      ) &&
      scannerAim.valid &&
      !isWorldPaused()

    if (!active) {
      mesh.visible = false
      return
    }

    const activeEmitterName = firstPerson
      ? 'FP_ScannerEmitter'
      : 'ScannerEmitter'
    if (emitterName.current !== activeEmitterName) {
      emitterName.current = activeEmitterName
      emitter.current = scene.getObjectByName(activeEmitterName) ?? null
    }
    if (!emitter.current) {
      emitter.current = scene.getObjectByName(activeEmitterName) ?? null
    }

    if (!emitter.current) {
      mesh.visible = false
      return
    }

    emitter.current.getWorldPosition(BEAM_START)
    BEAM_END.set(scannerAim.x, scannerAim.y, scannerAim.z)
    BEAM_DIRECTION.subVectors(BEAM_END, BEAM_START)
    const length = BEAM_DIRECTION.length()
    if (length < 1e-4) {
      mesh.visible = false
      return
    }

    BEAM_MIDPOINT.addVectors(BEAM_START, BEAM_END).multiplyScalar(0.5)
    mesh.position.copy(BEAM_MIDPOINT)
    mesh.quaternion.setFromUnitVectors(
      BEAM_UP,
      BEAM_DIRECTION.normalize(),
    )
    mesh.scale.set(1, length, 1)
    material.opacity = 0.38 + store.scannerScanProgress * 0.5
    mesh.visible = true
  })

  return <primitive object={getSharedBeam().mesh} />
}
