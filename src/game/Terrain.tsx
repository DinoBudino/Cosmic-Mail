import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldPosition } from '../data/marsObjects'
import { SPIRIT_SITE } from '../data/spiritSite'
import { mulberry32 } from './random'
import {
  buildRockGeometry,
  createRocks,
  type RockInstance,
} from './landscape'
import { playerPosition } from './playerPosition'
import {
  distanceToSurveyTrail,
  getRegionWeight,
  getTerrainHeight,
} from './terrainHeight'
import {
  PALETTE,
  QUALITY_PRESETS,
  SUN_DIRECTION,
  SURVEY_ROUTE,
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

/**
 * Opportunity's wheel tracks: two ruts following the last stretch of the
 * survey trail into the explorer's resting place. Real rover tracks are a
 * familiar sight in NASA images, and they quietly lead the child to it.
 */
const TRACK_CENTRE: readonly WorldPosition[] = [
  ...SURVEY_ROUTE.slice(-4),
  { x: SPIRIT_SITE.position.x, z: SPIRIT_SITE.position.z + 1.2 },
]
/** Half the distance between the left and right wheel ruts. */
const TRACK_GAUGE = 0.5

function trackRuts(): (readonly [number, number])[][] {
  const curve = new THREE.CatmullRomCurve3(
    TRACK_CENTRE.map((point) => new THREE.Vector3(point.x, 0, point.z)),
  )
  const samples = Math.ceil(curve.getLength() / 0.7)
  const points = curve.getSpacedPoints(samples)
  return [-1, 1].map((side) =>
    points.map((point, index) => {
      const previous = points[Math.max(0, index - 1)]!
      const next = points[Math.min(points.length - 1, index + 1)]!
      const dx = next.x - previous.x
      const dz = next.z - previous.z
      const length = Math.hypot(dx, dz) || 1
      return [
        point.x + (-dz / length) * TRACK_GAUGE * side,
        point.z + (dx / length) * TRACK_GAUGE * side,
      ] as const
    }),
  )
}

/**
 * The ruts are thinner than the terrain vertex spacing (~1.56 u), so vertex
 * coloring cannot show them reliably. Instead they are drawn as a thin
 * ribbon mesh hugging the terrain height — readable at any resolution,
 * with the same deterministic points.
 */
function buildRutGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const halfWidth = 0.13
  for (const world of trackRuts()) {
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
      <meshStandardMaterial color={PALETTE.terrainDark} roughness={1} metalness={0} side={THREE.DoubleSide} transparent opacity={0.6} depthWrite={false} />
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
  const tones = ['#E7B98D', '#D9895C', '#F2CDB4', '#69534D', '#C77A4E']
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

    // The survey trail reads as packed, slightly paler ground where the
    // rover drove; no painted loop to sites that are not on this map.
    const pathDistance = distanceToSurveyTrail(x, z)
    if (pathDistance < 3.2) {
      const pathBlend =
        1 - THREE.MathUtils.smoothstep(pathDistance, 0.6, 3.2)
      color.lerp(TERRAIN_COLORS.path, pathBlend * 0.3)
    }
    color.toArray(colors, index * 3)
  }

  position.needsUpdate = true
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function RockBatch({ rocks, variant, detail }: { rocks: RockInstance[]; variant: number; detail: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => buildRockGeometry(variant, detail), [variant, detail])
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
      <meshStandardMaterial roughness={0.94} metalness={0.02} vertexColors />
    </instancedMesh>
  )
}

/** Rocks at least this scale use the detailed geometry. */
const ROCK_DETAIL_SCALE = 0.7

function Rocks({ quality }: { quality: Quality }) {
  const count = QUALITY_PRESETS[quality].rockCount
  const batches = useMemo(() => {
    const rocks = createRocks(count)
    // Large rocks get the detailed shape; pebbles the light one.
    return [0, 1, 2].flatMap((variant) => [
      { variant, detail: 3, rocks: rocks.filter((rock) => rock.variant === variant && rock.scale >= ROCK_DETAIL_SCALE) },
      { variant, detail: 2, rocks: rocks.filter((rock) => rock.variant === variant && rock.scale < ROCK_DETAIL_SCALE) },
    ])
  }, [count])
  return (
    <group>
      {batches.map((batch) => (
        <RockBatch key={`${batch.variant}-${batch.detail}`} rocks={batch.rocks} variant={batch.variant} detail={batch.detail} />
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
export function FootprintTrail({
  color = PALETTE.terrainDark,
  lifetime = FOOTPRINT_LIFETIME,
}: {
  color?: string
  /** Seconds a print stays (long on the Moon: there is no wind). */
  lifetime?: number
} = {}) {
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
    const tint = new THREE.Color(color)
    for (let index = 0; index < FOOTPRINT_POOL; index += 1) {
      mesh.setColorAt(index, tint)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    const dummy = new THREE.Object3D()
    dummy.scale.setScalar(0)
    dummy.updateMatrix()
    for (let index = 0; index < FOOTPRINT_POOL; index += 1) {
      mesh.setMatrixAt(index, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [color])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const current = state.current
    const dx = playerPosition.x - current.lastX
    const dz = playerPosition.z - current.lastZ
    const moved = Math.hypot(dx, dz)
    current.distance += moved
    // No footprints while off the ground.
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
      if (footprint.age >= lifetime) continue
      const life = 1 - footprint.age / lifetime
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
      <Rocks quality={quality} />
      <RoverTracks />
      <FootprintTrail />
    </group>
  )
}
