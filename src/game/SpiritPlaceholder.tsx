import { FullScanTraces } from './FullScanTraces'
import { ScanMarkers } from './ScanMarkers'
import { useFrame } from '@react-three/fiber'
import { useRef, type ReactElement } from 'react'
import * as THREE from 'three'
import {
  SPIRIT_DISTRACTOR_ANCHORS,
  SPIRIT_SCAN_ANCHORS,
  SPIRIT_SITE,
} from '../data/spiritSite'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { getTerrainHeight } from './terrainHeight'
import { PALETTE } from './worldConfig'

/**
 * Provisional, stylized Spirit rover. This is deliberately simple
 * geometry: a real model must be produced and reviewed later. The three
 * educational parts are separate groups so the scanner can highlight
 * them in 3D.
 */

const SPIRIT_GOLD = '#D9B07A'
const SPIRIT_CREAM = '#D8C6A8'
const SPIRIT_DARK = '#2E1F33'
const SPIRIT_PLUM = '#4A3568'
const GLOW = '#FFD9A8'

const WHEELS: ReadonlyArray<readonly [number, number]> = [
  [-0.92, -0.56],
  [-0.92, 0],
  [-0.92, 0.56],
  [0.92, -0.56],
  [0.92, 0],
  [0.92, 0.56],
]

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.34, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.3, 0.3, 0.16, 14]} />
      <meshStandardMaterial
        color={SPIRIT_DARK}
        metalness={0.1}
        roughness={0.86}
      />
    </mesh>
  )
}

function Pancam({
  selected,
  progress,
  attention,
}: {
  selected: boolean
  progress: number
  attention: 'hint' | 'scan' | null
}) {
  const glowColor = attention === 'hint' ? '#FFE3A8' : GLOW
  const glow = selected || attention !== null
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.52, 0.24, 0.24]} />
        <meshStandardMaterial
          color={SPIRIT_CREAM}
          metalness={0.35}
          roughness={0.45}
          emissive={glow ? glowColor : '#000000'}
          emissiveIntensity={
            attention ? 1.35 : selected ? 0.55 + progress * 0.8 : 0
          }
        />
      </mesh>
      {[-0.12, 0.12].map((dx) => (
        <mesh
          key={dx}
          position={[dx, 0, 0.15]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
          <meshStandardMaterial
            color={SPIRIT_DARK}
            metalness={0.5}
            roughness={0.3}
            emissive={glow ? glowColor : '#000000'}
            emissiveIntensity={
              attention ? 1.1 : selected ? 0.4 + progress * 0.6 : 0
            }
          />
        </mesh>
      ))}
      {glow && (
        <mesh
          position={[0, 0.27, 0]}
          scale={attention ? 1.35 : 1 + progress * 0.8}
        >
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color={glowColor} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function MiniTes({
  selected,
  progress,
  attention,
}: {
  selected: boolean
  progress: number
  attention: 'hint' | 'scan' | null
}) {
  const glowColor = attention === 'hint' ? '#FFE3A8' : GLOW
  const glow = selected || attention !== null
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.32, 0.28, 0.28]} />
        <meshStandardMaterial
          color={SPIRIT_PLUM}
          metalness={0.3}
          roughness={0.5}
          emissive={glow ? glowColor : '#000000'}
          emissiveIntensity={
            attention ? 1.35 : selected ? 0.55 + progress * 0.8 : 0
          }
        />
      </mesh>
      <mesh position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} />
        <meshStandardMaterial
          color={SPIRIT_CREAM}
          metalness={0.5}
          roughness={0.3}
          emissive={glow ? glowColor : '#000000'}
          emissiveIntensity={
            attention ? 1.1 : selected ? 0.4 + progress * 0.6 : 0
          }
        />
      </mesh>
      {glow && (
        <mesh
          position={[0, 0.24, 0]}
          scale={attention ? 1.35 : 1 + progress * 0.8}
        >
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color={glowColor} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function Rat({
  selected,
  progress,
  attention,
}: {
  selected: boolean
  progress: number
  attention: 'hint' | 'scan' | null
}) {
  const glowColor = attention === 'hint' ? '#FFE3A8' : GLOW
  const glow = selected || attention !== null
  return (
    <group>
      <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.5, 8]} />
        <meshStandardMaterial
          color={SPIRIT_CREAM}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      <mesh
        position={[0, 0, 0.48]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.16, 0.16, 0.12, 16]} />
        <meshStandardMaterial
          color={SPIRIT_GOLD}
          metalness={0.35}
          roughness={0.45}
          emissive={glow ? glowColor : '#000000'}
          emissiveIntensity={
            attention ? 1.35 : selected ? 0.6 + progress * 0.8 : 0
          }
        />
      </mesh>
      {glow && (
        <mesh
          position={[0, 0, 0.64]}
          scale={attention ? 1.35 : 1 + progress * 0.8}
        >
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color={glowColor} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

type PartVisualProps = {
  selected: boolean
  progress: number
  attention: 'hint' | 'scan' | null
}

/** Provisional visuals per component id; a final model replaces these. */
const PART_VISUALS: Record<string, (props: PartVisualProps) => ReactElement> =
  {
    'spirit-pancam': Pancam,
    'spirit-mini-tes': MiniTes,
    'spirit-rock-abrasion-tool': Rat,
  }

export function SpiritPlaceholder() {
  const selectedId = useGameStore((state) =>
    (state.scannerEquipped || state.scannerOpen) &&
    state.scannerMissionId === SPIRIT_SITE.missionId
      ? state.scannerSelectedComponentId
      : null,
  )
  const scanProgress = useGameStore((state) => state.scannerScanProgress)
  const nearby = useGameStore((state) => state.nearbySpirit)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const attention = useNarrativeStore((state) => state.attention)
  const attentionId = attention?.componentId ?? null
  const attentionKind = attention?.kind ?? null
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
      marker.current.position.y = 3.25 + Math.sin(time * 1.5) * 0.08
    }
  })

  return (
    <group
      position={[SPIRIT_SITE.position.x, groundY, SPIRIT_SITE.position.z]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
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

      <mesh ref={marker} position={[0, 3.25, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial
          color={PALETTE.accent}
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>

      {/* Body and solar deck */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[2.1, 0.45, 1.25]} />
        <meshStandardMaterial
          color={SPIRIT_GOLD}
          metalness={0.25}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, 1.03, 0]} castShadow>
        <boxGeometry args={[1.9, 0.05, 1.1]} />
        <meshStandardMaterial
          color={SPIRIT_DARK}
          metalness={0.1}
          roughness={0.65}
        />
      </mesh>

      {/* Wheels and rocker arms */}
      {WHEELS.map(([x, z]) => (
        <Wheel key={`${x}-${z}`} x={x} z={z} />
      ))}
      {[-0.56, 0.56].map((z) => (
        <mesh key={z} position={[0, 0.58, z]} castShadow>
          <boxGeometry args={[1.8, 0.06, 0.08]} />
          <meshStandardMaterial
            color={SPIRIT_CREAM}
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* Mast + Pancam */}
      <mesh position={[0.5, 1.55, -0.35]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 1.05, 8]} />
        <meshStandardMaterial
          color={SPIRIT_CREAM}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>
      <ScanMarkers />
      <FullScanTraces />

      {/* Scan targets: positions and hit boxes come from data */}
      {SPIRIT_SCAN_ANCHORS.map((anchor) => {
        const Part = PART_VISUALS[anchor.componentId]
        return (
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
            {Part && (
              <Part
                selected={selectedId === anchor.componentId}
                progress={scanProgress}
                attention={
                  attentionId === anchor.componentId ? attentionKind : null
                }
              />
            )}
          </group>
        )
      })}

      {/* Distractor parts: invisible hit boxes, data-driven, no progress */}
      {SPIRIT_DISTRACTOR_ANCHORS.map((anchor) => (
        <group
          key={anchor.distractorId}
          name={`ScannerDistractor_${anchor.distractorId}`}
          position={[...anchor.position]}
          userData={{
            scannerMissionId: SPIRIT_SITE.missionId,
            scannerDistractorId: anchor.distractorId,
            scannerTarget: true,
          }}
        >
          <mesh visible={false} position={[...anchor.hitOffset]}>
            <boxGeometry args={[...anchor.hitSize]} />
            <meshBasicMaterial />
          </mesh>
        </group>
      ))}

      {/* Antenna and a small UHF whip */}
      <mesh position={[-0.72, 1.22, -0.36]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 6]} />
        <meshStandardMaterial color={SPIRIT_CREAM} />
      </mesh>
      <mesh
        position={[-0.72, 1.52, -0.36]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <coneGeometry args={[0.22, 0.18, 12, 1, true]} />
        <meshStandardMaterial
          color={SPIRIT_DARK}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0.9, 1.38, -0.3]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.6, 5]} />
        <meshStandardMaterial color={SPIRIT_CREAM} />
      </mesh>
    </group>
  )
}
