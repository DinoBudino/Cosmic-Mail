import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { MAILWING_LANDING } from '../data/spiritSite'
import { getTerrainHeight } from './terrainHeight'

const SHIP_URL = 'models/spaceship-cm01.glb'
/** Distance from the model origin to the bottom of its landing legs (m). */
const MODEL_HALF_HEIGHT = 6.07

/** Mailwing standing on its legs beside the landing zone. */
export function LandedShip() {
  const { scene } = useGLTF(SHIP_URL)
  const ship = useMemo(() => scene.clone(true), [scene])
  const { x, z } = MAILWING_LANDING.position
  const s = MAILWING_LANDING.scale
  const ground = getTerrainHeight(x, z)
  return (
    <primitive
      object={ship}
      position={[x, ground + MODEL_HALF_HEIGHT * s - 0.15, z]}
      rotation={[0, Math.PI * 0.82, 0]}
      scale={s}
    />
  )
}
