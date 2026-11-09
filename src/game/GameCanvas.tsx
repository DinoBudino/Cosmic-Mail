import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { SceneStatus } from '../ui/SceneStatus'
import { CameraControls } from './CameraControls'
import { clearInput } from './input'
import { MarsWorld } from './MarsWorld'
import { QUALITY_PRESETS } from './worldConfig'

function ContextMonitor({ onLost }: { onLost: () => void }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => {
      event.preventDefault()
      clearInput()
      useGameStore.getState().cancelTravel()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', handleLost)
    return () => canvas.removeEventListener('webglcontextlost', handleLost)
  }, [gl, onLost])
  return null
}

export default function GameCanvas() {
  const quality = useGameStore((state) => state.quality)
  const [contextLost, setContextLost] = useState(false)
  if (contextLost) return <SceneStatus error />

  return (
    <Canvas
      shadows
      dpr={QUALITY_PRESETS[quality].dpr}
      camera={{ position: [0, 10, 30], fov: 55, near: 0.1, far: 900 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      fallback={<SceneStatus error />}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.1
        // In this Three.js version PCFShadowMap uses radius-aware filtering.
        gl.shadowMap.type = THREE.PCFShadowMap
      }}
    >
      <ContextMonitor onLost={() => setContextLost(true)} />
      <CameraControls />
      <MarsWorld />
    </Canvas>
  )
}
