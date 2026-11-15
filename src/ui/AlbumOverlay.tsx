import { useEffect } from 'react'
import { emitAudio } from '../game/audio/audioEvents'
import { useGameStore } from '../store/gameStore'
import { Passport } from './onboarding/Passport'

/**
 * The Cosmic Album while exploring: the same tablet as in the cabin,
 * opened from the HUD. The world pauses behind it.
 */
export function AlbumOverlay() {
  const albumOpen = useGameStore((state) => state.albumOpen)
  const closeAlbum = useGameStore((state) => state.closeAlbum)
  // A story or letter opened from the album shows on top of it.
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')

  useEffect(() => {
    if (!albumOpen || archiveOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      emitAudio('uiClick')
      closeAlbum()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [albumOpen, archiveOpen, closeAlbum])

  if (!albumOpen) return null
  return (
    <div
      className="passport-detail passport-detail--game"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeAlbum()
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
