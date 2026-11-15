import { getAlbumGuideStep, isFirstAlbumDelivery, type AlbumGuideStep } from '../data/albumGuide'
import { findMission, type MissionId } from '../data/missions'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'

export interface AlbumGuide {
  focusId: MissionId | null
  step: AlbumGuideStep | null
  firstTime: boolean
}

/** The step PIP is on inside the album (null outside a completed story). */
export function useAlbumGuide(introDone = true): AlbumGuide {
  const focusId = useGameStore((state) => state.albumFocusId)
  const missions = useJourneyStore((state) => state.save?.missions ?? null)
  const mission = focusId ? findMission(focusId) : null
  if (!focusId || !mission || !missions) {
    return { focusId: null, step: null, firstTime: false }
  }
  const firstTime = isFirstAlbumDelivery(missions, focusId)
  return {
    focusId,
    firstTime,
    step: getAlbumGuideStep({
      mission,
      progress: missions[focusId] ?? null,
      firstTime,
      introDone,
    }),
  }
}
