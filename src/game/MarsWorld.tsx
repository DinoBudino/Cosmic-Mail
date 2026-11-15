import { Suspense } from 'react'
import { useGameStore } from '../store/gameStore'
import { Atmosphere } from './Atmosphere'
import { EnvironmentalObjects } from './EnvironmentalObjects'
import { Player } from './Player'
import { ScannerBeam } from './ScannerBeam'
import { ScannerController } from './ScannerController'
import { ScanFx } from './ScanFx'
import { getActiveExplorer } from '../data/spiritSite'
import { LanderExplorer } from './LanderExplorer'
import { MerRover } from './MerRover'
import { LandedShip } from './LandedShipModel'
import { Terrain } from './Terrain'

export function MarsWorld() {
  const quality = useGameStore((state) => state.quality)

  return (
    <>
      <Atmosphere quality={quality} />
      <Suspense fallback={null}>
        <Terrain quality={quality} />
      </Suspense>
      <Suspense fallback={null}>
        <EnvironmentalObjects />
      </Suspense>
      <Suspense fallback={null}>
        {/* Viking 1 is a lander; Spirit and Opportunity share the rover model. */}
        {getActiveExplorer() === 'viking-1' ? <LanderExplorer /> : <MerRover />}
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
