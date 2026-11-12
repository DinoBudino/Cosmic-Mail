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

const OPPORTUNITY_WHEEL_X = [-0.72, 0, 0.72] as const
const OPPORTUNITY_WHEEL_Z = [-0.66, 0.66] as const

function OpportunityWheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.32, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.18, 14]} />
        <meshStandardMaterial
          color="#2E1F33"
          metalness={0.1}
          roughness={0.86}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 12]} />
        <meshStandardMaterial
          color="#c19a62"
          metalness={0.45}
          roughness={0.5}
        />
      </mesh>
    </group>
  )
}

function OpportunityWing({ side }: { side: -1 | 1 }) {
  return (
    <group
      position={[side * 1.05, 1.1, 0]}
      rotation={[0, 0, side * 0.06]}
    >
      {[0, 1, 2].map((index) => (
        <group
          key={index}
          position={[side * (0.28 + index * 0.48), 0, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.035, 1.34]} />
            <meshStandardMaterial
              color="#35224F"
              metalness={0.05}
              roughness={0.65}
            />
          </mesh>
          <mesh position={[0, -0.028, 0]}>
            <boxGeometry args={[0.5, 0.02, 1.38]} />
            <meshStandardMaterial
              color="#b68b55"
              metalness={0.4}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function OpportunityModel() {
  return (
    <group>
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[1.9, 0.4, 1.05]} />
        <meshStandardMaterial
          color="#c9a477"
          metalness={0.35}
          roughness={0.55}
        />
      </mesh>

      <mesh position={[-0.3, 1.0, 0]} castShadow>
        <boxGeometry args={[0.65, 0.38, 0.8]} />
        <meshStandardMaterial
          color="#e7c47f"
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0.55, 0.98, 0]} castShadow>
        <boxGeometry args={[0.45, 0.28, 0.55]} />
        <meshStandardMaterial
          color="#b9a58c"
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>

      <OpportunityWing side={-1} />
      <OpportunityWing side={1} />

      {OPPORTUNITY_WHEEL_Z.map((z) => (
        <mesh key={z} position={[0, 0.54, z]} castShadow>
          <boxGeometry args={[1.68, 0.06, 0.08]} />
          <meshStandardMaterial
            color="#b68b55"
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      ))}

      {OPPORTUNITY_WHEEL_X.map((x) =>
        OPPORTUNITY_WHEEL_Z.map((z) => (
          <OpportunityWheel key={`${x}-${z}`} x={x} z={z} />
        )),
      )}

      <mesh position={[0.15, 1.8, -0.28]} castShadow>
        <cylinderGeometry args={[0.055, 0.07, 1.15, 8]} />
        <meshStandardMaterial
          color="#cbb7a0"
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0.15, 2.42, -0.28]} castShadow>
        <boxGeometry args={[0.55, 0.28, 0.24]} />
        <meshStandardMaterial
          color="#d8c6a8"
          metalness={0.25}
          roughness={0.5}
        />
      </mesh>

      {[-0.1, 0.1].map((dx) => (
        <group key={dx}>
          <mesh
            position={[0.15 + dx, 2.42, -0.42]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.07, 0.07, 0.08, 12]} />
            <meshStandardMaterial
              color="#2A1D3B"
              metalness={0.6}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[0.15 + dx, 2.42, -0.465]}>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshBasicMaterial color="#F4B4DF" toneMapped={false} />
          </mesh>
        </group>
      ))}

      <mesh position={[-0.55, 1.55, 0.22]} castShadow>
        <cylinderGeometry args={[0.28, 0.08, 0.12, 16]} />
        <meshStandardMaterial
          color="#d0b99b"
          metalness={0.4}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[-0.55, 1.35, 0.22]}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
        <meshStandardMaterial color="#b9a58c" />
      </mesh>

      <mesh position={[0, 0.82, -0.58]} castShadow>
        <boxGeometry args={[0.36, 0.14, 0.12]} />
        <meshStandardMaterial color="#2E1F33" roughness={0.6} />
      </mesh>

      <mesh position={[0.62, 0.72, -0.62]} rotation={[0.2, 0, 0.5]} castShadow>
        <boxGeometry args={[0.5, 0.06, 0.08]} />
        <meshStandardMaterial
          color="#cbb7a0"
          metalness={0.35}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0.86, 0.55, -0.62]} rotation={[0.2, 0, 1.0]} castShadow>
        <boxGeometry args={[0.4, 0.06, 0.08]} />
        <meshStandardMaterial
          color="#b9a58c"
          metalness={0.3}
          roughness={0.55}
        />
      </mesh>

      <mesh position={[0.82, 1.08, 0.35]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial color="#F4B4DF" toneMapped={false} />
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
            color="#4A3568"
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
            color="#3A2846"
            metalness={0.4}
            roughness={0.4}
          />
        </mesh>
      ))}

      <mesh position={[0, 1.56, 0]} castShadow>
        <boxGeometry args={[0.42, 0.05, 0.42]} />
        <meshStandardMaterial
          color="#4A3568"
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
  // Landmark = warm peach pulse; coming-soon memorial = dim mauve.
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

const SITE_ROTATIONS: Partial<Record<MarsObjectId, number>> = {
  // Turn Opportunity's camera mast and arm towards the usual approach path.
  opportunity: 4,
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
          <group rotation={[0, SITE_ROTATIONS[object.id] ?? 0, 0]}>
            <ObjectModel id={object.id} />
          </group>
          <Beacon object={object} />
        </group>
      ))}
    </group>
  )
}
