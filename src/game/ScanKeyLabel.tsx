import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { CALIBRATION_SAMPLE } from '../data/arrivalProtocol'
import { getScanAnchors, SPIRIT_SITE } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { useProtocol } from '../ui/useProtocol'
import { getScanKeyTarget } from './scanKeyTarget'
import { getTerrainHeight } from './terrainHeight'
import { isCoarsePointer } from './missionNarrative'

/** The label only shows when the player is this close to the thing. */
const SHOW_RADIUS = 30

/**
 * "Press Q" floating above what the child should scan next (the practice
 * rock, then the explorer) whenever the next action is taking the scanner
 * out. The same hint is in the objective bar at the top, but children look
 * at the rock or the explorer, not at the top of the screen.
 */
export function ScanKeyLabel() {
  const { step, objective } = useProtocol()
  const blocked = useGameStore(
    (state) =>
      state.scannerEquipped ||
      state.scannerOpen ||
      state.scannerRecordsOpen ||
      state.settingsOpen ||
      state.archiveView !== 'none' ||
      state.activeSiteId !== null ||
      state.cinematicFocus !== null ||
      state.marsBriefingStep !== null ||
      state.arrivalStage !== 'done',
  )
  const target = getScanKeyTarget(step, objective.highlight)
  const position = useMemo(() => {
    if (target === 'practice-rock') {
      const { x, z } = CALIBRATION_SAMPLE.position
      return [x, getTerrainHeight(x, z) + 1.7, z] as const
    }
    if (target === 'explorer') {
      const { x, z } = SPIRIT_SITE.position
      const top = Math.max(1.6, ...getScanAnchors().map((anchor) => anchor.position[1]))
      return [x, getTerrainHeight(x, z) + top + 1.1, z] as const
    }
    return null
  }, [target])

  // Only near the target: far away the radar is the guide.
  const [near, setNear] = useState(false)
  const nearRef = useRef(false)
  useFrame(({ camera }) => {
    if (!position) return
    const close =
      Math.hypot(camera.position.x - position[0], camera.position.z - position[2]) < SHOW_RADIUS
    if (close !== nearRef.current) {
      nearRef.current = close
      setNear(close)
    }
  })

  if (!position || blocked || !near) return null
  const touch = isCoarsePointer()
  return (
    <Html position={position} center zIndexRange={[4, 0]} pointerEvents="none">
      <div className="scan-key-label" aria-hidden="true">
        {touch ? (
          <>
            Tap <span className="scan-key-label__key">Scanner</span>
          </>
        ) : (
          <>
            Press <span className="scan-key-label__key">Q</span>
          </>
        )}
      </div>
    </Html>
  )
}
