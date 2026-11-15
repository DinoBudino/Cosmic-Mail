import * as THREE from 'three'

/** Placement of the CM-01 cabin GLB (blender/CabinCM01) in the menu scene. */
export const CABIN_URL = 'models/cabin-cm01.glb'
export const CABIN_SCALE = 1.2
/** Places the Blender window centre (0, 3.4, 0.78) at three (0, 0.3, -4.5). */
export const CABIN_OFFSET: [number, number, number] = [0, -0.636, -0.42]

/** Blender cabin coordinates (Z up, +Y toward the window) -> scene. */
export function cabinPoint(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(
    CABIN_SCALE * x + CABIN_OFFSET[0],
    CABIN_SCALE * z + CABIN_OFFSET[1],
    -CABIN_SCALE * y + CABIN_OFFSET[2],
  )
}
