import { beforeEach, describe, expect, it } from 'vitest'
import { clearInput, readMoveAxes, setTouchMove } from '../game/input'
import { isWorldPaused, useGameStore } from './gameStore'
import { useOnboardingStore } from './onboardingStore'

describe('site interaction state', () => {
  beforeEach(() => {
    clearInput()
    useOnboardingStore.setState({ phase: 'playing' })
    useGameStore.setState({ settingsOpen: false, nearbySiteId: null, activeSiteId: null, challengePreview: false, travelTargetId: null })
  })

  it('requires a nearby site and pauses only when its panel opens', () => {
    const state = useGameStore.getState()
    state.openNearbySite()
    expect(isWorldPaused()).toBe(false)
    state.setNearbySite('opportunity')
    state.openNearbySite()
    expect(useGameStore.getState().activeSiteId).toBe('opportunity')
    expect(isWorldPaused()).toBe(true)
    state.closeSite()
    expect(isWorldPaused()).toBe(false)
  })

  it('clears held touch input on opening and closing', () => {
    const state = useGameStore.getState()
    state.setNearbySite('insight')
    setTouchMove(1, 1)
    state.openNearbySite()
    expect(readMoveAxes({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
    setTouchMove(1, 0)
    state.closeSite()
    expect(readMoveAxes({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('never opens settings and a site together', () => {
    const state = useGameStore.getState()
    state.setNearbySite('opportunity')
    state.openSettings()
    state.openNearbySite()
    expect(useGameStore.getState().activeSiteId).toBeNull()
    state.closeSettings()
    state.openNearbySite()
    state.openSettings()
    expect(useGameStore.getState().settingsOpen).toBe(false)
  })

  it('previews only the active available site without changing catalog state', () => {
    const state = useGameStore.getState()
    state.setNearbySite('opportunity')
    state.openNearbySite()
    state.startChallenge('insight')
    expect(useGameStore.getState().challengePreview).toBe(false)
    state.startChallenge('opportunity')
    expect(useGameStore.getState().challengePreview).toBe(true)
    state.closeSite()
    expect(useGameStore.getState().challengePreview).toBe(false)
  })

  it('allows inspecting Viking 1 but not starting a challenge', () => {
    const state = useGameStore.getState()
    state.setNearbySite('viking1')
    state.openNearbySite()
    expect(useGameStore.getState().activeSiteId).toBe('viking1')
    state.startChallenge('viking1')
    expect(useGameStore.getState().challengePreview).toBe(false)
  })

  it('starts and cancels travel without changing interaction eligibility', () => {
    const state = useGameStore.getState()
    state.startTravel('opportunity')
    expect(useGameStore.getState().travelTargetId).toBe('opportunity')
    expect(useGameStore.getState().nearbySiteId).toBeNull()
    state.openNearbySite()
    expect(useGameStore.getState().activeSiteId).toBeNull()
    state.cancelTravel()
    expect(useGameStore.getState().travelTargetId).toBeNull()
  })

  it('cancels travel on menus and refuses to start while paused', () => {
    const state = useGameStore.getState()
    state.startTravel('opportunity')
    state.openSettings()
    expect(useGameStore.getState().travelTargetId).toBeNull()
    state.startTravel('insight')
    expect(useGameStore.getState().travelTargetId).toBeNull()
    state.closeSettings()
    state.startTravel('insight')
    state.setNearbySite('insight')
    state.openNearbySite()
    expect(useGameStore.getState().travelTargetId).toBeNull()
    state.startTravel('opportunity')
    expect(useGameStore.getState().travelTargetId).toBeNull()
  })
})
