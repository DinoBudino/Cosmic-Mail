import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CALIBRATION_SAMPLE, stepIndex } from '../data/arrivalProtocol'
import {
  WORLD_ENVIRONMENTAL_SITES,
  getEnvironmentalSite,
  type EnvironmentalSite,
} from '../data/environmentalSites'
import { useProtocol } from '../ui/useProtocol'
import { useGameStore } from '../store/gameStore'
import { buildRockGeometry } from './landscape'
import { getTerrainHeight } from './terrainHeight'
import { PALETTE } from './worldConfig'

const OUTCROP_URL = 'models/mars-outcrop.glb'
useGLTF.preload(OUTCROP_URL)

function OutcropModel({ glow }: { glow: number }) {
  const { scene } = useGLTF(OUTCROP_URL)
  const model = useMemo(() => scene.clone(true), [scene])
  useEffect(() => {
    // The asset was authored with lilac layers; remap each layer's tone onto
    // the Mars palette (dark brown to pale sand) and keep the banding.
    const dark = new THREE.Color(PALETTE.rockDark)
    const light = new THREE.Color(PALETTE.terrainHigh)
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
        const source = object.material as THREE.MeshStandardMaterial
        if (source?.isMeshStandardMaterial) {
          const material = source.clone()
          const tone = THREE.MathUtils.clamp(
            source.color.r * 0.3 + source.color.g * 0.59 + source.color.b * 0.11,
            0,
            1,
          )
          material.color.copy(dark).lerp(light, Math.pow(tone, 0.6))
          object.material = material
        }
      }
    })
  }, [model])
  return (
    <group>
      <primitive object={model} />
      {glow > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[1.55, 1.72, 28]} />
          <meshBasicMaterial
            color={PALETTE.accent}
            transparent
            opacity={glow}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}

/**
 * Optional environmental observation targets. They are ordinary landscape
 * features marked for the scanner; they are not mission components and never
 * grant historical progress.
 */
function EnvironmentalVisual({
  site,
  selected,
  analysis,
}: {
  site: EnvironmentalSite
  selected: boolean
  analysis: 'idle' | 'quick' | 'detailed'
}) {
  const ground = getTerrainHeight(site.position.x, site.position.z)
  const glow = selected ? 0.18 + (analysis === 'detailed' ? 0.22 : 0) : 0
  const rockGeometry = useMemo(() => buildRockGeometry(1), [])
  const chipGeometry = useMemo(() => buildRockGeometry(2, 2), [])
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry])
  useEffect(() => () => chipGeometry.dispose(), [chipGeometry])

  return (
    <group
      position={[site.position.x, ground, site.position.z]}
      userData={{ scannerEnvironmentalId: site.id }}
    >
      {/* Generous invisible hit volume keeps aiming child-friendly. */}
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[site.visual === 'outcrop' ? 2.1 : 1.45, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {site.visual === 'rock' && (
        <>
          <mesh
            geometry={rockGeometry}
            position={[0, 0.42, 0]}
            rotation={[0.12, site.position.z * 0.13, 0.08]}
            scale={[1.35, 0.78, 1.05]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={PALETTE.rockDark}
              roughness={0.95}
              vertexColors
              emissive={PALETTE.accent}
              emissiveIntensity={glow}
            />
          </mesh>
          <mesh geometry={chipGeometry} position={[1.55, 0.1, 0.85]} scale={[0.42, 0.32, 0.48]} castShadow>
            <meshStandardMaterial color={PALETTE.rockLight} roughness={0.98} vertexColors />
          </mesh>
        </>
      )}

      {site.visual === 'outcrop' && <OutcropModel glow={glow} />}
    </group>
  )
}

export function EnvironmentalObjects() {
  const selectedId = useGameStore((state) => state.scannerEnvironmentalId)
  const analysis = useGameStore((state) => state.scannerAnalysis)

  return (
    <group name="EnvironmentalObjects" userData={{ scannerRoot: true }}>
      {WORLD_ENVIRONMENTAL_SITES.map((site) => (
        <EnvironmentalVisual
          key={site.id}
          site={site}
          selected={selectedId === site.id}
          analysis={analysis}
        />
      ))}
      <CalibrationStation />
    </group>
  )
}

/**
 * The practice rock a few steps from the landing. It uses the ordinary rock
 * visual and the same scannerEnvironmentalId contract. Until the child scans
 * it, a soft light column and a pulsing ground ring make it easy to find;
 * the column fades out the moment the practice scan is done.
 */
function CalibrationStation() {
  const { step } = useProtocol()
  const selectedId = useGameStore((state) => state.scannerEnvironmentalId)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const scannerOut = useGameStore((state) => state.scannerEquipped)
  const site = getEnvironmentalSite(CALIBRATION_SAMPLE.id)
  const ring = useRef<THREE.MeshBasicMaterial>(null)
  const ringMesh = useRef<THREE.Mesh>(null)
  const pillar = useRef<THREE.MeshBasicMaterial>(null)
  const fade = useRef(1)
  const pending = stepIndex(step) <= stepIndex('M2')
  const pillarGeometry = useMemo(() => {
    // Open cylinder, bright at the rock and fading to nothing at the top.
    const geometry = new THREE.CylinderGeometry(0.55, 0.9, 7, 20, 1, true)
    const position = geometry.getAttribute('position')
    const colors = new Float32Array(position.count * 3)
    for (let i = 0; i < position.count; i += 1) {
      const level = position.getY(i) > 0 ? 0 : 1
      colors[i * 3] = level
      colors[i * 3 + 1] = level
      colors[i * 3 + 2] = level
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.translate(0, 3.5, 0)
    return geometry
  }, [])

  useFrame((state, delta) => {
    fade.current = THREE.MathUtils.damp(fade.current, pending ? 1 : 0, 3, delta)
    const t = state.clock.elapsedTime
    const wave = reducedMotion ? 0.5 : 0.5 + Math.sin(t * 2.6) * 0.5
    if (ring.current) ring.current.opacity = (0.35 + wave * 0.45) * fade.current
    if (ringMesh.current) {
      ringMesh.current.scale.setScalar(reducedMotion ? 1 : 1 + wave * 0.12)
    }
    // The light column is for finding the rock; with the scanner out it
    // steps aside so the child sees the scan itself.
    if (pillar.current) {
      pillar.current.opacity =
        scannerOut ? 0 : (0.16 + wave * 0.1) * fade.current
    }
  })

  if (!site || stepIndex(step) > stepIndex('M3')) return null
  const ground = getTerrainHeight(site.position.x, site.position.z)

  return (
    <group name="CalibrationStation">
      <EnvironmentalVisual
        site={site}
        selected={selectedId === site.id}
        analysis="idle"
      />
      <mesh
        ref={ringMesh}
        position={[site.position.x, ground + 0.06, site.position.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ scannerIgnore: true }}
      >
        <ringGeometry args={[1.45, 1.75, 48]} />
        <meshBasicMaterial
          ref={ring}
          color={PALETTE.accent}
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        geometry={pillarGeometry}
        position={[site.position.x, ground, site.position.z]}
        userData={{ scannerIgnore: true }}
        renderOrder={4}
      >
        <meshBasicMaterial
          ref={pillar}
          color={PALETTE.accent}
          vertexColors
          transparent
          opacity={0.2}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
