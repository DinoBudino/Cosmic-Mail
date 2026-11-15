import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { isPartFilmOn } from '../store/gameStore'
import { CosmicScannerDevice } from './CosmicScannerDevice'

/**
 * First-person view model for the same physical Cosmic Scanner. The outer
 * group follows the active camera each frame, so the device is always in
 * front of the visor without introducing a second scanner design or a
 * separate render scene.
 */
export function ScannerFirstPersonView() {
  const camera = useThree((state) => state.camera)
  const follow = useRef<THREE.Group>(null)

  useFrame(() => {
    const group = follow.current
    if (!group) return
    camera.getWorldPosition(group.position)
    camera.getWorldQuaternion(group.quaternion)
    // The part close-up is a film shot: the device in hand steps out.
    group.visible = !isPartFilmOn()
  })

  return (
    <group ref={follow}>
      <group
        position={[0.27, -0.303, -0.56]}
        rotation={[0.2, Math.PI + 0.3, 0.03]}
        scale={0.88}
      >
        <CosmicScannerDevice emitterName="FP_ScannerEmitter" />
      </group>
    </group>
  )
}
