import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getMarkerViews, type MarkerState } from '../data/scanMarkers'
import { SPIRIT_SCAN_ANCHORS, SPIRIT_SITE } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'

const COLORS: Record<MarkerState, { ring: string; fill: string; text: string }> =
  {
    pending: { ring: '#F2B5E2', fill: 'rgba(42,29,59,0.82)', text: '#FDF4EC' },
    next: { ring: '#FFD9A8', fill: 'rgba(42,29,59,0.92)', text: '#FFD9A8' },
    aimed: { ring: '#FFFFFF', fill: 'rgba(201,122,99,0.95)', text: '#FFFFFF' },
    recorded: { ring: '#9BD6A8', fill: 'rgba(42,29,59,0.6)', text: '#9BD6A8' },
  }

const textures = new Map<string, THREE.CanvasTexture>()

/** One small canvas per (number, state); cached for the whole session. */
function getMarkerTexture(number: number, state: MarkerState) {
  const key = `${number}:${state}`
  const cached = textures.get(key)
  if (cached) return cached
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const colors = COLORS[state]
  if (ctx) {
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, 54, 0, Math.PI * 2)
    ctx.fillStyle = colors.fill
    ctx.fill()
    ctx.lineWidth = state === 'next' || state === 'aimed' ? 9 : 6
    ctx.strokeStyle = colors.ring
    ctx.stroke()
    ctx.fillStyle = colors.text
    ctx.font = '700 64px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(state === 'recorded' ? '✓' : String(number), size / 2, size / 2 + 3)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  textures.set(key, texture)
  return texture
}

const WORLD_POS = new THREE.Vector3()

function ScanMarker({
  position,
  hitSize,
  hitOffset,
  number,
  state,
  reducedMotion,
}: {
  position: readonly [number, number, number]
  hitSize: readonly [number, number, number]
  hitOffset: readonly [number, number, number]
  number: number
  state: MarkerState
  reducedMotion: boolean
}) {
  const sprite = useRef<THREE.Sprite>(null)
  const outline = useRef<THREE.LineBasicMaterial>(null)
  const texture = useMemo(() => getMarkerTexture(number, state), [number, state])
  const edges = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(hitSize[0] + 0.08, hitSize[1] + 0.08, hitSize[2] + 0.08),
      ),
    [hitSize],
  )

  useFrame((frame) => {
    const node = sprite.current
    if (!node) return
    // Roughly constant on-screen size, readable from the scanner's 14 m.
    node.getWorldPosition(WORLD_POS)
    const distance = frame.camera.position.distanceTo(WORLD_POS)
    const base = Math.min(1.0, Math.max(0.34, distance * 0.06))
    const emphasis = state === 'aimed' ? 1.18 : state === 'next' ? 1.08 : 1
    const pulse =
      reducedMotion || state === 'pending' || state === 'recorded'
        ? 1
        : 1 + Math.sin(frame.clock.elapsedTime * 3.2) * 0.06
    node.scale.setScalar(base * emphasis * pulse)
    if (outline.current) {
      outline.current.opacity =
        state === 'aimed'
          ? 0.95
          : reducedMotion
            ? 0.55
            : 0.4 + Math.sin(frame.clock.elapsedTime * 3.2) * 0.15
    }
  })

  return (
    <group userData={{ scannerIgnore: true }}>
      <sprite
        ref={sprite}
        position={[position[0], position[1] + 0.6, position[2]]}
        renderOrder={12}
        userData={{ scannerIgnore: true }}
      >
        <spriteMaterial
          map={texture}
          transparent
          depthTest={false}
          depthWrite={false}
          opacity={state === 'recorded' ? 0.7 : 1}
          toneMapped={false}
        />
      </sprite>
      {(state === 'aimed' || state === 'next') && (
        <lineSegments
          geometry={edges}
          position={[
            position[0] + hitOffset[0],
            position[1] + hitOffset[1],
            position[2] + hitOffset[2],
          ]}
          renderOrder={11}
          userData={{ scannerIgnore: true }}
        >
          <lineBasicMaterial
            ref={outline}
            color={state === 'aimed' ? '#FFFFFF' : '#FFD9A8'}
            transparent
            opacity={0.6}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      )}
    </group>
  )
}

/**
 * Diegetic numbered markers on the explorer's scannable parts. Shown only
 * while the scanner is equipped and the explorer is identified; they never
 * name a part, only 1/2/3 with pending / next / aimed / recorded states.
 * Distractor parts carry no marker. Positions come from the scan anchors.
 */
export function ScanMarkers() {
  const equipped = useGameStore(
    (state) =>
      state.scannerEquipped &&
      state.scannerMissionId === SPIRIT_SITE.missionId,
  )
  const sweeping = useGameStore((state) => state.fullScanSweepActive)
  const aimedId = useGameStore((state) => state.scannerSelectedComponentId)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const progress = useJourneyStore(
    (state) => state.save?.missions[SPIRIT_SITE.missionId] ?? null,
  )
  const orderedIds = useMemo(
    () => SPIRIT_SCAN_ANCHORS.map((anchor) => anchor.componentId),
    [],
  )

  if (!equipped || !progress?.discovered || sweeping) return null
  const views = getMarkerViews(
    orderedIds,
    progress.scannedComponentIds,
    aimedId,
  )

  return (
    <group name="ScanMarkers">
      {SPIRIT_SCAN_ANCHORS.map((anchor, index) => (
        <ScanMarker
          key={anchor.componentId}
          position={anchor.position}
          hitSize={anchor.hitSize}
          hitOffset={anchor.hitOffset}
          number={views[index]!.number}
          state={views[index]!.state}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}
