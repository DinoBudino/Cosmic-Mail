import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { isWorldPaused, useGameStore } from '../store/gameStore'

/**
 * Provisional hand-held Cosmic Scanner. The body is deliberately a
 * compact scientific tool, not a weapon: rounded cream shell, coral grip,
 * gold trim, lavender screen and a small forward emitter.
 *
 * The model is authored with +Z forward, +Y up. AstronautModel mounts it
 * on Hand_R with a basis that maps model +Z to the hand's forward axis and
 * model +Y to the hand's up axis.
 */
export function CosmicScannerDevice({
  emitterName = 'ScannerEmitter',
}: {
  emitterName?: string
}) {
  const screenMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const emitterMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const glow = useRef<THREE.Mesh>(null)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  useFrame((state) => {
    const store = useGameStore.getState()
    const scanning =
      store.scannerEquipped &&
      store.scannerTriggerHeld &&
      Boolean(
        store.scannerSelectedComponentId || store.scannerEnvironmentalId,
      ) &&
      !isWorldPaused()
    const progress = scanning ? store.scannerScanProgress : 0
    const pulse = reducedMotion
      ? 0.5
      : 0.5 + Math.sin(state.clock.elapsedTime * 7) * 0.14

    if (screenMaterial.current) {
      screenMaterial.current.emissiveIntensity = scanning
        ? 0.9 + progress * 1.1
        : 0.5
    }
    if (emitterMaterial.current) {
      emitterMaterial.current.emissiveIntensity = scanning
        ? 1.2 + pulse
        : 0.4
    }
    if (glow.current) {
      glow.current.visible = scanning
      glow.current.scale.setScalar(scanning ? 1 + progress * 0.7 : 1)
    }
  })

  return (
    <group name="CosmicScannerDevice">
      {/* Main cream shell */}
      <RoundedBox
        args={[0.34, 0.13, 0.2]}
        radius={0.035}
        smoothness={3}
        position={[0, 0, 0.02]}
        castShadow
      >
        <meshStandardMaterial
          color="#F3E2CF"
          metalness={0.18}
          roughness={0.52}
        />
      </RoundedBox>

      {/* Gold trim band */}
      <mesh position={[0, 0.014, 0.02]}>
        <boxGeometry args={[0.35, 0.024, 0.212]} />
        <meshStandardMaterial
          color="#C9A15E"
          metalness={0.72}
          roughness={0.32}
        />
      </mesh>

      {/* Coral side panels */}
      {[-0.115, 0.115].map((x) => (
        <mesh key={x} position={[x, -0.012, 0.02]}>
          <boxGeometry args={[0.055, 0.1, 0.206]} />
          <meshStandardMaterial color="#E07A5F" roughness={0.58} />
        </mesh>
      ))}

      {/* Rounded coral grip under the body */}
      <RoundedBox
        args={[0.1, 0.16, 0.09]}
        radius={0.025}
        smoothness={2}
        position={[0, -0.12, 0.01]}
        castShadow
      >
        <meshStandardMaterial color="#E07A5F" roughness={0.62} />
      </RoundedBox>
      <mesh position={[0, -0.19, 0.01]}>
        <cylinderGeometry args={[0.05, 0.055, 0.04, 12]} />
        <meshStandardMaterial
          color="#C9A15E"
          metalness={0.62}
          roughness={0.4}
        />
      </mesh>

      {/* Lavender screen on top */}
      <mesh position={[0, 0.076, 0.03]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.16, 0.1]} />
        <meshStandardMaterial
          ref={screenMaterial}
          color="#D8CCFF"
          emissive="#B8A6D9"
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.071, 0.03]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.19, 0.13]} />
        <meshBasicMaterial color="#8E86C8" transparent opacity={0.22} />
      </mesh>

      {/* Gold emitter housing and lavender lens */}
      <mesh position={[0, 0, 0.135]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.06, 16]} />
        <meshStandardMaterial
          color="#C9A15E"
          metalness={0.72}
          roughness={0.3}
        />
      </mesh>
      <mesh
        name={emitterName}
        position={[0, 0, 0.17]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
        <meshStandardMaterial
          ref={emitterMaterial}
          color="#D8CCFF"
          emissive="#B8A6D9"
          emissiveIntensity={0.4}
          toneMapped={false}
        />
      </mesh>

      {/* Reading glow, only while holding the scan */}
      <mesh ref={glow} position={[0, 0, 0.19]} visible={false}>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshBasicMaterial
          color="#D8CCFF"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Small gold status nub */}
      <mesh position={[-0.09, 0.1, -0.05]}>
        <sphereGeometry args={[0.018, 8, 6]} />
        <meshStandardMaterial
          color="#C9A15E"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}
