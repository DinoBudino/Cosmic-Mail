import { useEffect, useRef } from 'react'
import type { MissionId } from '../data/missions'
import { finishSendFilm } from './sendFilm'
import { emitAudio } from '../game/audio/audioEvents'
import { useGameStore } from '../store/gameStore'
import { Passport } from './onboarding/Passport'
import { useAlbumGuide } from './useAlbumGuide'

/**
 * The Cosmic Album while exploring: the same tablet as in the cabin,
 * opened from the HUD. The world pauses behind it.
 */
export function AlbumOverlay() {
  const albumOpen = useGameStore((state) => state.albumOpen)
  const closeAlbum = useGameStore((state) => state.closeAlbum)
  // A story or letter opened from the album shows on top of it.
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  // While PIP guides a completed explorer's story, the album stays open.
  const locked = useAlbumGuide().step?.locked ?? false
  // The film before sending a story home: the album steps aside, then the
  // story opens on top of it when the film ends or is skipped.
  const sendFilmId = useGameStore((state) =>
    state.cinematicFocus?.kind === 'send' ? (state.cinematicFocus.missionId ?? null) : null,
  )
  const filmFor = useRef<MissionId | null>(null)
  useEffect(() => {
    if (sendFilmId) {
      filmFor.current = sendFilmId
      return
    }
    const done = filmFor.current
    if (!done) return
    filmFor.current = null
    finishSendFilm(done)
  }, [sendFilmId])

  useEffect(() => {
    if (!albumOpen || archiveOpen || locked) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      emitAudio('uiClick')
      closeAlbum()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [albumOpen, archiveOpen, locked, closeAlbum])

  if (!albumOpen || sendFilmId) return null
  return (
    <div
      className="passport-detail passport-detail--game"
      onClick={(event) => {
        if (event.target === event.currentTarget && !locked) closeAlbum()
      }}
    >
      <div className="passport-detail__card">
        <Passport
          onClose={() => {
            emitAudio('uiClick')
            closeAlbum()
          }}
        />
      </div>
    </div>
  )
}
