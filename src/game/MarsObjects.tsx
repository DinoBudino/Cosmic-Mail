import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import {
  MARS_OBJECTS,
  type MarsObject,
  type MarsObjectId,
} from '../data/marsObjects'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { getTerrainHeight } from './terrainHeight'
import { PALETTE } from './worldConfig'
import { SITE_RADII } from './interaction'

function OpportunityModel() {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[2.2, 0.55, 1.2]} />
        <meshStandardMaterial
          color="#d9ab7b"
          metalness={0.35}
          roughness={0.55}
        />
      </mesh>

      {[-1.6, 1.6].map((x) => (
        <mesh key={x} position={[x, 1.13, 0]} castShadow>
          <boxGeometry args={[1.4, 0.06, 1.6]} />
          <meshStandardMaterial
            color="#243a6b"
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
      ))}

      {[-0.8, 0, 0.8].map((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh
            key={`${x}-${z}`}
            position={[x, 0.35, z]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.3, 0.3, 0.16, 12]} />
            <meshStandardMaterial color="#2f2b3a" roughness={0.8} />
          </mesh>
        )),
      )}

      <mesh position={[0, 1.75, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.6, 8]} />
        <meshStandardMaterial
          color="#c1ad9f"
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 2.55, 0]} castShadow>
        <boxGeometry args={[0.8, 0.35, 0.3]} />
        <meshStandardMaterial
          color="#d5c6b2"
          metalness={0.2}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 2.55, 0.17]}>
        <circleGeometry args={[0.08, 12]} />
        <meshBasicMaterial color="#ffb066" toneMapped={false} />
      </mesh>

      <mesh position={[0.75, 1.1, 0.25]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 12]} />
        <meshStandardMaterial
          color="#c9b7a0"
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>
    </group>
  )
}

function InSightModel() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.85, 1, 0.7, 8]} />
        <meshStandardMaterial
          color="#cbb79f"
          metalness={0.2}
          roughness={0.65}
        />
      </mesh>

      {[-1.35, 1.35].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} castShadow>
          <cylinderGeometry args={[1.15, 1.15, 0.06, 20]} />
          <meshStandardMaterial
            color="#2c3f66"
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
      ))}

      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry
          args={[0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <meshStandardMaterial
          color="#e0a25f"
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.1, 6]} />
        <meshStandardMaterial color="#c1ad9f" />
      </mesh>

      <mesh position={[0, 2.15, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.08, 0.18, 12]} />
        <meshStandardMaterial
          color="#d5c6b2"
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[1.1, 0.18, 0.8]} castShadow>
        <boxGeometry args={[0.35, 0.25, 0.35]} />
        <meshStandardMaterial color="#b8a48d" roughness={0.7} />
      </mesh>
    </group>
  )
}

const INGENUITY_LEGS: ReadonlyArray<readonly [number, number]> = [
  [-0.32, -0.32],
  [0.32, -0.32],
  [-0.32, 0.32],
  [0.32, 0.32],
]

function IngenuityModel() {
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.55, 0.24, 0.55]} />
        <meshStandardMaterial
          color="#d8d2c4"
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.45, 6]} />
        <meshStandardMaterial color="#c1ad9f" />
      </mesh>

      {[1.38, 1.48].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.62, 0.025, 20]} />
          <meshStandardMaterial
            color="#3a3446"
            metalness={0.4}
            roughness={0.4}
          />
        </mesh>
      ))}

      <mesh position={[0, 1.56, 0]} castShadow>
        <boxGeometry args={[0.42, 0.05, 0.42]} />
        <meshStandardMaterial
          color="#2c3f66"
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      {INGENUITY_LEGS.map(([x, z]) => (
        <mesh
          key={`${x}-${z}`}
          position={[x, 0.5, z]}
          rotation={[0.3, 0, x * z > 0 ? -0.3 : 0.3]}
          castShadow
        >
          <cylinderGeometry args={[0.025, 0.035, 0.95, 6]} />
          <meshStandardMaterial color="#b9a58c" />
        </mesh>
      ))}

      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.8, 0.06, 0.1]} />
        <meshStandardMaterial color="#b9a58c" />
      </mesh>
    </group>
  )
}

const VIKING_LEG_ANGLES = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]

function VikingModel() {
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[1.05, 1.25, 0.75, 6]} />
        <meshStandardMaterial
          color="#b9a58c"
          metalness={0.2}
          roughness={0.7}
        />
      </mesh>

      {VIKING_LEG_ANGLES.map((angle) => (
        <mesh
          key={angle}
          position={[
            Math.cos(angle) * 1.15,
            0.45,
            Math.sin(angle) * 1.15,
          ]}
          rotation={[0, -angle, 0.35]}
          castShadow
        >
          <cylinderGeometry args={[0.05, 0.07, 1.1, 6]} />
          <meshStandardMaterial color="#9a8874" roughness={0.8} />
        </mesh>
      ))}

      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.9, 6]} />
        <meshStandardMaterial color="#c1ad9f" />
      </mesh>

      <mesh position={[0, 2.15, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.12, 0.2, 16]} />
        <meshStandardMaterial
          color="#d5c6b2"
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0.7, 1.5, 0.2]} castShadow>
        <boxGeometry args={[0.5, 0.2, 0.3]} />
        <meshStandardMaterial color="#a8957f" roughness={0.7} />
      </mesh>
    </group>
  )
}

function ObjectModel({ id }: { id: MarsObjectId }) {
  switch (id) {
    case 'opportunity':
      return <OpportunityModel />
    case 'insight':
      return <InSightModel />
    case 'ingenuity':
      return <IngenuityModel />
    case 'viking1':
      return <VikingModel />
    default:
      return null
  }
}

function Beacon({ object }: { object: MarsObject }) {
  const nearby = useGameStore((state) => state.nearbySiteId === object.id)
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const crystal = useRef<THREE.Mesh>(null)
  const available = object.state !== 'coming-soon'
  const color = available ? PALETTE.beaconAvailable : PALETTE.beaconSoon
  const radius = SITE_RADII[object.id]
  const small = object.id === 'ingenuity'
  const columnHeight = small ? 2.2 : 3.8
  const crystalY = small ? 2.7 : 4.2

  useFrame((state, delta) => {
    const store = useGameStore.getState()
    if (isWorldPaused() || store.reducedMotion) {
      if (ringMaterial.current) ringMaterial.current.opacity = nearby ? 0.9 : available ? 0.5 : 0.25
      return
    }

    const time = state.clock.elapsedTime
    if (crystal.current) {
      crystal.current.rotation.y += delta * 0.6
      crystal.current.position.y = crystalY + Math.sin(time * 1.6) * 0.12
    }
    if (ringMaterial.current && available) {
      ringMaterial.current.opacity = nearby ? 0.9 : 0.38 + Math.sin(time * 2.1) * 0.1
    }
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[radius - (nearby ? 0.28 : 0.14), radius, 48]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={color}
          transparent
          opacity={available ? 0.5 : 0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, columnHeight / 2, 0]}>
        <cylinderGeometry
          args={[0.045, 0.11, columnHeight, 8, 1, true]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={available ? 0.16 : 0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={crystal} position={[0, crystalY, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={available ? 0.95 : 0.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

export function MarsObjects() {
  return (
    <group>
      {MARS_OBJECTS.map((object) => (
        <group
          key={object.id}
          position={[
            object.position.x,
            getTerrainHeight(object.position.x, object.position.z),
            object.position.z,
          ]}
        >
          <ObjectModel id={object.id} />
          <Beacon object={object} />
        </group>
      ))}
    </group>
  )
}
