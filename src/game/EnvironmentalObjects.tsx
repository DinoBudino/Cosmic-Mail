import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  ENVIRONMENTAL_SITES,
  type EnvironmentalSite,
} from '../data/environmentalSites'
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
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
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
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry])

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
              flatShading
              emissive={PALETTE.accent}
              emissiveIntensity={glow}
            />
          </mesh>
          <mesh position={[0.75, 0.18, 0.4]} scale={[0.45, 0.3, 0.5]} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={PALETTE.rockLight}
              roughness={0.98}
              flatShading
            />
          </mesh>
        </>
      )}

      {site.visual === 'soil' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
            <circleGeometry args={[2.15, 26]} />
            <meshStandardMaterial
              color={PALETTE.dust}
              roughness={1}
              transparent
              opacity={0.72}
              emissive={PALETTE.accent}
              emissiveIntensity={glow * 0.55}
            />
          </mesh>
          {[0.55, 1.05, 1.55].map((radius) => (
            <mesh
              key={radius}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.045, 0]}
            >
              <ringGeometry args={[radius, radius + 0.08, 20]} />
              <meshStandardMaterial
                color={PALETTE.terrainMid}
                roughness={1}
                transparent
                opacity={0.45}
                depthWrite={false}
              />
            </mesh>
          ))}
        </>
      )}

      {site.visual === 'wind' && (
        <>
          {[0, 1, 2, 3].map((index) => (
            <mesh
              key={index}
              rotation={[-Math.PI / 2, 0, index * 0.5]}
              position={[index * 0.18 - 0.3, 0.04 + index * 0.01, index * 0.22 - 0.3]}
              scale={[1.25 - index * 0.18, 0.38, 1]}
            >
              <torusGeometry args={[1.25, 0.07, 4, 20, Math.PI * 1.5]} />
              <meshStandardMaterial
                color={PALETTE.terrainLight}
                roughness={0.95}
                emissive={PALETTE.accent}
                emissiveIntensity={glow * 0.4}
              />
            </mesh>
          ))}
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
    <group name="EnvironmentalObjects">
      {ENVIRONMENTAL_SITES.map((site) => (
        <EnvironmentalVisual
          key={site.id}
          site={site}
          selected={selectedId === site.id}
          analysis={analysis}
        />
      ))}
    </group>
  )
}
