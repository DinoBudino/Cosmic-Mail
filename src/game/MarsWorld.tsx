import { useGameStore } from '../store/gameStore'
import { Atmosphere } from './Atmosphere'
import { MarsObjects } from './MarsObjects'
import { Player } from './Player'
import { Terrain } from './Terrain'

export function MarsWorld() {
  const quality = useGameStore((state) => state.quality)

  return (
    <>
      <Atmosphere quality={quality} />
      <Terrain quality={quality} />
      <MarsObjects />
      <Player />
    </>
  )
}
