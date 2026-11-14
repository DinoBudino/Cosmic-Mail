import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { SPIRIT_SITE, SPIRIT_TRACE_ANCHORS } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'

const GLOW = '#FFD9A8'
const AIMED = '#FFFFFF'
const DONE = '#9BD6A8'

function Trace({
  anchor,
  revealed,
  aimed,
  reducedMotion,
}: {
  anchor: (typeof SPIRIT_TRACE_ANCHORS)[number]
  revealed: boolean
  aimed: boolean
  reducedMotion: boolean
}) {
  const core = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)

  useFrame((frame) => {
    const pulse = reducedMotion
      ? 0
      : Math.sin(frame.clock.elapsedTime * 3.4 + anchor.position[0]) * 0.5 + 0.5
    if (core.current) {
      core.current.scale.setScalar(revealed ? 0.7 : aimed ? 1.35 : 1 + pulse * 0.18)
    }
    if (halo.current) {
      halo.current.scale.setScalar(revealed ? 1 : 1.2 + pulse * 0.5)
      halo.current.lookAt(frame.camera.position)
    }
  })

  return (
    <group
      position={[...anchor.position]}
      // Helper geometry: never an occluder or a part target. The sweep picker
      // reads `scannerTraceKind` from this group.
      userData={{ scannerIgnore: true, scannerTraceKind: anchor.kind }}
    >
      {!revealed && (
        <mesh visible={false}>
          <sphereGeometry args={[anchor.hitRadius, 10, 8]} />
          <meshBasicMaterial />
        </mesh>
      )}
      <mesh ref={core}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshBasicMaterial
          color={revealed ? DONE : aimed ? AIMED : GLOW}
          transparent
          opacity={revealed ? 0.55 : 0.95}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={halo} renderOrder={11}>
        <ringGeometry args={[0.17, 0.2, 28]} />
        <meshBasicMaterial
          color={revealed ? DONE : aimed ? AIMED : GLOW}
          transparent
          opacity={revealed ? 0.35 : 0.7}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/**
 * Glowing memory traces around the identified explorer, shown while the full
 * recognition scan is being swept. A fictional overlay: nothing here touches
 * or repairs the machine, and traces carry no names.
 */
export function FullScanTraces() {
  const active = useGameStore((state) => state.fullScanSweepActive)
  const equipped = useGameStore((state) => state.scannerEquipped)
  const revealed = useGameStore((state) => state.fullScanRecon.revealed)
  const aimedKind = useGameStore((state) => state.scannerTraceKind)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const discovered = useJourneyStore(
    (state) =>
      state.save?.missions[SPIRIT_SITE.missionId]?.discovered ?? false,
  )
  if (!active || !equipped || !discovered) return null
  return (
    <group name="FullScanTraces">
      {SPIRIT_TRACE_ANCHORS.map((anchor) => (
        <Trace
          key={anchor.kind}
          anchor={anchor}
          revealed={revealed.includes(anchor.kind)}
          aimed={aimedKind === anchor.kind}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}
