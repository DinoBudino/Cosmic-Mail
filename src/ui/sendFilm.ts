import { pipLine } from '../data/pipVoiceCatalog'
import type { MissionId } from '../data/missions'
import { SPIRIT_SITE } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { useOnboardingStore } from '../store/onboardingStore'

/** The film before a story is sent home (explorerShots.getSendFilmFrame). */
export const SEND_FILM_MS = 9800

/**
 * "Watch its story" in the album. On the planet, with the story not sent
 * yet, a short film comes first: the album steps aside, the camera comes
 * close to PIP holding the glowing message beside the explorer ("it's
 * ready!"), then looks up as it rises towards Earth. When the film ends
 * (or is skipped) the story video and the sending screen open. In the
 * cabin, on replays or with reduced motion the story opens right away.
 */
export function watchStory(missionId: MissionId): void {
  const game = useGameStore.getState()
  const journey = useJourneyStore.getState()
  journey.markReconstructionWatched(missionId)
  const sent = journey.save?.missions[missionId]?.transmittedAt != null
  const onPlanet =
    useOnboardingStore.getState().phase === 'playing' &&
    missionId === SPIRIT_SITE.missionId
  if (sent || !onPlanet || game.reducedMotion) {
    game.openArchive('reconstruction', missionId)
    return
  }
  const narrative = useNarrativeStore.getState()
  narrative.clearDialogue()
  narrative.enqueue({
    id: `${missionId}:send-film:ready`,
    text: pipLine('send-film-ready'),
    priority: 'archive',
    expression: 'excited',
    once: false,
  })
  narrative.enqueue({
    id: `${missionId}:send-film:launch`,
    text: pipLine('send-film-launch'),
    priority: 'archive',
    expression: 'excited',
    once: false,
  })
  game.startCinematic(
    'send',
    { x: SPIRIT_SITE.position.x, z: SPIRIT_SITE.position.z },
    SEND_FILM_MS,
    undefined,
    missionId,
  )
}

/** The film is over: the story video and the sending screen. */
export function finishSendFilm(missionId: MissionId): void {
  useNarrativeStore.getState().clearDialogue()
  useGameStore.getState().openArchive('reconstruction', missionId)
}
