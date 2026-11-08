import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { attachCameraControls } from './cameraRig'

export function CameraControls() {
  const gl = useThree((state) => state.gl)

  useEffect(() => attachCameraControls(gl.domElement), [gl])

  return null
}
