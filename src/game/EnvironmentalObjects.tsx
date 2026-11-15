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
<<<<<<< Updated upstream
import { getActiveWorld } from '../data/spiritSite'
import { buildRockGeometry, buildTintedRockGeometry } from './landscape'
import { MOON_ROCK } from './lunarRocks'
=======
import { useMarsRockGeometries, useMarsSurface } from './marsSurface'
>>>>>>> Stashed changes
import { getTerrainHeight } from './terrainHeight'
import { TerrainRing } from './TerrainRing'
import { PALETTE } from './worldConfig'
import { getGuideLane, getGuideMode } from './practiceGuide'

function OutcropModel({ glow, x, z, ground }: { glow: number; x: number; z: number; ground: number }) {
  const rocks = useMarsRockGeometries()
  const surface = useMarsSurface('basalt')
  return (
    <group>
      <mesh geometry={rocks[1]} position={[0, .36, 0]} scale={[1.5, .85, 1.15]} rotation={[.05, .3, -.08]} castShadow receiveShadow>
        <meshStandardMaterial {...surface} color={PALETTE.rockLight} roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={rocks[2]} position={[-1.05, .12, .65]} scale={[.8, .28, .65]} rotation={[.08, -.5, .13]} castShadow receiveShadow>
        <meshStandardMaterial {...surface} color={PALETTE.terrainHigh} roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={rocks[0]} position={[1.1, .13, -.6]} scale={[.7, .34, .6]} rotation={[0, 1.2, -.12]} castShadow receiveShadow>
        <meshStandardMaterial {...surface} color={PALETTE.rockDark} roughness={1} metalness={0} />
      </mesh>
      {glow > 0 && (
        <TerrainRing x={x} z={z} baseY={ground} innerRadius={1.55} outerRadius={1.72} segments={40}>
          <meshBasicMaterial
            color={PALETTE.accent}
            transparent
            opacity={glow}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </TerrainRing>
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
<<<<<<< Updated upstream
  // On the Moon the practice rock is a gray lunar rock.
  const moon = getActiveWorld() === 'moon'
  const rockGeometry = useMemo(() => (moon ? buildTintedRockGeometry(1, 3, MOON_ROCK.dust) : buildRockGeometry(1)), [moon])
  const chipGeometry = useMemo(() => (moon ? buildTintedRockGeometry(2, 2, MOON_ROCK.dust) : buildRockGeometry(2, 2)), [moon])
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry])
  useEffect(() => () => chipGeometry.dispose(), [chipGeometry])
=======
  const rocks = useMarsRockGeometries()
  const surface = useMarsSurface('basalt')
>>>>>>> Stashed changes

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
            geometry={rocks[0]}
            position={[0, 0.32, 0]}
            rotation={[0.12, site.position.z * 0.13, 0.08]}
            scale={[1.35, 0.78, 1.05]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
<<<<<<< Updated upstream
              color={moon ? MOON_ROCK.dark : PALETTE.rockDark}
              roughness={0.95}
              vertexColors
=======
              {...surface}
              color={PALETTE.rockDark}
              roughness={1}
>>>>>>> Stashed changes
              emissive={PALETTE.accent}
              emissiveIntensity={glow}
            />
          </mesh>
<<<<<<< Updated upstream
          <mesh geometry={chipGeometry} position={[1.55, 0.1, 0.85]} scale={[0.42, 0.32, 0.48]} castShadow>
            <meshStandardMaterial color={moon ? MOON_ROCK.light : PALETTE.rockLight} roughness={0.98} vertexColors />
=======
          <mesh geometry={rocks[2]} position={[1.55, 0.1, 0.85]} scale={[0.42, 0.32, 0.48]} castShadow receiveShadow>
            <meshStandardMaterial {...surface} color={PALETTE.rockLight} roughness={1} />
>>>>>>> Stashed changes
          </mesh>
        </>
      )}

      {site.visual === 'outcrop' && (
        <OutcropModel
          glow={glow}
          x={site.position.x}
          z={site.position.z}
          ground={ground}
        />
      )}
    </group>
  )
}

export function EnvironmentalObjects({ practiceOnly = false }: { practiceOnly?: boolean } = {}) {
  const selectedId = useGameStore((state) => state.scannerEnvironmentalId)
  const analysis = useGameStore((state) => state.scannerAnalysis)

  return (
    <group name="EnvironmentalObjects" userData={{ scannerRoot: true }}>
      {/* The Mars field features only exist on Mars; the practice rock goes everywhere. */}
      {!practiceOnly && WORLD_ENVIRONMENTAL_SITES.map((site) => (
        <EnvironmentalVisual
          key={site.id}
          site={site}
          selected={selectedId === site.id}
          analysis={analysis}
        />
      ))}
      <CalibrationStation />
      <GuideTrail />
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
  useEffect(() => () => pillarGeometry.dispose(), [pillarGeometry])

  useFrame((state, delta) => {
    fade.current = THREE.MathUtils.damp(fade.current, pending ? 1 : 0, 3, delta)
    const t = state.clock.elapsedTime
    const wave = reducedMotion ? 0.5 : 0.5 + Math.sin(t * 2.6) * 0.5
    if (ring.current) ring.current.opacity = (0.35 + wave * 0.45) * fade.current
    if (ringMesh.current) {
      ringMesh.current.scale.set(reducedMotion ? 1 : 1 + wave * 0.12, 1, reducedMotion ? 1 : 1 + wave * 0.12)
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
      <TerrainRing
        ref={ringMesh}
        x={site.position.x}
        z={site.position.z}
        baseY={ground}
        innerRadius={1.45}
        outerRadius={1.75}
        segments={56}
        lift={0.08}
        position={[site.position.x, ground, site.position.z]}
        userData={{ scannerIgnore: true }}
      >
        <meshBasicMaterial
          ref={ring}
          color={PALETTE.accent}
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </TerrainRing>
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

const TRAIL_DOTS = 9

/**
 * Guided first walk: a row of light dots on the ground from the landing
 * to the practice rock. A soft wave runs along them toward the rock, so the
 * way is obvious even without reading. Gone once the child arrives.
 */
function GuideTrail() {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const group = useRef<THREE.Group>(null)
  const fade = useRef(0)
  const { dots, materials } = useMemo(() => {
    const { start, end } = getGuideLane()
    const positions: Array<[number, number, number]> = []
    for (let i = 0; i < TRAIL_DOTS; i += 1) {
      const k = (i + 1) / (TRAIL_DOTS + 1)
      const x = start.x + (end.x - start.x) * k
      const z = start.z + (end.z - start.z) * k
      positions.push([x, getTerrainHeight(x, z) + 0.05, z])
    }
    const mats = positions.map(
      () =>
        new THREE.MeshBasicMaterial({
          color: PALETTE.accent,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
    )
    return { dots: positions, materials: mats }
  }, [])
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials])

  useFrame((state, delta) => {
    const on = getGuideMode() === 'walk'
    fade.current = THREE.MathUtils.damp(fade.current, on ? 1 : 0, 4, delta)
    if (group.current) group.current.visible = fade.current > 0.01
    if (fade.current <= 0.01) return
    const t = state.clock.elapsedTime
    materials.forEach((material, i) => {
      const wave = reducedMotion
        ? 0.6
        : 0.35 + 0.65 * Math.max(0, Math.sin(t * 3 - i * 0.7))
      material.opacity = wave * 0.85 * fade.current
    })
  })

  return (
    <group ref={group} visible={false}>
      {dots.map((position, i) => (
        <mesh
          key={i}
          position={position}
          rotation={[-Math.PI / 2, 0, 0]}
          material={materials[i]}
          userData={{ scannerIgnore: true }}
        >
          <circleGeometry args={[0.16, 20]} />
        </mesh>
      ))}
    </group>
  )
}
