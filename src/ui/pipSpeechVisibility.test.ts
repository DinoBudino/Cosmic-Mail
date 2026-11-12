import { describe, expect, it } from 'vitest'
import {
  isPipSpeechHidden,
  type PipSpeechVisibilityState,
} from './pipSpeechVisibility'

function state(
  overrides: Partial<PipSpeechVisibilityState> = {},
): PipSpeechVisibilityState {
  return {
    scannerEquipped: false,
    scannerOpen: false,
    scannerCardComponentId: null,
    scannerRecordsOpen: false,
    archiveOpen: false,
    settingsOpen: false,
    activeSiteId: null,
    ...overrides,
  }
}

describe('PIP subtitle visibility', () => {
  it('stays visible while the physical scanner is equipped', () => {
    expect(isPipSpeechHidden(state({ scannerEquipped: true }))).toBe(false)
    expect(isPipSpeechHidden(state())).toBe(false)
  })

  it('yields to every reading or settings modal', () => {
    expect(isPipSpeechHidden(state({ scannerOpen: true }))).toBe(true)
    expect(
      isPipSpeechHidden(state({ scannerCardComponentId: 'spirit-pancam' })),
    ).toBe(true)
    expect(isPipSpeechHidden(state({ scannerRecordsOpen: true }))).toBe(true)
    expect(isPipSpeechHidden(state({ archiveOpen: true }))).toBe(true)
    expect(isPipSpeechHidden(state({ settingsOpen: true }))).toBe(true)
    expect(isPipSpeechHidden(state({ activeSiteId: 'opportunity' }))).toBe(
      true,
    )
  })
})
