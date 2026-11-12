import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MARS_OBJECTS } from '../data/marsObjects'
import { useGameStore } from '../store/gameStore'
import { makeGlowTexture } from './textures'
import { mulberry32 } from './random'
import {
  buildMesaGeometry,
  buildRockGeometry,
  createRocks,
  ROCK_FORMATIONS,
  type RockInstance,
} from './landscape'
import { playerPosition } from './playerPosition'
import {
  distanceToPath,
  distanceToSurveyTrail,
  getRegionWeight,
  getTerrainHeight,
} from './terrainHeight'
import {
  PALETTE,
  QUALITY_PRESETS,
  SUN_DIRECTION,
  SURVEY_VIEWPOINT,
  WORLD,
  type Quality,
} from './worldConfig'

interface TerrainProps {
  quality: Quality
}

const TERRAIN_COLORS = {
  dark: new THREE.Color(PALETTE.terrainDark),
  mid: new THREE.Color(PALETTE.terrainMid),
  light: new THREE.Color(PALETTE.terrainLight),
  high: new THREE.Color(PALETTE.terrainHigh),
  path: new THREE.Color(PALETTE.path),
  cool: new THREE.Color(PALETTE.rockDark),
}

const OPPORTUNITY = MARS_OBJECTS.find((object) => object.id === 'opportunity')!
const INGENUITY = MARS_OBJECTS.find((object) => object.id === 'ingenuity')!

/** Rover wheel ruts winding east from Opportunity (Zona A storytelling). */
const ROVER_TRACKS: readonly (readonly [number, number])[][] = [
  [[1.5, 2.5], [5, 4.5], [9, 3], [13, 5.5], [17, 4.5]],
  [[1.5, 3.6], [5, 5.6], [9, 4.1], [13, 6.6], [17, 5.6]],
]

/**
 * The ruts are thinner than the terrain vertex spacing (~1.56 u), so vertex
 * coloring cannot show them reliably. Instead they are drawn as a thin
 * ribbon mesh hugging the terrain height — readable at any resolution,
 * with the same deterministic points.
 */
function buildRutGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const halfWidth = 0.35
  for (const rut of ROVER_TRACKS) {
    const world = rut.map(
      ([dx, dz]) => [OPPORTUNITY.position.x + dx, OPPORTUNITY.position.z + dz] as const,
    )
    const dense: (readonly [number, number])[] = []
    for (let index = 0; index < world.length - 1; index += 1) {
      const [ax, az] = world[index]!
      const [bx, bz] = world[index + 1]!
      const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.8))
      for (let step = 0; step < steps; step += 1) {
        dense.push([ax + (bx - ax) * (step / steps), az + (bz - az) * (step / steps)])
      }
    }
    dense.push(world[world.length - 1]!)
    const base = positions.length / 3
    for (let index = 0; index < dense.length; index += 1) {
      const [x, z] = dense[index]!
      const previous = dense[Math.max(0, index - 1)]!
      const next = dense[Math.min(dense.length - 1, index + 1)]!
      let dirX = next[0] - previous[0]
      let dirZ = next[1] - previous[1]
      const length = Math.hypot(dirX, dirZ) || 1
      dirX /= length
      dirZ /= length
      const perpX = -dirZ
      const perpZ = dirX
      for (const side of [-1, 1]) {
        const px = x + perpX * halfWidth * side
        const pz = z + perpZ * halfWidth * side
        positions.push(px, getTerrainHeight(px, pz) + 0.05, pz)
      }
      if (index > 0) {
        const a = base + (index - 1) * 2
        // Winding chosen so the ribbon normal points up (visible from above).
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function RoverTracks() {
  const geometry = useMemo(() => buildRutGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={PALETTE.terrainDark} roughness={1} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

/**
 * Fase 4 · Paso 2 — subtle regional tinting, palette-only (§5). Regions are
 * distinguished mainly by geography (Paso 1) and these low-strength blends:
 * paler fine sand at InSight, slightly compact ground at Ingenuity, and
 * darker eroded tones at Viking 1. Opportunity keeps its existing clearing.
 */
const REGIONAL_TINTS = [
  { siteId: 'insight', color: new THREE.Color(PALETTE.terrainLight), strength: 0.2 },
  { siteId: 'ingenuity', color: new THREE.Color(PALETTE.terrainMid), strength: 0.14 },
  { siteId: 'viking1', color: new THREE.Color(PALETTE.rockDark), strength: 0.3 },
] as const

/**
 * Fine surface grain for the terrain. The mesh resolution (~1.56 u per
 * vertex) cannot carry texture by vertex colors alone, so a small tiled
 * canvas texture multiplies subtle palette-toned grain over the vertex
 * colors — one draw call, no shaders, identical on High and Low.
 */
function makeTerrainTexture(): THREE.CanvasTexture | null {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null
  const random = mulberry32(0x9e57)
  context.fillStyle = '#F4ECE4'
  context.fillRect(0, 0, size, size)
  const tones = ['#D9B09A', '#C08B6E', '#E9CDB4', '#8E748C', '#B77B65']
  // Toroidal drawing: every mark is also drawn in the neighbouring tiles,
  // so soft blotches never get clipped at the tile edge and the repeating
  // texture has no visible seams (no squares).
  const drawWrapped = (draw: (x: number, y: number) => void, x: number, y: number) => {
    for (const offsetX of [-size, 0, size]) {
      for (const offsetY of [-size, 0, size]) {
        draw(x + offsetX, y + offsetY)
      }
    }
  }
  for (let index = 0; index < 70; index += 1) {
    const x = random() * size
    const y = random() * size
    const radius = 30 + random() * 60
    const tone = tones[Math.floor(random() * tones.length)]!
    drawWrapped((cx, cy) => {
      const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, `${tone}1F`)
      gradient.addColorStop(1, `${tone}00`)
      context.fillStyle = gradient
      context.beginPath()
      context.arc(cx, cy, radius, 0, Math.PI * 2)
      context.fill()
    }, x, y)
  }
  for (let index = 0; index < 1600; index += 1) {
    const x = random() * size
    const y = random() * size
    const radius = 1.5 + random() * 3.5
    const tone = tones[Math.floor(random() * tones.length)]!
    drawWrapped((cx, cy) => {
      const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, `${tone}30`)
      gradient.addColorStop(1, `${tone}00`)
      context.fillStyle = gradient
      context.beginPath()
      context.arc(cx, cy, radius, 0, Math.PI * 2)
      context.fill()
    }, x, y)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(56, 56)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function extendHorizon(value: number): number {
  return Math.abs(value) <= WORLD.playRadius
    ? value
    : Math.sign(value) *
      (WORLD.playRadius + (Math.abs(value) - WORLD.playRadius) * 3.5)
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

  for (let index = 0; index < position.count; index += 1) {
    // Preserve playable resolution; stretch only the distant decorative skirt.
    const x = extendHorizon(position.getX(index))
    const z = extendHorizon(position.getZ(index))
    const height = getTerrainHeight(x, z)
    position.setXYZ(index, x, height, z)
  }
  geometry.computeVertexNormals()
  const normals = geometry.getAttribute('normal')
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const z = position.getZ(index)
    const height = position.getY(index)
    const nx = normals.getX(index)
    const ny = normals.getY(index)
    const nz = normals.getZ(index)
    const sediment = 0.5 + Math.sin(x * 0.085 + Math.sin(z * 0.06) * 2.4) * 0.5
    color.copy(TERRAIN_COLORS.mid).lerp(TERRAIN_COLORS.light, sediment * 0.5)
    // Low-contrast wind streaks break up the largest dune faces.
    const streak = 0.5 + Math.sin(x * 0.35 + z * 0.08 + Math.sin(z * 0.12) * 2) * 0.5
    color.lerp(TERRAIN_COLORS.light, streak * 0.06)
    // Faint strata follow elevation and keep large dunes from reading as flat.
    const strata = 0.5 + Math.sin(height * 2.4 + x * 0.03) * 0.5
    color.lerp(TERRAIN_COLORS.high, strata * 0.09)
    const slope = 1 - Math.max(0, ny)
    color.lerp(TERRAIN_COLORS.dark, Math.min(0.58, slope * 2.2))
    // Bake a subtle warm facing into the ground so lit crests stay lively.
    const facing = Math.max(0, nx * SUN_DIRECTION.x + ny * SUN_DIRECTION.y + nz * SUN_DIRECTION.z)
    color.lerp(TERRAIN_COLORS.high, facing * 0.12)
    // Broad mineral bands instead of per-vertex random speckling.
    const coolBand = THREE.MathUtils.smoothstep(Math.sin(x * 0.045 - z * 0.06), 0.4, 0.95)
    color.lerp(TERRAIN_COLORS.cool, coolBand * 0.16)

    if (height > 5) {
      color.lerp(
        TERRAIN_COLORS.high,
        THREE.MathUtils.clamp((height - 5) / 4, 0, 1) * 0.6,
      )
    }

    for (const tint of REGIONAL_TINTS) {
      const weight = getRegionWeight(x, z, tint.siteId)
      if (weight > 0) color.lerp(tint.color, weight * tint.strength)
    }

    const pathDistance = Math.min(
      distanceToPath(x, z),
      distanceToSurveyTrail(x, z),
    )
    if (pathDistance < 4.2) {
      const pathBlend =
        1 - THREE.MathUtils.smoothstep(pathDistance, 0.8, 4.2)
      color.lerp(TERRAIN_COLORS.path, pathBlend * 0.55)
    }
    const clearing = 1 - THREE.MathUtils.smoothstep(
      Math.hypot(x - OPPORTUNITY.position.x, z - OPPORTUNITY.position.z), 3, 10,
    )
    color.lerp(TERRAIN_COLORS.path, clearing * 0.34)

    // Ingenuity flight area: a pale compacted apron inside the rock-free
    // radius, so the clear zone reads as a zone even from a distance.
    const flightClearing = 1 - THREE.MathUtils.smoothstep(
      Math.hypot(x - INGENUITY.position.x, z - INGENUITY.position.z), 6, 13,
    )
    color.lerp(TERRAIN_COLORS.path, flightClearing * 0.42)

    color.toArray(colors, index * 3)
  }

  position.needsUpdate = true
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function RockBatch({ rocks, variant }: { rocks: RockInstance[]; variant: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => buildRockGeometry(variant), [variant])
  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = new THREE.Object3D()
    for (let index = 0; index < rocks.length; index += 1) {
      const rock = rocks[index]
      if (!rock) continue
      dummy.position.set(rock.x, rock.y, rock.z)
      dummy.rotation.set(rock.tilt, rock.rotation, rock.tilt * 0.6)
      dummy.scale.set(rock.scale * rock.stretchX, rock.scale * rock.stretchY, rock.scale * rock.stretchZ)
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
      key={rocks.length}
      ref={meshRef}
      args={[geometry, undefined, rocks.length]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial roughness={0.92} metalness={0.03} flatShading />
    </instancedMesh>
  )
}

function Rocks({ quality }: { quality: Quality }) {
  const count = QUALITY_PRESETS[quality].rockCount
  const batches = useMemo(() => {
    const rocks = createRocks(count)
    return [0, 1, 2].map((variant) => rocks.filter((rock) => rock.variant === variant))
  }, [count])
  return <group>{batches.map((rocks, variant) => <RockBatch key={variant} rocks={rocks} variant={variant} />)}</group>
}

function DistantMesas() {
  const geometries = useMemo(() => [0x5e7a, 0x6f8b, 0x709c].map(buildMesaGeometry), [])
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])

  return (
    <group>
      {ROCK_FORMATIONS.map((mesa, index) => (
        <mesh
          key={index}
          geometry={geometries[mesa.variant]}
          position={[
            mesa.x,
            getTerrainHeight(mesa.x, mesa.z) - 2,
            mesa.z,
          ]}
          rotation={[0, mesa.rotation, 0]}
          scale={[mesa.width, mesa.height, mesa.depth]}
        >
          <meshStandardMaterial
            vertexColors
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

const FOOTPRINT_POOL = 100
const FOOTPRINT_SPACING = 0.6
const FOOTPRINT_LIFETIME = 4

interface Footprint {
  x: number
  y: number
  z: number
  heading: number
  age: number
}

/**
 * The astronaut's footprint trail: small dark ovals stamped onto the ground
 * as they walk, alternating feet, shrinking away over ~18 s. This is the
 * readable, reversible version of terrain deformation — no heightfield
 * changes, so player, rocks and camera stay in sync. Ring-buffer pool with
 * no per-frame allocation.
 */
function FootprintTrail() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => {
    const circle = new THREE.CircleGeometry(0.5, 10)
    circle.rotateX(-Math.PI / 2)
    return circle
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const dummyRef = useRef(new THREE.Object3D())
  const state = useRef({
    footprints: [] as Footprint[],
    next: 0,
    lastX: playerPosition.x,
    lastZ: playerPosition.z,
    distance: 0,
    side: 1,
  })

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const color = new THREE.Color(PALETTE.terrainDark)
    for (let index = 0; index < FOOTPRINT_POOL; index += 1) {
      mesh.setColorAt(index, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    const dummy = new THREE.Object3D()
    dummy.scale.setScalar(0)
    dummy.updateMatrix()
    for (let index = 0; index < FOOTPRINT_POOL; index += 1) {
      mesh.setMatrixAt(index, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const current = state.current
    const dx = playerPosition.x - current.lastX
    const dz = playerPosition.z - current.lastZ
    const moved = Math.hypot(dx, dz)
    current.distance += moved
    // No footprints while the boots are off the ground.
    if (moved > 1e-4 && current.distance >= FOOTPRINT_SPACING && playerPosition.airborne <= 0.25) {
      current.distance = 0
      current.side = current.side === 1 ? -1 : 1
      const heading = Math.atan2(dx, dz)
      const perpX = Math.cos(heading)
      const perpZ = -Math.sin(heading)
      const fx = playerPosition.x + perpX * current.side * 0.14
      const fz = playerPosition.z + perpZ * current.side * 0.14
      const footprint: Footprint = {
        x: fx,
        y: getTerrainHeight(fx, fz) + 0.03,
        z: fz,
        heading,
        age: 0,
      }
      if (current.footprints.length < FOOTPRINT_POOL) {
        current.footprints.push(footprint)
      } else {
        current.footprints[current.next] = footprint
        current.next = (current.next + 1) % FOOTPRINT_POOL
      }
    }
    current.lastX = playerPosition.x
    current.lastZ = playerPosition.z

    const dummy = dummyRef.current
    let dirty = false
    for (let index = 0; index < current.footprints.length; index += 1) {
      const footprint = current.footprints[index]!
      footprint.age += delta
      if (footprint.age >= FOOTPRINT_LIFETIME) continue
      const life = 1 - footprint.age / FOOTPRINT_LIFETIME
      dummy.position.set(footprint.x, footprint.y, footprint.z)
      dummy.rotation.set(0, footprint.heading, 0)
      dummy.scale.set(0.2 * life, 1, 0.34 * life)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      dirty = true
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, FOOTPRINT_POOL]}
      frustumCulled={false}
      renderOrder={1}
    >
      <meshStandardMaterial roughness={1} metalness={0} depthWrite={false} />
    </instancedMesh>
  )
}

/**
 * Small discovery details per region (Fase 5): orientation and curiosity
 * only — no collectibles, no mechanics. Deterministic, low-count and built
 * from the shared palette so the world reads as four places, not one field.
 */
function RegionDiscovery() {
  const siteById = (id: string) => MARS_OBJECTS.find((o) => o.id === id)!
  const opportunity = siteById('opportunity')
  const insight = siteById('insight')
  const ingenuity = siteById('ingenuity')
  const viking1 = siteById('viking1')

  const at = (site: typeof opportunity, dx: number, dz: number) => {
    const x = site.position.x + dx
    const z = site.position.z + dz
    return { x, z, y: getTerrainHeight(x, z) }
  }

  const opportunityDetails = useMemo(() => {
    const random = mulberry32(0x0dd1)
    const craters = Array.from({ length: 4 }, () => {
      const angle = random() * Math.PI * 2
      const dist = 6 + random() * 4
      return { ...at(opportunity, Math.cos(angle) * dist, Math.sin(angle) * dist), radius: 0.8 + random() * 0.7 }
    })
    const fins = Array.from({ length: 3 }, (_, i) => {
      const angle = i * 2.1 + 0.4
      const dist = 8 + i * 1.2
      return { ...at(opportunity, Math.cos(angle) * dist, Math.sin(angle) * dist), height: 1.1 + random() * 0.8, rotation: angle + random() }
    })
    return { craters, fins }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const insightDetails = useMemo(() => {
    const posts = Array.from({ length: 5 }, (_, i) => {
      const angle = i * 1.25 + 0.3
      const dist = 5.5 + (i % 3) * 1.6
      return { ...at(insight, Math.cos(angle) * dist, Math.sin(angle) * dist), rotation: angle }
    })
    const ripples = Array.from({ length: 8 }, (_, i) => {
      const angle = i * 0.79 + 0.2
      const dist = 6 + (i % 4) * 1.4
      return { ...at(insight, Math.cos(angle) * dist, Math.sin(angle) * dist), rotation: angle + 0.6 }
    })
    return { posts, ripples }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const ingenuityDetails = useMemo(() => {
    // Dashed flight-path arc on the ground around the clear apron.
    const marks = Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2 + 0.15
      return { ...at(ingenuity, Math.cos(angle) * 5.8, Math.sin(angle) * 5.8), rotation: angle }
    })
    const dustPatches = Array.from({ length: 3 }, (_, i) => {
      const angle = i * 2.3 + 1
      const dist = 7.5 + i
      return { ...at(ingenuity, Math.cos(angle) * dist, Math.sin(angle) * dist), radius: 1.2 + i * 0.25 }
    })
    return { marks, dustPatches }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const vikingDetails = useMemo(() => {
    const random = mulberry32(0x101)
    const spires = Array.from({ length: 4 }, (_, i) => {
      const angle = i * 1.6 + 0.5
      const dist = 6.5 + (i % 3) * 1.8
      return { ...at(viking1, Math.cos(angle) * dist, Math.sin(angle) * dist), height: 1.4 + random() * 1.2, rotation: angle }
    })
    return { spires }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spawnGround = getTerrainHeight(WORLD.spawn.x, WORLD.spawn.z)
  const viewpointGround = getTerrainHeight(
    SURVEY_VIEWPOINT.x,
    SURVEY_VIEWPOINT.z,
  )

  return (
    <group>
      {/* Landing marker: recognizable home reference at spawn. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WORLD.spawn.x, spawnGround + 0.04, WORLD.spawn.z]}>
        <ringGeometry args={[2.2, 2.85, 40]} />
        <meshStandardMaterial color={PALETTE.path} roughness={1} depthWrite={false} />
      </mesh>

      {/* Geological Passage viewpoint: a small field-survey cairn, not a
          historical artifact. It gives the player a clear high point. */}
      <group
        position={[SURVEY_VIEWPOINT.x, viewpointGround, SURVEY_VIEWPOINT.z]}
      >
        {[0, 0.9, 1.8, 2.7].map((angle, index) => (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * 0.9,
              0.26 + index * 0.12,
              Math.sin(angle) * 0.9,
            ]}
            rotation={[0.12, angle, 0.18]}
            scale={[0.55 - index * 0.06, 0.42, 0.48]}
            castShadow
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={PALETTE.rockLight}
              roughness={0.95}
              flatShading
            />
          </mesh>
        ))}
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 1.1, 6]} />
          <meshStandardMaterial color={PALETTE.rockDark} roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.36, 0]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
        </mesh>
      </group>
      {[-2.85, 2.85].map((dx, i) => (
        <group key={i} position={[WORLD.spawn.x + dx, spawnGround, WORLD.spawn.z + (i === 0 ? -1.2 : 1.2)]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 0.9, 6]} />
            <meshStandardMaterial color={PALETTE.rockLight} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.98, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshBasicMaterial color={PALETTE.accent} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Valley of Echoes: small craters + sedimentary fins. */}
      {opportunityDetails.craters.map((c, i) => (
        <mesh key={`c${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[c.x, c.y + 0.04, c.z]}>
          <ringGeometry args={[c.radius * 0.7, c.radius, 24]} />
          <meshStandardMaterial color={PALETTE.terrainDark} roughness={1} depthWrite={false} />
        </mesh>
      ))}
      {opportunityDetails.fins.map((f, i) => (
        <mesh key={`f${i}`} position={[f.x, f.y + f.height * 0.28, f.z]} rotation={[0, f.rotation, 0.18]} scale={[1, f.height, 0.28]} castShadow>
          <boxGeometry args={[1.4, 0.6, 0.9]} />
          <meshStandardMaterial color={PALETTE.mesaNear} roughness={1} flatShading />
        </mesh>
      ))}

      {/* Silent Plains: small instrument posts + wind ripples flowing in dust. */}
      {insightDetails.posts.map((p, i) => (
        <group key={`p${i}`} position={[p.x, p.y, p.z]} rotation={[0, p.rotation, 0]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 0.7, 6]} />
            <meshStandardMaterial color={PALETTE.rockLight} metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow>
            <boxGeometry args={[0.3, 0.16, 0.2]} />
            <meshStandardMaterial color={PALETTE.accent} metalness={0.3} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {insightDetails.ripples.map((r, i) => (
        <mesh key={`r${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[r.x, r.y + 0.03, r.z]} scale={[1, 0.18, 1]}>
          <circleGeometry args={[1.1, 20]} />
          <meshStandardMaterial color={PALETTE.dust} roughness={1} depthWrite={false} transparent opacity={0.55} />
        </mesh>
      ))}

      {/* First Flight Dunes: dashed flight arc + settled dust patches. */}
      {ingenuityDetails.marks.map((m, i) => (
        <mesh key={`m${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[m.x, m.y + 0.05, m.z]}>
          <circleGeometry args={[0.28, 12]} />
          <meshStandardMaterial color={PALETTE.terrainDark} roughness={1} depthWrite={false} />
        </mesh>
      ))}
      {ingenuityDetails.dustPatches.map((d, i) => (
        <mesh key={`d${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[d.x, d.y + 0.03, d.z]}>
          <circleGeometry args={[d.radius, 20]} />
          <meshStandardMaterial color={PALETTE.dust} roughness={1} depthWrite={false} transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Ancient Lands: dark eroded spires. */}
      {vikingDetails.spires.map((s, i) => (
        <group key={`s${i}`} position={[s.x, s.y, s.z]} rotation={[0, s.rotation, 0]}>
          <mesh position={[0, s.height * 0.3, 0]} castShadow scale={[0.9, s.height / 1.4, 0.9]}>
            <octahedronGeometry args={[0.7, 0]} />
            <meshStandardMaterial color={PALETTE.rockDark} roughness={1} flatShading />
          </mesh>
          <mesh position={[0.3, s.height * 0.12, 0.25]} castShadow scale={[0.6, s.height / 2.2, 0.6]}>
            <octahedronGeometry args={[0.7, 0]} />
            <meshStandardMaterial color={PALETTE.mesaNear} roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * Ground sparkles (Fase A, Journey-style glints): static additive points
 * resting on the sand across the playable area, gently twinkling together.
 * Cheap impression of view-dependent glitter without a custom shader.
 */
function Sparkles({ quality }: { quality: Quality }) {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const materialRef = useRef<THREE.PointsMaterial>(null)
  const count = quality === 'low' ? 200 : 500
  const geometry = useMemo(() => {
    const random = mulberry32(0x51a72)
    const buffer = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * (WORLD.playRadius + 4)
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      positions[index * 3] = x
      positions[index * 3 + 1] = getTerrainHeight(x, z) + 0.06
      positions[index * 3 + 2] = z
    }
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    buffer.computeBoundingSphere()
    return buffer
  }, [count])
  const glowTexture = useMemo(() => makeGlowTexture(), [])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => glowTexture?.dispose(), [glowTexture])

  useFrame(({ clock }) => {
    const material = materialRef.current
    if (!material) return
    material.opacity = reducedMotion ? 0.18 : 0.18 + Math.sin(clock.elapsedTime * 2.3) * 0.08
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={materialRef}
        map={glowTexture ?? undefined}
        color={PALETTE.starWarm}
        size={0.1}
        sizeAttenuation
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

export function Terrain({ quality }: TerrainProps) {
  const geometry = useMemo(() => buildTerrainGeometry(), [])
  const terrainTexture = useMemo(() => makeTerrainTexture(), [])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useEffect(() => {
    return () => terrainTexture?.dispose()
  }, [terrainTexture])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={terrainTexture ?? undefined}
          roughness={0.96}
          metalness={0.02}
        />
      </mesh>
      <Sparkles quality={quality} />
      <Rocks quality={quality} />
      <RoverTracks />
      <RegionDiscovery />
      <FootprintTrail />
      <DistantMesas />
    </group>
  )
}
