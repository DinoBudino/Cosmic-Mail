import { Suspense } from 'react'
import { useGameStore } from '../store/gameStore'
import { Atmosphere } from './Atmosphere'
import { EnvironmentalObjects } from './EnvironmentalObjects'
import { Player } from './Player'
import { ScannerBeam } from './ScannerBeam'
import { ScannerController } from './ScannerController'
import { ScanFx } from './ScanFx'
import { MerRover } from './MerRover'
import { LandedShip } from './LandedShip.tsx'
import { Terrain } from './Terrain'

export function MarsWorld() {
  const quality = useGameStore((state) => state.quality)

  return (
    <>
      <Atmosphere quality={quality} />
      <Terrain quality={quality} />
      <Suspense fallback={null}>
        <EnvironmentalObjects />
      </Suspense>
      <Suspense fallback={null}>
        <MerRover />
      </Suspense>
      <Suspense fallback={null}>
        <LandedShip />
      </Suspense>
      <Player />
      <ScannerBeam />
      <ScannerController />
      <ScanFx />
    </>
  )
}
