import { Suspense } from 'react'
import { useGameStore } from '../store/gameStore'
import { EnvironmentalObjects } from './EnvironmentalObjects'
import { LandedShip } from './LandedShipModel'
import { LanderExplorer } from './LanderExplorer'
import { LunarSky } from './LunarSky'
import { LunarTerrain } from './LunarTerrain'
import { Player } from './Player'
import { ScanFx } from './ScanFx'
import { ScanKeyLabel } from './ScanKeyLabel'
import { ScannerBeam } from './ScannerBeam'
import { ScannerController } from './ScannerController'

/**
 * A landing on the Moon: same player, scanner, ship and mission flow as
 * Mars, on lunar ground (craters, regolith, black sky, Earth overhead) with
 * Surveyor 3 or Eagle at the explorer site.
 */
export function MoonWorld() {
  const quality = useGameStore((state) => state.quality)
  return (
    <>
      <LunarSky quality={quality} />
      <LunarTerrain quality={quality} />
      <Suspense fallback={null}>
        <EnvironmentalObjects practiceOnly />
      </Suspense>
      <Suspense fallback={null}>
        <LanderExplorer />
      </Suspense>
      <Suspense fallback={null}>
        <LandedShip />
      </Suspense>
      <Player />
      <ScannerBeam />
      <ScannerController />
      <ScanKeyLabel />
      <ScanFx />
    </>
  )
}
