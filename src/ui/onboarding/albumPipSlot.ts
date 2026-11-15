import { create } from 'zustand'

/**
 * The PIP corner inside the Cosmic Album tablet. While the cabin tour
 * explains the album, the cabin's speech bubble (typing, voice, click
 * anywhere) is moved into this corner instead of floating over the
 * tablet.
 */
export const useAlbumPipSlot = create<{
  slot: HTMLElement | null
  setSlot: (slot: HTMLElement | null) => void
}>((set) => ({
  slot: null,
  setSlot: (slot) => set({ slot }),
}))
