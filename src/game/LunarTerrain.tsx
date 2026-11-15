import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getActiveExplorer, type MoonExplorerId } from '../data/spiritSite'
import { buildTintedRockGeometry, createRocks, type RockInstance } from './landscape'
import { MOON_ROCK } from './lunarRocks'
import { getEjectaBrightness, getLunarHeight, LUNAR_SITES, MOON_GROUND } from './lunarGround'
import { FootprintTrail } from './Terrain'
import { distanceToSurveyTrail } from './terrainHeight'
import { QUALITY_PRESETS, WORLD, type Quality } from './worldConfig'


const COLORS = {
  dark: new THREE.Color(MOON_GROUND.dark),
  mid: new THREE.Color(MOON_GROUND.mid),
  light: new THREE.Color(MOON_GROUND.light),
  bright: new THREE.Color(MOON_GROUND.bright),
  trail: new THREE.Color(MOON_GROUND.trail),
}

function extendHorizon(value: number): number {
  return Math.abs(value) <= WORLD.playRadius
    ? value
    : Math.sign(value) * (WORLD.playRadius + (Math.abs(value) - WORLD.playRadius) * 3.5)
}

function buildLunarGeometry(site: MoonExplorerId): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(
    WORLD.terrainSize,
    WORLD.terrainSize,
    WORLD.terrainSegments,
    WORLD.terrainSegments,
  )
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position!
  for (let index = 0; index < position.count; index += 1) {
    const x = extendHorizon(position.getX(index))
    const z = extendHorizon(position.getZ(index))
    position.setXYZ(index, x, getLunarHeight(site, x, z), z)
  }
  geometry.computeVertexNormals()
  const normals = geometry.getAttribute('normal')
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()
  const sun = LUNAR_SITES[site].sun
  const sunLength = Math.hypot(sun.x, sun.y, sun.z)
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const z = position.getZ(index)
    const ny = normals.getY(index)
    // Broad albedo patches: mare plains are not a flat gray.
    const patch = 0.5 + 0.5 * Math.sin(x * 0.031 + Math.sin(z * 0.022) * 2.1) * Math.cos(z * 0.027 - x * 0.012)
    color.copy(COLORS.mid).lerp(COLORS.light, patch * 0.45)
    // Slopes facing the Sun look brighter, crater walls in the lee darker.
    const facing =
      (normals.getX(index) * sun.x + ny * sun.y + normals.getZ(index) * sun.z) / sunLength
    color.lerp(COLORS.light, Math.max(0, facing) * 0.18)
    const slope = 1 - Math.max(0, ny)
    color.lerp(COLORS.dark, Math.min(0.4, slope * 1.4))
    // Fresh ejecta rays: brighter, crushed rock around young craters.
    const ejecta = getEjectaBrightness(site, x, z)
    if (ejecta > 0) color.lerp(COLORS.bright, ejecta * 0.55)
    // The trail walked from the ship: slightly darker, disturbed soil.
    const trail = distanceToSurveyTrail(x, z)
    if (trail < 2.6) color.lerp(COLORS.trail, (1 - THREE.MathUtils.smoothstep(trail, 0.5, 2.6)) * 0.25)
    color.toArray(colors, index * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  return geometry
}

/** Fine regolith grain multiplied over the vertex colours (no tiling seams). */
function makeRegolithTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = ctx.createImageData(size, size)
  let seed = 0x1a2b3c
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < size * size; i += 1) {
    const v = 214 + Math.floor(rand() * 41)
    image.data[i * 4] = v
    image.data[i * 4 + 1] = v
    image.data[i * 4 + 2] = v - 2
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  // Tiny pits and pebbles.
  for (let i = 0; i < 900; i += 1) {
    const x = rand() * size
    const y = rand() * size
    const r = 0.6 + rand() * 1.6
    ctx.fillStyle = rand() < 0.6 ? 'rgba(90,88,85,0.35)' : 'rgba(255,255,250,0.25)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(90, 90)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function LunarRockBatch({ rocks, variant, detail }: { rocks: RockInstance[]; variant: number; detail: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => buildTintedRockGeometry(variant, detail, MOON_ROCK.dust), [variant, detail])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    rocks.forEach((rock, index) => {
      dummy.position.set(rock.x, rock.y, rock.z)
      dummy.rotation.set(rock.tilt, rock.rotation, rock.tilt * 0.6)
      dummy.scale.set(rock.scale * rock.stretchX, rock.scale * rock.stretchY, rock.scale * rock.stretchZ)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      mesh.setColorAt(index, rock.color)
    })
    mesh.count = rocks.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [rocks])
  if (rocks.length === 0) return null
  return (
    <instancedMesh key={rocks.length} ref={meshRef} args={[geometry, undefined, rocks.length]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.97} metalness={0} vertexColors />
    </instancedMesh>
  )
}

export function LunarTerrain({ quality }: { quality: Quality }) {
  const site = getActiveExplorer() as MoonExplorerId
  const geometry = useMemo(() => buildLunarGeometry(site), [site])
  const texture = useMemo(() => makeRegolithTexture(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => texture?.dispose(), [texture])
  const count = QUALITY_PRESETS[quality].rockCount * 2
  const batches = useMemo(() => {
    const rocks = createRocks(count)
    return [0, 1, 2].flatMap((variant) => [
      { variant, detail: 3, rocks: rocks.filter((r) => r.variant === variant && r.scale >= 0.7) },
      { variant, detail: 2, rocks: rocks.filter((r) => r.variant === variant && r.scale < 0.7) },
    ])
  }, [count])
  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors map={texture ?? undefined} roughness={1} metalness={0} />
      </mesh>
      {batches.map((batch) => (
        <LunarRockBatch key={`${batch.variant}-${batch.detail}`} {...batch} />
      ))}
      {/* No wind on the Moon: prints stay much longer than on Mars. */}
      <FootprintTrail color={MOON_GROUND.footprint} lifetime={45} />
    </group>
  )
}
