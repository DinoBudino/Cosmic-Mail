import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS } from '../data/marsObjects'
import { mulberry32 } from './random'
import {
  distanceToPath,
  getTerrainHeight,
  getTerrainSlope,
} from './terrainHeight'
import { PALETTE, QUALITY_PRESETS, WORLD, type Quality } from './worldConfig'

interface TerrainProps {
  quality: Quality
}

const TERRAIN_COLORS = {
  dark: new THREE.Color(PALETTE.terrainDark),
  mid: new THREE.Color(PALETTE.terrainMid),
  light: new THREE.Color(PALETTE.terrainLight),
  high: new THREE.Color(PALETTE.terrainHigh),
  path: new THREE.Color(PALETTE.path),
}

function buildTerrainGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(
    WORLD.terrainSize,
    WORLD.terrainSize,
    WORLD.terrainSegments,
    WORLD.terrainSegments,
  )
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.attributes.position
  if (!position) return geometry

  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const z = position.getZ(index)
    const height = getTerrainHeight(x, z)
    position.setY(index, height)

    const heightT = THREE.MathUtils.clamp((height + 3.5) / 9, 0, 1)
    if (heightT < 0.5) {
      color
        .copy(TERRAIN_COLORS.dark)
        .lerp(TERRAIN_COLORS.mid, heightT * 2)
    } else {
      color
        .copy(TERRAIN_COLORS.mid)
        .lerp(TERRAIN_COLORS.light, (heightT - 0.5) * 2)
    }

    if (height > 5) {
      color.lerp(
        TERRAIN_COLORS.high,
        THREE.MathUtils.clamp((height - 5) / 4, 0, 1) * 0.6,
      )
    }

    const pathDistance = distanceToPath(x, z)
    if (pathDistance < 3.4) {
      const pathBlend =
        1 - THREE.MathUtils.smoothstep(pathDistance, 1.1, 3.4)
      color.lerp(TERRAIN_COLORS.path, pathBlend * 0.5)
    }

    const variationValue =
      Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
    const variation = variationValue - Math.floor(variationValue)
    color.multiplyScalar(0.94 + variation * 0.12)

    color.toArray(colors, index * 3)
  }

  position.needsUpdate = true
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

interface RockInstance {
  x: number
  y: number
  z: number
  scale: number
  rotation: number
  tilt: number
  color: THREE.Color
}

function createRocks(count: number): RockInstance[] {
  const random = mulberry32(0x5eed1)
  const rocks: RockInstance[] = []
  const maxAttempts = count * 40
  let attempts = 0

  while (rocks.length < count && attempts < maxAttempts) {
    attempts += 1
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * (WORLD.playRadius + 7)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    if (Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < 3.5) continue
    if (distanceToPath(x, z) < 2.6) continue

    let nearSite = false
    for (const object of MARS_OBJECTS) {
      if (
        Math.hypot(
          x - object.position.x,
          z - object.position.z,
        ) < 6.5
      ) {
        nearSite = true
        break
      }
    }
    if (nearSite) continue
    if (getTerrainSlope(x, z) > 0.62) continue

    const isBoulder = rocks.length % 19 === 0
    const scale = isBoulder ? 1.6 + random() * 1.7 : 0.22 + random() * 1.05
    rocks.push({
      x,
      y: getTerrainHeight(x, z) + scale * 0.42,
      z,
      scale,
      rotation: random() * Math.PI * 2,
      tilt: (random() - 0.5) * 0.35,
      color: new THREE.Color(
        random() > 0.5 ? PALETTE.rockDark : PALETTE.rockLight,
      ),
    })
  }

  return rocks
}

function Rocks({ quality }: { quality: Quality }) {
  const count = QUALITY_PRESETS[quality].rockCount
  const rocks = useMemo(() => createRocks(count), [count])
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = new THREE.Object3D()
    for (let index = 0; index < rocks.length; index += 1) {
      const rock = rocks[index]
      if (!rock) continue
      dummy.position.set(rock.x, rock.y, rock.z)
      dummy.rotation.set(rock.tilt, rock.rotation, rock.tilt * 0.6)
      dummy.scale.setScalar(rock.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      mesh.setColorAt(index, rock.color)
    }

    mesh.count = rocks.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [rocks])

  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.92} metalness={0.03} flatShading />
    </instancedMesh>
  )
}

interface MesaInstance {
  x: number
  z: number
  width: number
  height: number
  rotation: number
  color: string
}

function DistantMesas() {
  const mesas = useMemo<MesaInstance[]>(() => {
    const random = mulberry32(0x5e7a)
    const near = Array.from({ length: 16 }, (_, index) => {
      const angle = (index / 16) * Math.PI * 2 + 0.22
      const radius = 88 + (index % 4) * 8 + random() * 6
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        width: 12 + random() * 16,
        height: 9 + random() * 13,
        rotation: random() * Math.PI * 2,
        color: index % 3 === 0 ? PALETTE.mesaFar : PALETTE.mesaNear,
      }
    })
    const far = Array.from({ length: 10 }, (_, index) => {
      const angle = (index / 10) * Math.PI * 2 + 0.5
      const radius = 120 + (index % 3) * 7 + random() * 7
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        width: 22 + random() * 18,
        height: 18 + random() * 16,
        rotation: random() * Math.PI * 2,
        color: PALETTE.mesaFar,
      }
    })
    return [...near, ...far]
  }, [])

  return (
    <group>
      {mesas.map((mesa, index) => (
        <mesh
          key={index}
          position={[
            mesa.x,
            getTerrainHeight(mesa.x, mesa.z) + mesa.height / 2 - 1.2,
            mesa.z,
          ]}
          rotation={[0, mesa.rotation, 0]}
        >
          <coneGeometry args={[mesa.width, mesa.height, 5, 1]} />
          <meshStandardMaterial
            color={mesa.color}
            roughness={1}
            metalness={0}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

export function Terrain({ quality }: TerrainProps) {
  const geometry = useMemo(() => buildTerrainGeometry(), [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.96}
          metalness={0.02}
        />
      </mesh>
      <Rocks quality={quality} />
      <DistantMesas />
    </group>
  )
}
