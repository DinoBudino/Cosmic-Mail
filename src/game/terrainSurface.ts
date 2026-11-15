import * as THREE from 'three'
import { getTerrainHeight } from './terrainHeight'

/** Upward normal of the analytic terrain, used to seat rocks on slopes. */
export function terrainNormal(x: number, z: number, sample = 0.55): THREE.Vector3 {
  const dx =
    (getTerrainHeight(x + sample, z) - getTerrainHeight(x - sample, z)) /
    (sample * 2)
  const dz =
    (getTerrainHeight(x, z + sample) - getTerrainHeight(x, z - sample)) /
    (sample * 2)
  return new THREE.Vector3(-dx, 1, -dz).normalize()
}

export interface TerrainRingOptions {
  x: number
  z: number
  baseY: number
  innerRadius: number
  outerRadius: number
  segments: number
  lift: number
}

/**
 * Ring geometry draped over the heightfield. Vertices are local offsets from
 * the ring centre, with `y = terrainHeight(worldPoint) - baseY + lift`, so the
 * mesh can be placed either at the parent group origin or at (x, baseY, z).
 * Exported so the "never sinks below the ground" contract stays tested.
 */
export function buildTerrainRingGeometry({
  x,
  z,
  baseY,
  innerRadius,
  outerRadius,
  segments,
  lift,
}: TerrainRingOptions): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (const radius of [innerRadius, outerRadius]) {
      const wx = x + cos * radius
      const wz = z + sin * radius
      positions.push(
        cos * radius,
        getTerrainHeight(wx, wz) - baseY + lift,
        sin * radius,
      )
    }
  }
  for (let index = 0; index < segments; index += 1) {
    const a = index * 2
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const next = new THREE.BufferGeometry()
  next.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  next.setIndex(indices)
  next.computeVertexNormals()
  next.computeBoundingSphere()
  return next
}
