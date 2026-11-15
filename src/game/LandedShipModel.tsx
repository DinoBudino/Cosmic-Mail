import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { MAILWING_LANDING } from '../data/spiritSite'
import { getTerrainHeight } from './terrainHeight'
import { TerrainRing } from './TerrainRing'
import { PALETTE } from './worldConfig'

const SHIP_URL = 'models/spaceship-cm01.glb'
/** Distance from the model origin to the bottom of its engine bell (m). */
const MODEL_HALF_HEIGHT = 6.07
/** Ground clearance below the bell; the four legs carry the ship instead. */
const BELL_CLEARANCE = 1.25
const SHIP_YAW = Math.PI * 0.82
const LEG_ANGLES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5] as const
const FOOT_RADIUS = 2.95
const UP = new THREE.Vector3(0, 1, 0)

const HULL_MATERIAL = {
  color: '#D8D2C6',
  metalness: 0.35,
  roughness: 0.52,
} as const
const JOINT_MATERIAL = {
  color: '#9A9387',
  metalness: 0.55,
  roughness: 0.44,
} as const
const PAD_MATERIAL = {
  color: '#4F4941',
  metalness: 0.4,
  roughness: 0.78,
} as const

type Point = readonly [number, number, number]

/** A cylinder stretched between two local points: struts, braces and pistons. */
function Strut({
  from,
  to,
  radius,
  color = HULL_MATERIAL.color,
  metalness = HULL_MATERIAL.metalness,
  roughness = HULL_MATERIAL.roughness,
}: {
  from: Point
  to: Point
  radius: number
  color?: string
  metalness?: number
  roughness?: number
}) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    const size = direction.length()
    return {
      position: start.clone().add(end).multiplyScalar(0.5).toArray(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        UP,
        direction.normalize(),
      ),
      length: size,
    }
  }, [from, to])

  return (
    <mesh position={position} quaternion={quaternion} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

/** Collar at a joint, so the struts read as machined hardware. */
function Joint({
  at,
  radius = 0.16,
  color = JOINT_MATERIAL.color,
}: {
  at: Point
  radius?: number
  color?: string
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <sphereGeometry args={[radius, 12, 8]} />
      <meshStandardMaterial
        color={color}
        metalness={JOINT_MATERIAL.metalness}
        roughness={JOINT_MATERIAL.roughness}
      />
    </mesh>
  )
}

interface Leg {
  angle: number
  hip: Point
  knee: Point
  foot: Point
}

function LandingGear({
  x,
  z,
  shipYaw,
  originY,
  scale,
}: {
  x: number
  z: number
  shipYaw: number
  originY: number
  scale: number
}) {
  const legs = useMemo<Leg[]>(() => {
    const cosYaw = Math.cos(shipYaw)
    const sinYaw = Math.sin(shipYaw)
    return LEG_ANGLES.map((angle) => {
      const localX = Math.cos(angle) * FOOT_RADIUS
      const localZ = Math.sin(angle) * FOOT_RADIUS
      // Group yaw maps local x/z to world x/z; sample the actual terrain under
      // each pad so no foot hovers or cuts into a slope.
      const footX = x + localX * cosYaw + localZ * sinYaw
      const footZ = z - localX * sinYaw + localZ * cosYaw
      const ground = getTerrainHeight(footX, footZ)
      return {
        angle,
        hip: [Math.cos(angle) * 1.28, -2.25, Math.sin(angle) * 1.28],
        knee: [Math.cos(angle) * 2.42, -4.95, Math.sin(angle) * 2.42],
        foot: [
          Math.cos(angle) * FOOT_RADIUS,
          (ground - originY) / scale - 0.04,
          Math.sin(angle) * FOOT_RADIUS,
        ],
      }
    })
  }, [x, z, shipYaw, originY, scale])

  return (
    <group name="LandingGear">
      {legs.map((leg) => {
        const angle = leg.angle
        const out = Math.cos(angle)
        const side = Math.sin(angle)
        const braceTop: Point = [out * 1.18, -1.15, side * 1.18]
        const braceKnee: Point = [out * 2.25, -4.55, side * 2.25]
        const pistonTop: Point = [out * 1.92, -4.1, side * 1.92]
        // The piston must land on the foot pad, not stop beside it.
        const pistonFoot: Point = [
          leg.foot[0],
          leg.foot[1] + 0.22,
          leg.foot[2],
        ]
        const padY = leg.foot[1] + 0.05
        return (
          <group key={angle}>
            <Strut from={leg.hip} to={leg.knee} radius={0.11} />
            <Strut from={leg.knee} to={leg.foot} radius={0.085} />
            <Strut from={braceTop} to={braceKnee} radius={0.055} />
            <Strut
              from={pistonTop}
              to={pistonFoot}
              radius={0.045}
              color={JOINT_MATERIAL.color}
              metalness={JOINT_MATERIAL.metalness}
              roughness={JOINT_MATERIAL.roughness}
            />
            <Joint at={leg.hip} />
            <Joint at={leg.knee} radius={0.14} />
            <Joint at={leg.foot} radius={0.095} color={JOINT_MATERIAL.color} />
            {/* Wide foot pad and its crushable honeycomb block. */}
            <mesh
              position={[leg.foot[0], padY, leg.foot[2]]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry args={[0.44, 0.52, 0.11, 16]} />
              <meshStandardMaterial {...PAD_MATERIAL} />
            </mesh>
            <mesh
              position={[leg.foot[0], padY - 0.085, leg.foot[2]]}
              castShadow
            >
              <cylinderGeometry args={[0.3, 0.34, 0.08, 12]} />
              <meshStandardMaterial color="#4B443C" metalness={0.15} roughness={0.9} />
            </mesh>
            <mesh
              position={[leg.foot[0], leg.foot[1] + 0.42, leg.foot[2]]}
              castShadow
            >
              <cylinderGeometry args={[0.085, 0.1, 0.55, 10]} />
              <meshStandardMaterial {...JOINT_MATERIAL} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Mailwing standing on four landing legs beside the landing zone. */
export function LandedShip() {
  const { scene } = useGLTF(SHIP_URL)
  const ship = useMemo(() => scene.clone(true), [scene])
  const { x, z } = MAILWING_LANDING.position
  const s = MAILWING_LANDING.scale
  const ground = getTerrainHeight(x, z)
  const shipY = ground + (MODEL_HALF_HEIGHT + BELL_CLEARANCE) * s

  return (
    <group>
      <group position={[x, shipY, z]} rotation={[0, SHIP_YAW, 0]} scale={s}>
        <primitive object={ship} />
        <LandingGear
          x={x}
          z={z}
          shipYaw={SHIP_YAW}
          originY={shipY}
          scale={s}
        />
      </group>
      {/* Scoured dust where the descent engines cleared the landing spot. */}
      <TerrainRing
        x={x}
        z={z}
        baseY={ground}
        innerRadius={3.25}
        outerRadius={4.85}
        segments={64}
        lift={0.015}
        position={[x, ground, z]}
      >
        <meshBasicMaterial
          color={PALETTE.terrainDark}
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </TerrainRing>
    </group>
  )
}
