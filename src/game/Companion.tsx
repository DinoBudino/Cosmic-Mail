import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { getTerrainHeight } from './terrainHeight'
import { WORLD } from './worldConfig'

/** Fictional floating mail assistant, offset to the side of the astronaut. */
export function Companion({ playerRef }: { playerRef: RefObject<THREE.Group | null> }) {
  const robot = useRef<THREE.Group>(null)
  const shell = useRef<THREE.Group>(null)
  const goal = useRef(new THREE.Vector3())
  const forward = useRef(new THREE.Vector3())
  const time = useRef(0)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  useFrame((_, delta) => {
    const player = playerRef.current
    const current = robot.current
    if (!player || !current || isWorldPaused()) return
    const dt = Math.min(delta, 0.05)
    forward.current.set(1.8, 0, 1.5).applyAxisAngle(THREE.Object3D.DEFAULT_UP, player.rotation.y)
    goal.current.copy(player.position).add(forward.current)
    goal.current.y = getTerrainHeight(goal.current.x, goal.current.z) + 1.35
    current.position.lerp(goal.current, 1 - Math.exp(-3.5 * dt))
    current.position.y = Math.max(current.position.y, getTerrainHeight(current.position.x, current.position.z) + 1)
    const yaw = Math.atan2(player.position.x - current.position.x, player.position.z - current.position.z)
    const difference = Math.atan2(Math.sin(yaw - current.rotation.y), Math.cos(yaw - current.rotation.y))
    current.rotation.y += difference * (1 - Math.exp(-5 * dt))
    if (shell.current) {
      if (!reducedMotion) time.current += dt
      shell.current.position.y = reducedMotion ? 0 : Math.sin(time.current * 2) * 0.07
    }
  })

  return (
    <group ref={robot} position={[WORLD.spawn.x + 1.8, getTerrainHeight(WORLD.spawn.x + 1.8, WORLD.spawn.z + 1.5) + 1.35, WORLD.spawn.z + 1.5]}>
      <group ref={shell}>
        <mesh castShadow>
          <boxGeometry args={[0.72, 0.6, 0.55]} />
          <meshStandardMaterial color="#f2e9e8" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.03, 0.285]}>
          <boxGeometry args={[0.55, 0.29, 0.035]} />
          <meshStandardMaterial color="#191b42" roughness={0.35} />
        </mesh>
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 0.06, 0.31]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshBasicMaterial color="#bce9ef" toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, -0.38, 0]}>
          <cylinderGeometry args={[0.2, 0.12, 0.14, 8]} />
          <meshStandardMaterial color="#edac65" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.3, 6]} />
          <meshStandardMaterial color="#c1ad9f" />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.065, 10, 8]} />
          <meshBasicMaterial color="#ffb066" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
