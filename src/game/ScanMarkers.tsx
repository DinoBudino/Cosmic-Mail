import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { getMarkerViews, type MarkerState } from '../data/scanMarkers'
import { getScanAnchors, SPIRIT_SITE } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'

/**
 * Parts hunt: the child first searches with PIP's clue alone. If the part is
 * not found after this long, its marker appears to help.
 */
const REVEAL_AFTER_MS = 9000

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
  const texture = useMemo(() => getMarkerTexture(number, state), [number, state])

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
  })

  return (
    <group userData={{ scannerIgnore: true }}>
      <sprite
        ref={sprite}
        position={[
          position[0] + hitOffset[0],
          position[1] + hitOffset[1] + hitSize[1] / 2 + 0.22,
          position[2] + hitOffset[2],
        ]}
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
    </group>
  )
}

/**
 * Parts hunt markers: a small number badge above each part (the part
 * itself glows on the model, see partGlow.ts). While the scanner is out and the explorer is known:
 * - parts already recorded show a green check;
 * - the part to find now stays hidden at first (PIP gives a clue), and its
 *   marker appears after a while, when PIP is asked for help, or as soon as
 *   the reticle finds it;
 * - other parts show nothing, so there is only ever one thing to look for.
 * Distractor parts carry no marker. Positions come from the scan anchors.
 */
export function ScanMarkers() {
  const equipped = useGameStore(
    (state) =>
      state.scannerEquipped &&
      state.scannerMissionId === SPIRIT_SITE.missionId,
  )
  const aimedId = useGameStore((state) => state.scannerSelectedComponentId)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const hintedId = useNarrativeStore((state) =>
    state.attention?.kind === 'hint' ? state.attention.componentId : null,
  )
  const progress = useJourneyStore(
    (state) => state.save?.missions[SPIRIT_SITE.missionId] ?? null,
  )
  const orderedIds = getScanAnchors().map((anchor) => anchor.componentId)
  const scannedIds = progress?.scannedComponentIds
  const nextId =
    orderedIds.find((id) => !(scannedIds ?? []).includes(id)) ?? null

  // The clue gets a head start before the marker gives the answer away.
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const active = equipped && Boolean(progress?.discovered)
  useEffect(() => {
    if (!active || !nextId) return
    const timer = window.setTimeout(() => setRevealedId(nextId), REVEAL_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [active, nextId])

  if (!active || !progress) return null
  const views = getMarkerViews(orderedIds, progress.scannedComponentIds, aimedId)

  return (
    <group name="ScanMarkers">
      {getScanAnchors().map((anchor, index) => {
        const view = views[index]!
        const isNext = anchor.componentId === nextId
        const shown =
          view.state === 'recorded' ||
          (isNext &&
            (view.state === 'aimed' ||
              revealedId === nextId ||
              hintedId === nextId))
        if (!shown) return null
        return (
          <ScanMarker
            key={anchor.componentId}
            position={anchor.position}
            hitSize={anchor.hitSize}
            hitOffset={anchor.hitOffset}
            number={view.number}
            state={view.state}
            reducedMotion={reducedMotion}
          />
        )
      })}
    </group>
  )
}
