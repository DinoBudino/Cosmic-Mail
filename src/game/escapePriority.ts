/**
 * Escape priority for overlays. Modals that own Escape (native dialogs)
 * keep it; records/card close first; the equipped scanner puts away;
 * otherwise settings opens.
 */
export type EscapeAction =
  | 'ignore'
  | 'close-records'
  | 'unequip-scanner'
  | 'open-settings'

export interface EscapeState {
  settingsOpen: boolean
  /** The album tablet closes itself on Escape. */
  albumOpen?: boolean
  activeSiteId: string | null
  scannerOpen: boolean
  archiveView: 'none' | 'full-scan' | 'smart-letter' | 'reconstruction'
  scannerRecordsOpen: boolean
  scannerCardComponentId: string | null
  scannerEquipped: boolean
}

export function getEscapeAction(state: EscapeState): EscapeAction {
  if (
    state.settingsOpen ||
    state.albumOpen ||
    state.activeSiteId ||
    state.scannerOpen ||
    state.archiveView !== 'none'
  ) {
    return 'ignore'
  }
  if (state.scannerRecordsOpen || state.scannerCardComponentId) {
    return 'close-records'
  }
  if (state.scannerEquipped) return 'unequip-scanner'
  return 'open-settings'
}
