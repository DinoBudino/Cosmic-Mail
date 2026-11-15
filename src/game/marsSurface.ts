import { useTexture, useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'

const SURFACE_ROOT = `${import.meta.env.BASE_URL}textures/mars/surface/`
export const MARS_GEOLOGY_URL = `${import.meta.env.BASE_URL}models/mars-geology.glb`

/** Blender-authored, periodic PBR maps. Only albedo is decoded from sRGB. */
export function useMarsSurface(kind: 'regolith' | 'basalt') {
  const gl = useThree((state) => state.gl)
  const sources = useTexture([
    `${SURFACE_ROOT}${kind}-color.png`,
    `${SURFACE_ROOT}${kind}-normal.png`,
    `${SURFACE_ROOT}${kind}-roughness.png`,
  ])
  const [color, normal, roughness] = sources
  const maps = useMemo(() => {
    const textures = [color, normal, roughness].map((source, index) => {
      // All consumers use the same sampler. Share the cached GPU textures
      // across every rock batch and scanner site; Drei owns their lifetime.
      const texture = source!
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
      texture.needsUpdate = true
      return texture
    })
    return { map: textures[0]!, normalMap: textures[1]!, roughnessMap: textures[2]! }
  }, [color, normal, roughness, gl])
  return maps
}

/** Geometry is shared by instances; the GLTF loader owns its lifetime. */
export function useMarsRockGeometries() {
  const { nodes } = useGLTF(MARS_GEOLOGY_URL)
  return [0, 1, 2].map((index) => (nodes[`MarsRock${index}`] as THREE.Mesh).geometry)
}

useGLTF.preload(MARS_GEOLOGY_URL)
