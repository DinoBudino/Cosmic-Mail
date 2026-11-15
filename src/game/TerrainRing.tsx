import {
  forwardRef,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { buildTerrainRingGeometry } from './terrainSurface'

interface TerrainRingProps {
  /** World centre of the ring. The parent must sit at this x/z. */
  x: number
  z: number
  /** World y of the parent group (usually the ground under its centre). */
  baseY: number
  innerRadius: number
  outerRadius: number
  segments?: number
  /** Height above the ground, avoids z-fighting with the terrain mesh. */
  lift?: number
  /** Mesh origin, when the parent group is not already at (x, baseY, z). */
  position?: [number, number, number]
  userData?: Record<string, unknown>
  children: ReactNode
}

/**
 * A flat ring that follows the terrain instead of hovering or sinking.
 * Every vertex samples the heightfield, so on a slope the ring drapes over
 * the ground while staying readable as a circle. MeshBasic materials do not
 * depend on normals; DoubleSide callers keep it visible from either side.
 */
export const TerrainRing = forwardRef<THREE.Mesh, TerrainRingProps>(
  function TerrainRing(
    {
      x,
      z,
      baseY,
      innerRadius,
      outerRadius,
      segments = 72,
      lift = 0.06,
      position = [0, 0, 0],
      userData,
      children,
    },
    ref,
  ) {
    const geometry = useMemo(() => {
      return buildTerrainRingGeometry({
        x,
        z,
        baseY,
        innerRadius,
        outerRadius,
        segments,
        lift,
      })
    }, [x, z, baseY, innerRadius, outerRadius, segments, lift])

    useEffect(() => () => geometry.dispose(), [geometry])

    return (
      <mesh ref={ref} geometry={geometry} position={position} userData={userData}>
        {children}
      </mesh>
    )
  },
)
