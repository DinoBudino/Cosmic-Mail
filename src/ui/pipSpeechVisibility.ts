/** Which overlays own the screen and hide PIP's world subtitles. */
export interface PipSpeechVisibilityState {
  scannerEquipped: boolean
  scannerOpen: boolean
  scannerCardComponentId: string | null
  scannerRecordsOpen: boolean
  archiveOpen: boolean
  settingsOpen: boolean
  activeSiteId: string | null
}

export function isPipSpeechHidden(
  state: PipSpeechVisibilityState,
): boolean {
  // The physical scanner is not a modal: PIP explains discoveries while
  // the player is still aiming/walking. Only reading panels hide the box.
  return Boolean(
    state.scannerOpen ||
      state.scannerCardComponentId ||
      state.scannerRecordsOpen ||
      state.archiveOpen ||
      state.settingsOpen ||
      state.activeSiteId,
  )
}
