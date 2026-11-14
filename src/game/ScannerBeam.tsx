import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { scannerAim } from './scannerAim'
import { approachAlpha, computeBeamSegment } from './scannerBeamSegment'

const BEAM_RADIUS = 0.006
const BEAM_UP = new THREE.Vector3(0, 1, 0)
const BEAM_START = new THREE.Vector3()
const BEAM_DIR = new THREE.Vector3()
const BEAM_CENTER = new THREE.Vector3()
const BEAM_SCALE = new THREE.Vector3()
const BEAM_QUAT = new THREE.Quaternion()
const BEAM_END = { x: 0, y: 0, z: 0 }

interface SharedBeam {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
}

let sharedBeam: SharedBeam | null = null

function getSharedBeam(): SharedBeam {
  if (sharedBeam) return sharedBeam
  // Unit-height open cylinder along +Y: y=-0.5 is the emitter end, y=+0.5
  // the impact end. Vertex colours fade it towards the target so the tip
  // never competes with the reticle.
  const geometry = new THREE.CylinderGeometry(
    BEAM_RADIUS,
    BEAM_RADIUS * 0.6,
    1,
    6,
    1,
    true,
  )
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i += 1) {
    const tip = position.getY(i) > 0
    const level = tip ? 0.3 : 1
    colors[i * 3] = level
    colors[i * 3 + 1] = level
    colors[i * 3 + 2] = level
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.MeshBasicMaterial({
    color: '#E3D9FF',
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.visible = false
  mesh.frustumCulled = false
  mesh.matrixAutoUpdate = false
  mesh.renderOrder = 5
  mesh.userData.scannerIgnore = true
  sharedBeam = { mesh, material }
  return sharedBeam
}

/**
 * Reading beam from the device emitter to the targeted surface.
 *
 * The beam geometry is placed in `onBeforeRender`, i.e. after every
 * `useFrame` of the frame (player, camera, animation mixer and the
 * first-person device) has settled. Reading the emitter earlier gave a
 * one-frame-stale origin that detached the beam from the device. No
 * positive-priority frame callback is used, because that would take over
 * rendering in the Low-quality path.
 */
export function ScannerBeam() {
  const scene = useThree((state) => state.scene)
  const emitter = useRef<THREE.Object3D | null>(null)
  const emitterName = useRef<string | null>(null)
  const alpha = useRef(0)
  const wantsBeam = useRef(false)
  const pulse = useRef(0)

  useFrame((state, delta) => {
    const { mesh } = getSharedBeam()
    const store = useGameStore.getState()
    const active =
      store.scannerEquipped &&
      store.scannerTriggerHeld &&
      Boolean(
        store.scannerSelectedComponentId ||
          store.scannerEnvironmentalId ||
          store.scannerDistractorId ||
          store.scannerTraceKind,
      ) &&
      store.scannerPhysicalState === 'valid' &&
      scannerAim.valid &&
      !isWorldPaused()

    wantsBeam.current = active
    alpha.current = approachAlpha(alpha.current, active ? 1 : 0, delta)
    pulse.current = store.reducedMotion
      ? 0.5
      : 0.5 + Math.sin(state.clock.elapsedTime * 14) * 0.5
    mesh.visible = alpha.current > 0.01

    const firstPerson = store.scannerCamera === 'first-person'
    const name = firstPerson ? 'FP_ScannerEmitter' : 'ScannerEmitter'
    if (emitterName.current !== name) {
      emitterName.current = name
      emitter.current = null
    }
    if (!emitter.current) emitter.current = scene.getObjectByName(name) ?? null
  })

  useEffect(() => {
    const { mesh, material } = getSharedBeam()
    mesh.onBeforeRender = () => {
      const source = emitter.current
      if (!source || alpha.current <= 0.01) {
        material.opacity = 0
        return
      }
      source.updateWorldMatrix(true, false)
      source.getWorldPosition(BEAM_START)
      BEAM_END.x = scannerAim.x
      BEAM_END.y = scannerAim.y
      BEAM_END.z = scannerAim.z
      const segment = computeBeamSegment(BEAM_START, BEAM_END)
      if (!segment) {
        material.opacity = 0
        return
      }
      BEAM_DIR.set(
        segment.direction.x,
        segment.direction.y,
        segment.direction.z,
      )
      BEAM_CENTER.set(segment.center.x, segment.center.y, segment.center.z)
      BEAM_QUAT.setFromUnitVectors(BEAM_UP, BEAM_DIR)
      BEAM_SCALE.set(1, segment.length, 1)
      mesh.matrix.compose(BEAM_CENTER, BEAM_QUAT, BEAM_SCALE)
      mesh.matrixWorld.copy(mesh.matrix)

      const progress = useGameStore.getState().scannerScanProgress
      material.opacity =
        alpha.current * (0.34 + progress * 0.4 + pulse.current * 0.12)
    }
    return () => {
      mesh.onBeforeRender = () => {}
    }
  }, [])

  return <primitive object={getSharedBeam().mesh} />
}
