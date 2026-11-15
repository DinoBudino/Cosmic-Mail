import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  MARS_LANDING_SITES,
  rotationToFace,
  siteDirection,
  type LandingSiteState,
} from '../data/marsLandingSites'
import type { MarsExplorerId } from '../data/spiritSite'
import { makeMarsCanvas } from './marsTexture'
import { RockySurface } from './PlanetGlobe'
import { mulberry32 } from './random'

export interface OrbitMarker {
  explorer: MarsExplorerId
  label: string
  state: LandingSiteState
}

interface MarsOrbitSceneProps {
  markers: readonly OrbitMarker[]
  selected: MarsExplorerId | null
  suggested: MarsExplorerId | null
  /** Camera dives toward the selected site (landing). */
  landing: boolean
  reducedMotion: boolean
  onPick: (explorer: MarsExplorerId) => void
  /**
   * DOM labels drawn outside the canvas (plain buttons). The scene moves
   * them every frame to follow their spot on the turning planet.
   */
  labels: { current: Partial<Record<MarsExplorerId, HTMLElement | null>> }
}

const RADIUS = 2
const SPIN = 0.06
/** Globe pitch: landing spots sit a bit above center, beacon rising up. */
const VIEW_TILT = -0.32

function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

function Stars() {
  const geometry = useMemo(() => {
    const random = mulberry32(0x0b17)
    const positions = new Float32Array(900 * 3)
    for (let i = 0; i < 900; i += 1) {
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const r = 40 + random() * 20
      const s = Math.sqrt(1 - u * u)
      positions.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <points geometry={geometry}>
      <pointsMaterial color="#fdf4ec" size={0.12} sizeAttenuation transparent opacity={0.85} />
    </points>
  )
}

function Marker({
  marker,
  active,
  glow,
  onPick,
  labels,
}: {
  marker: OrbitMarker
  active: boolean
  glow: boolean
  onPick: (explorer: MarsExplorerId) => void
  labels: MarsOrbitSceneProps['labels']
}) {
  const site = MARS_LANDING_SITES.find((s) => s.explorer === marker.explorer)!
  const dir = siteDirection(site)
  // Local +Z of the marker group = the surface normal at the site, so the
  // rings lie flat on the ground and the beacon points straight up.
  const quaternion = useMemo(() => {
    const [x, y, z] = siteDirection(site)
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(x, y, z),
    )
  }, [site])
  const ring = useRef<THREE.Mesh>(null)
  const ping = useRef<THREE.Mesh>(null)
  const tip = useRef<THREE.Mesh>(null)
  const world = useMemo(() => new THREE.Vector3(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])
  const strong = glow || active

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ring.current) {
      ring.current.scale.setScalar(1 + Math.sin(t * 3.2) * (strong ? 0.12 : 0.05))
    }
    // An expanding "ping" wave, like a radar echo, so the spot catches the eye.
    if (ping.current) {
      const k = (t * 0.7) % 1
      ping.current.scale.setScalar(1 + k * 2.2)
      ;(ping.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (strong ? 0.8 : 0.45)
    }
    const anchor = tip.current
    if (!anchor) return
    // Hide the label while the spot is on the far side of the planet.
    anchor.getWorldPosition(world)
    normal.copy(world).normalize()
    const facing = normal.z > 0.3
    const label = labels.current[marker.explorer]
    if (label) {
      world.project(state.camera)
      const x = (world.x * 0.5 + 0.5) * state.size.width
      const y = (-world.y * 0.5 + 0.5) * state.size.height
      label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -125%)`
      label.style.opacity = facing ? '1' : '0'
      label.style.pointerEvents = facing ? 'auto' : 'none'
      label.tabIndex = facing ? 0 : -1
    }
  })

  const color = marker.state === 'done' ? '#9be7b0' : '#ffd9a8'
  const pick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    onPick(marker.explorer)
  }
  return (
    <group
      position={[dir[0] * RADIUS * 1.003, dir[1] * RADIUS * 1.003, dir[2] * RADIUS * 1.003]}
      quaternion={quaternion}
    >
      {/* Soft glowing patch on the ground: the landing area. */}
      <mesh onClick={pick}>
        <circleGeometry args={[0.2, 40]} />
        <meshBasicMaterial color={color} transparent opacity={strong ? 0.42 : 0.26} depthWrite={false} />
      </mesh>
      <mesh ref={ring} position={[0, 0, 0.002]}>
        <ringGeometry args={[0.2, 0.245, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      <mesh ref={ping} position={[0, 0, 0.003]}>
        <ringGeometry args={[0.2, 0.225, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* Beacon of light that holds up the name tag. */}
      <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.44, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh ref={tip} position={[0, 0, 0.45]} onClick={pick}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function Globe({
  markers,
  selected,
  suggested,
  landing,
  reducedMotion,
  onPick,
  labels,
}: MarsOrbitSceneProps) {
  const group = useRef<THREE.Group>(null)
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(makeMarsCanvas())
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const site = MARS_LANDING_SITES.find((s) => s.explorer === selected)
    if (site) {
      const target = rotationToFace(site)
      // While landing the site turns to the exact center, so the camera
      // dives straight down onto the landing ring.
      const turn = 1 - Math.exp(-dt * (landing ? 5 : 3))
      g.rotation.y += shortestAngle(g.rotation.y, target) * turn
      // Slightly above center: the beacon is seen rising, label on top.
      const tilt = (site.latitude * Math.PI) / 180 + (landing ? 0 : VIEW_TILT)
      g.rotation.x += (tilt - g.rotation.x) * turn
    } else {
      // PIP's suggested spot drifts into view, a little off-center, so the
      // child can see the glowing spot PIP is talking about.
      const hint = MARS_LANDING_SITES.find((s) => s.explorer === suggested)
      if (hint) {
        const target = rotationToFace(hint) + 0.45
        g.rotation.y += shortestAngle(g.rotation.y, target) * (1 - Math.exp(-dt * 0.9))
      } else if (!reducedMotion) {
        g.rotation.y += SPIN * dt
      }
      g.rotation.x += (VIEW_TILT * 0.8 - g.rotation.x) * (1 - Math.exp(-dt * 2))
    }
    const camera = state.camera
    const targetZ = landing ? RADIUS + 0.55 : selected ? 7.2 : 8.6
    camera.position.z += (targetZ - camera.position.z) * (1 - Math.exp(-dt * (landing ? 1.4 : 2.2)))
    camera.lookAt(0, 0, 0)
  })

  return (
    <group ref={group} rotation={[0, rotationToFace(MARS_LANDING_SITES[0]!) + 0.9, 0]}>
      {/* The Blender Mars; the painted one shows while it loads. */}
      <Suspense
        fallback={
          <mesh>
            <sphereGeometry args={[RADIUS, 64, 48]} />
            <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
          </mesh>
        }
      >
        <RockySurface kind="mars" radius={RADIUS} />
      </Suspense>
      {markers.map((marker) => (
        <Marker
          key={marker.explorer}
          marker={marker}
          active={marker.explorer === selected}
          glow={marker.explorer === suggested && !selected}
          onPick={onPick}
          labels={labels}
        />
      ))}
    </group>
  )
}

export default function MarsOrbitScene(props: MarsOrbitSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 8.6], fov: 42, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <color attach="background" args={['#0b0614']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 2.5, 5]} intensity={2.2} />
      <Stars />
      <Globe {...props} />
    </Canvas>
  )
}
