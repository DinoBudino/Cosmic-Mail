import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { attachCameraControls, clampOrbitPitch } from './cameraRig'
import { setScannerPointerCenter } from './scannerPointer'

export function CameraControls() {
  const gl = useThree((state) => state.gl)

  useEffect(() => attachCameraControls(gl.domElement), [gl])

  useEffect(() => {
    const sync = () => {
      const state = useGameStore.getState()
      const firstPerson =
        state.scannerEquipped && state.scannerCamera === 'first-person'
      const modalOpen =
        state.settingsOpen ||
        state.scannerOpen ||
        state.scannerRecordsOpen ||
        state.activeSiteId !== null ||
        state.archiveView !== 'none'
      clampOrbitPitch(firstPerson)
      if (firstPerson && !modalOpen) {
        setScannerPointerCenter()
      } else if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock()
      }
    }
    sync()
    return useGameStore.subscribe(sync)
  }, [gl])

  return null
}
