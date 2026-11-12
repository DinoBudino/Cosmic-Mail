import { describe, expect, it } from 'vitest'
import { getEscapeAction, type EscapeState } from './escapePriority'

function state(overrides: Partial<EscapeState> = {}): EscapeState {
  return {
    settingsOpen: false,
    activeSiteId: null,
    scannerOpen: false,
    archiveView: 'none',
    scannerRecordsOpen: false,
    scannerCardComponentId: null,
    scannerEquipped: false,
    ...overrides,
  }
}

describe('Escape priority', () => {
  it('lets native modal dialogs keep Escape', () => {
    expect(getEscapeAction(state({ settingsOpen: true }))).toBe('ignore')
    expect(getEscapeAction(state({ activeSiteId: 'opportunity' }))).toBe(
      'ignore',
    )
    expect(getEscapeAction(state({ scannerOpen: true }))).toBe('ignore')
    expect(getEscapeAction(state({ archiveView: 'smart-letter' }))).toBe('ignore')
  })

  it('closes optional records before touching the scanner', () => {
    expect(
      getEscapeAction(
        state({
          scannerRecordsOpen: true,
          scannerEquipped: true,
          scannerCardComponentId: 'spirit-pancam',
        }),
      ),
    ).toBe('close-records')
  })

  it('puts away the equipped scanner before opening settings', () => {
    expect(getEscapeAction(state({ scannerEquipped: true }))).toBe(
      'unequip-scanner',
    )
  })

  it('opens settings only when nothing else is active', () => {
    expect(getEscapeAction(state())).toBe('open-settings')
  })
})
