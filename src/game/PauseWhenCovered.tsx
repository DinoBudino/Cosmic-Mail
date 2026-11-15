import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { findMission } from '../data/missions'
import { useGameStore } from '../store/gameStore'

/** True while a story video covers the whole screen. */
function useStoryCoversScreen(): boolean {
  return useGameStore(
    (state) =>
      state.archiveView === 'reconstruction' &&
      state.archiveMissionId != null &&
      Boolean(findMission(state.archiveMissionId)?.reconstruction.video),
  )
}

/**
 * Stops drawing the 3D scene while the full-screen story video is on top
 * (nothing of it is visible). Saves battery and keeps the video smooth on
 * modest PCs. On resume the clock skips the paused time, so nothing jumps.
 */
export function PauseWhenCovered() {
  const covered = useStoryCoversScreen()
  const setFrameloop = useThree((state) => state.setFrameloop)
  const clock = useThree((state) => state.clock)
  useEffect(() => {
    if (covered) {
      setFrameloop('never')
      return
    }
    clock.getDelta()
    setFrameloop('always')
  }, [covered, setFrameloop, clock])
  return null
}
