import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getScanAnchors, SPIRIT_SITE } from '../data/spiritSite'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { ScanMarkers } from './ScanMarkers'
import { getTerrainHeight } from './terrainHeight'
import { PALETTE } from './worldConfig'

/**
 * The Mars explorer: the Mars Exploration Rover design that Spirit and
 * Opportunity share (blender/Spirit, exported by scripts/export_web.py).
 *
 * The GLB is split into named parts. The three educational parts carry the
 * scanner component ids (plus a slightly larger invisible hit box from
 * getScanAnchors() so aiming stays easy); solar panels, wheels and the
 * antennas carry distractor ids; body and arm only block the ray.
 */
const MODEL_URL = 'models/mer-rover.glb?v=mer-1'
useGLTF.preload(MODEL_URL)

/** The front (-X in the model) turns toward the approach path, 3/4 view. */
const ROVER_YAW = Math.PI / 2 + 0.45

/** Model node → part; the id is `${explorer}-${part}` (twin rovers). */
const COMPONENT_NODES: Readonly<Record<string, string>> = {
  Rover_Pancam: 'pancam',
  Rover_Mast: 'mini-tes',
  Rover_RAT: 'rock-abrasion-tool',
}
const DISTRACTOR_NODES: Readonly<Record<string, string>> = {
  Rover_Solar: 'solar-panels',
  Rover_Wheels: 'wheels',
  Rover_Antenna: 'antenna',
}

const GLOW = new THREE.Color(PALETTE.accent)
const HINT_GLOW = new THREE.Color('#FFE3A8')

interface Highlight {
  componentId: string
  materials: THREE.MeshStandardMaterial[]
}

function RoverModel() {
  const { scene } = useGLTF(MODEL_URL)
  const { model, highlights } = useMemo(() => {
    const clone = scene.clone(true)
    const list: Highlight[] = []
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    const explorer = SPIRIT_SITE.missionId
    for (const [node, partName] of Object.entries(COMPONENT_NODES)) {
      const componentId = `${explorer}-${partName}`
      const part = clone.getObjectByName(node)
      if (!part) continue
      part.userData.scannerMissionId = SPIRIT_SITE.missionId
      part.userData.scannerComponentId = componentId
      // Own materials, so one part can glow without lighting the others.
      const materials: THREE.MeshStandardMaterial[] = []
      part.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const source = Array.isArray(object.material)
          ? object.material
          : [object.material]
        const cloned = source.map((material) => {
          const copy = (material as THREE.MeshStandardMaterial).clone()
          copy.emissive = new THREE.Color(0, 0, 0)
          materials.push(copy)
          return copy
        })
        object.material = Array.isArray(object.material) ? cloned : cloned[0]!
      })
      list.push({ componentId, materials })
    }
    for (const [node, partName] of Object.entries(DISTRACTOR_NODES)) {
      const distractorId = `${explorer}-${partName}`
      const part = clone.getObjectByName(node)
      if (!part) continue
      part.userData.scannerMissionId = SPIRIT_SITE.missionId
      part.userData.scannerDistractorId = distractorId
    }
    return { model: clone, highlights: list }
  }, [scene])

  // The glow is animated per frame through a ref (not the memo value).
  const live = useRef<Highlight[]>([])
  useEffect(() => {
    live.current = highlights
    return () => {
      live.current = []
      for (const highlight of highlights) {
        for (const material of highlight.materials) material.dispose()
      }
    }
  }, [highlights])

  useFrame((state) => {
    const game = useGameStore.getState()
    const attention = useNarrativeStore.getState().attention
    const active =
      (game.scannerEquipped || game.scannerOpen) &&
      game.scannerMissionId === SPIRIT_SITE.missionId
    const selected = active ? game.scannerSelectedComponentId : null
    const pulse = game.reducedMotion
      ? 0.5
      : 0.5 + Math.sin(state.clock.elapsedTime * 4) * 0.5
    for (const highlight of live.current) {
      const hinted = attention?.componentId === highlight.componentId
      const isSelected = selected === highlight.componentId
      const intensity = hinted
        ? 0.45 + pulse * 0.5
        : isSelected
          ? 0.25 + game.scannerScanProgress * 0.75
          : 0
      const color = hinted && attention?.kind === 'hint' ? HINT_GLOW : GLOW
      for (const material of highlight.materials) {
        if (material.emissiveIntensity === intensity && intensity === 0) continue
        material.emissive.copy(color)
        material.emissiveIntensity = intensity
      }
    }
  })

  return <primitive object={model} />
}

export function MerRover() {
  const nearby = useGameStore((state) => state.nearbySpirit)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const marker = useRef<THREE.Mesh>(null)
  const groundY = getTerrainHeight(
    SPIRIT_SITE.position.x,
    SPIRIT_SITE.position.z,
  )

  useFrame((state, delta) => {
    if (!ringMaterial.current) return
    if (isWorldPaused() || reducedMotion) {
      ringMaterial.current.opacity = nearby ? 0.8 : 0.45
      return
    }
    const time = state.clock.elapsedTime
    ringMaterial.current.opacity =
      (nearby ? 0.65 : 0.35) + Math.sin(time * 1.7) * 0.08
    if (marker.current) {
      marker.current.rotation.y += delta * 0.6
      marker.current.position.y = 2.75 + Math.sin(time * 1.5) * 0.08
    }
  })

  return (
    <group
      name="MarsExplorer"
      position={[SPIRIT_SITE.position.x, groundY, SPIRIT_SITE.position.z]}
      userData={{ scannerRoot: true }}
    >
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        userData={{ scannerIgnore: true }}
      >
        <ringGeometry
          args={[SPIRIT_SITE.ringRadius - 0.18, SPIRIT_SITE.ringRadius, 48]}
        />
        <meshBasicMaterial
          ref={ringMaterial}
          color={PALETTE.beaconAvailable}
          transparent
          opacity={0.45}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={marker} position={[0, 2.75, 0]} userData={{ scannerIgnore: true }}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial
          color={PALETTE.accent}
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>

      <group rotation={[0, ROVER_YAW, 0]}>
        <RoverModel />
        <ScanMarkers />

        {/* Easy-aim hit boxes for the three educational parts. */}
        {getScanAnchors().map((anchor) => (
          <group
            key={anchor.componentId}
            name={`ScannerTarget_${anchor.componentId}`}
            position={[...anchor.position]}
            userData={{
              scannerMissionId: SPIRIT_SITE.missionId,
              scannerComponentId: anchor.componentId,
              scannerTarget: true,
            }}
          >
            <mesh visible={false} position={[...anchor.hitOffset]}>
              <boxGeometry args={[...anchor.hitSize]} />
              <meshBasicMaterial />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
