import { Suspense } from 'react'
import { useGameStore } from '../store/gameStore'
import { Atmosphere } from './Atmosphere'
import { EnvironmentalObjects } from './EnvironmentalObjects'
import { MarsObjects } from './MarsObjects'
import { Player } from './Player'
import { ScannerBeam } from './ScannerBeam'
import { ScannerController } from './ScannerController'
import { SpiritPlaceholder } from './SpiritPlaceholder'
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
      <MarsObjects />
      <SpiritPlaceholder />
      <Player />
      <ScannerBeam />
      <ScannerController />
    </>
  )
}
