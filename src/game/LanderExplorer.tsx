import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getActiveExplorer, getActiveWorld, getScanAnchors, SPIRIT_SITE, type MoonExplorerId } from '../data/spiritSite'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { getExplorerGroundTilt } from './lunarGround'
import { disposePartGlows, preparePartGlow, updatePartGlows, type PartGlow } from './partGlow'
import { ScanMarkers } from './ScanMarkers'
import { getTerrainHeight } from './terrainHeight'
import { PALETTE } from './worldConfig'

/**
 * A landed explorer that does not drive: Surveyor 3 (surveyor3/blender) and
 * the Apollo 11 Eagle descent stage (apolo11/blender) on the Moon, Viking 1
 * (viking/blender) on Mars. Each is exported by its own web script into a
 * few named parts. Same contract as MerRover: the three
 * educational parts carry the scanner component ids (plus an easy-aim hit
 * box from getScanAnchors()), other real parts carry distractor ids and the
 * rest only blocks the ray.
 */
interface LanderSpec {
  url: string
  /**
   * Turn around the vertical axis. Both models face +Z (Eagle: ladder);
   * -PI/2 turns that side west, as Eagle really stood (its ladder in the
   * shade, the Sun behind it in the east).
   */
  yaw: number
  components: Readonly<Record<string, string>>
  distractors: Readonly<Record<string, string>>
}

type LanderId = MoonExplorerId | 'viking-1'

const LANDERS: Readonly<Record<LanderId, LanderSpec>> = {
  'viking-1': {
    url: 'models/viking-1.glb?v=vk1-1',
    // Arm and cameras turned a little toward the approach path.
    yaw: 0.35,
    components: {
      VK_Cameras: 'cameras',
      VK_Arm: 'sampler-arm',
      VK_Antenna: 'high-gain-antenna',
    },
    distractors: {
      VK_Legs: 'landing-legs',
    },
  },
  'surveyor-3': {
    url: 'models/surveyor-3.glb?v=sv3-1',
    yaw: -Math.PI / 2,
    components: {
      SV_TVCamera: 'tv-camera',
      SV_Sampler: 'surface-sampler',
      SV_Radar: 'descent-radar',
    },
    distractors: {
      SV_Solar: 'solar-panel',
      SV_Legs: 'footpads',
      SV_Antenna: 'antenna',
    },
  },
  'apollo-11': {
    url: 'models/apollo11-eagle.glb?v=eagle-1',
    yaw: -Math.PI / 2,
    components: {
      LM_Probes: 'surface-probe',
      LM_Engine: 'descent-engine',
      LM_Plaque: 'plaque',
    },
    distractors: {
      LM_Legs: 'landing-legs',
      LM_Ladder: 'ladder',
    },
  },
}

useGLTF.preload(LANDERS['surveyor-3'].url)
useGLTF.preload(LANDERS['apollo-11'].url)
useGLTF.preload(LANDERS['viking-1'].url)

function LanderModel({ spec }: { spec: LanderSpec }) {
  const { scene } = useGLTF(spec.url)
  const { model, highlights } = useMemo(() => {
    const clone = scene.clone(true)
    const list: PartGlow[] = []
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    const explorer = SPIRIT_SITE.missionId
    for (const [node, part] of Object.entries(spec.components)) {
      const componentId = `${explorer}-${part}`
      const target = clone.getObjectByName(node)
      if (!target) continue
      target.userData.scannerMissionId = explorer
      target.userData.scannerComponentId = componentId
      list.push(preparePartGlow(target, componentId))
    }
    for (const [node, part] of Object.entries(spec.distractors)) {
      const target = clone.getObjectByName(node)
      if (!target) continue
      target.userData.scannerMissionId = explorer
      target.userData.scannerDistractorId = `${explorer}-${part}`
    }
    return { model: clone, highlights: list }
  }, [scene, spec])

  const live = useRef<PartGlow[]>([])
  useEffect(() => {
    live.current = highlights
    return () => {
      live.current = []
      disposePartGlows(highlights)
    }
  }, [highlights])

  useFrame((state) => updatePartGlows(live.current, state.clock.elapsedTime))

  return <primitive object={model} />
}

export function LanderExplorer() {
  const explorer = getActiveExplorer() as LanderId
  const spec = LANDERS[explorer]
  const nearby = useGameStore((state) => state.nearbySpirit)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const marker = useRef<THREE.Mesh>(null)
  const { x, z } = SPIRIT_SITE.position
  const groundY = getTerrainHeight(x, z)
  // Sit the lander on its pad: level at Tranquility Base, tilted on the
  // wall of Surveyor crater.
  const tilt = useMemo(() => {
    if (getActiveWorld() !== 'moon') return new THREE.Quaternion()
    const { gx, gz } = getExplorerGroundTilt(explorer as MoonExplorerId)
    const normal = new THREE.Vector3(-gx, 1, -gz).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
  }, [explorer])
  const beaconHeight = explorer === 'apollo-11' ? 4.6 : explorer === 'viking-1' ? 2.9 : 3.5

  useFrame((state, delta) => {
    if (!ringMaterial.current) return
    if (isWorldPaused() || reducedMotion) {
      ringMaterial.current.opacity = nearby ? 0.8 : 0.45
      return
    }
    const time = state.clock.elapsedTime
    ringMaterial.current.opacity = (nearby ? 0.65 : 0.35) + Math.sin(time * 1.7) * 0.08
    if (marker.current) {
      marker.current.rotation.y += delta * 0.6
      marker.current.position.y = beaconHeight + Math.sin(time * 1.5) * 0.08
    }
  })

  return (
    <group name="LandedExplorer" position={[x, groundY, z]} quaternion={tilt} userData={{ scannerRoot: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} userData={{ scannerIgnore: true }}>
        <ringGeometry args={[SPIRIT_SITE.ringRadius - 0.2, SPIRIT_SITE.ringRadius, 64]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={PALETTE.beaconAvailable}
          transparent
          opacity={0.45}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={marker} position={[0, beaconHeight, 0]} userData={{ scannerIgnore: true }}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshBasicMaterial color={PALETTE.accent} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <group rotation={[0, spec.yaw, 0]}>
        <LanderModel spec={spec} />
        <ScanMarkers />
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
