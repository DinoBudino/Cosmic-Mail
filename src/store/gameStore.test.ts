import { beforeEach, describe, expect, it } from 'vitest'
import { clearInput, readMoveAxes, setTouchMove } from '../game/input'
import { isWorldPaused, useGameStore } from './gameStore'
import { useOnboardingStore } from './onboardingStore'

describe('site interaction state', () => {
  beforeEach(() => {
    clearInput()
    useOnboardingStore.setState({ phase: 'playing' })
    useGameStore.setState({
      settingsOpen: false,
      nearbySiteId: null,
      activeSiteId: null,
      nearbySpirit: false,
      scannerOpen: false,
      scannerMissionId: null,
      scannerSelectedComponentId: null,
      scannerEquipped: false,
      scannerScanProgress: 0,
      scannerEnvironmentalId: null,
      scannerTargetKind: null,
      scannerPhysicalState: 'idle',
      scannerAnalysis: 'idle',
      scannerTriggerHeld: false,
      historicalExplanationId: null,
      radarUnlocked: true,
      cinematicFocus: null,
      scannerCamera: 'first-person',
      assistedScanEnabled: false,
      scannerCardComponentId: null,
      scannerRecordsOpen: false,
      archiveView: 'none',
      archiveMissionId: null,
      travelTargetId: null,
    })
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

  it('allows inspecting a coming-soon landmark as information only', () => {
    const state = useGameStore.getState()
    state.setNearbySite('viking1')
    state.openNearbySite()
    expect(useGameStore.getState().activeSiteId).toBe('viking1')
    state.closeSite()
    expect(useGameStore.getState().activeSiteId).toBeNull()
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

  it('opens and closes the Cosmic Scanner as a paused interaction', () => {
    const state = useGameStore.getState()
    state.setNearbySpirit(true)
    state.openScanner('spirit')

    expect(useGameStore.getState().scannerOpen).toBe(true)
    expect(useGameStore.getState().scannerMissionId).toBe('spirit')
    expect(useGameStore.getState().scannerSelectedComponentId).toBeNull()
    expect(isWorldPaused()).toBe(true)

    state.selectScannerComponent('spirit-pancam')
    expect(useGameStore.getState().scannerSelectedComponentId).toBe(
      'spirit-pancam',
    )

    state.closeScanner()
    expect(useGameStore.getState().scannerOpen).toBe(false)
    expect(useGameStore.getState().scannerMissionId).toBeNull()
    expect(useGameStore.getState().scannerSelectedComponentId).toBeNull()
    expect(isWorldPaused()).toBe(false)
  })

  it('keeps the Spirit prompt and the four legacy sites mutually exclusive', () => {
    const state = useGameStore.getState()
    state.setNearbySite('opportunity')
    state.setNearbySpirit(true)
    expect(useGameStore.getState().nearbySiteId).toBeNull()
    expect(useGameStore.getState().nearbySpirit).toBe(true)

    state.setNearbySite('insight')
    expect(useGameStore.getState().nearbySpirit).toBe(false)
    expect(useGameStore.getState().nearbySiteId).toBe('insight')
  })

  it('never opens the scanner over settings or a legacy site dialog', () => {
    const state = useGameStore.getState()
    state.openSettings()
    state.openScanner('spirit')
    expect(useGameStore.getState().scannerOpen).toBe(false)
    state.closeSettings()

    state.setNearbySite('opportunity')
    state.openNearbySite()
    state.openScanner('spirit')
    expect(useGameStore.getState().scannerOpen).toBe(false)
    state.closeSite()
  })

  it('blocks settings and travel while the scanner is open', () => {
    const state = useGameStore.getState()
    state.openScanner('spirit')
    state.openSettings()
    expect(useGameStore.getState().settingsOpen).toBe(false)
    state.startTravel('opportunity')
    expect(useGameStore.getState().travelTargetId).toBeNull()
    state.closeScanner()
  })

  it('opens an Archive overlay from the scanner and pauses the world', () => {
    const state = useGameStore.getState()
    state.setNearbySpirit(true)
    state.openScanner('spirit')
    state.selectScannerComponent('spirit-pancam')
    state.openArchive('smart-letter', 'spirit')

    const opened = useGameStore.getState()
    expect(opened.scannerOpen).toBe(false)
    expect(opened.scannerMissionId).toBeNull()
    expect(opened.scannerSelectedComponentId).toBeNull()
    expect(opened.archiveView).toBe('smart-letter')
    expect(opened.archiveMissionId).toBe('spirit')
    expect(isWorldPaused()).toBe(true)

    state.closeArchive()
    expect(useGameStore.getState().archiveView).toBe('none')
    expect(useGameStore.getState().archiveMissionId).toBeNull()
    expect(isWorldPaused()).toBe(false)
  })

  it('blocks scanner, settings, travel and landmarks while an Archive overlay is open', () => {
    const state = useGameStore.getState()
    state.openArchive('smart-letter', 'spirit')

    state.openScanner('spirit')
    expect(useGameStore.getState().scannerOpen).toBe(false)

    state.openSettings()
    expect(useGameStore.getState().settingsOpen).toBe(false)

    state.startTravel('opportunity')
    expect(useGameStore.getState().travelTargetId).toBeNull()

    state.setNearbySite('opportunity')
    state.openNearbySite()
    expect(useGameStore.getState().activeSiteId).toBeNull()

    state.closeArchive()
  })

  it('opens the optional records browser without equipping the scanner', () => {
    const state = useGameStore.getState()
    state.openScannerRecords('spirit', 'spirit-pancam')

    const records = useGameStore.getState()
    expect(records.scannerRecordsOpen).toBe(true)
    expect(records.scannerMissionId).toBe('spirit')
    expect(records.scannerCardComponentId).toBe('spirit-pancam')
    expect(records.scannerEquipped).toBe(false)
    expect(isWorldPaused()).toBe(true)

    state.closeScannerCard()
    expect(useGameStore.getState().scannerRecordsOpen).toBe(false)
    expect(useGameStore.getState().scannerCardComponentId).toBeNull()
    expect(useGameStore.getState().scannerMissionId).toBeNull()
    expect(isWorldPaused()).toBe(false)
  })

  it('keeps the records mission while the physical scanner stays equipped', () => {
    const state = useGameStore.getState()
    state.equipScanner('spirit')
    state.openScannerRecords('spirit')
    expect(useGameStore.getState().scannerRecordsOpen).toBe(true)
    expect(useGameStore.getState().scannerCardComponentId).toBeNull()

    state.closeScannerCard()
    expect(useGameStore.getState().scannerRecordsOpen).toBe(false)
    expect(useGameStore.getState().scannerMissionId).toBe('spirit')
    expect(useGameStore.getState().scannerEquipped).toBe(true)
  })

  it('never stacks records over another modal', () => {
    const state = useGameStore.getState()
    state.openScanner('spirit')
    state.openScannerRecords('spirit')
    expect(useGameStore.getState().scannerRecordsOpen).toBe(false)
    state.closeScanner()

    state.equipScanner('spirit')
    state.openArchive('smart-letter', 'spirit')
    state.openScannerRecords('spirit')
    expect(useGameStore.getState().scannerRecordsOpen).toBe(false)
    expect(useGameStore.getState().archiveView).toBe('smart-letter')
    state.closeArchive()
  })

  it('does not open an Archive overlay over settings or a landmark dialog', () => {
    const state = useGameStore.getState()
    state.openSettings()
    state.openArchive('smart-letter', 'spirit')
    expect(useGameStore.getState().archiveView).toBe('none')
    state.closeSettings()

    state.setNearbySite('opportunity')
    state.openNearbySite()
    state.openArchive('smart-letter', 'spirit')
    expect(useGameStore.getState().archiveView).toBe('none')
    state.closeSite()
  })

  it('clears held touch input when an Archive overlay opens and closes', () => {
    const state = useGameStore.getState()
    setTouchMove(1, 1)
    state.openArchive('smart-letter', 'spirit')
    expect(readMoveAxes({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })

    setTouchMove(1, 0)
    state.closeArchive()
    expect(readMoveAxes({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('equips and puts away the physical scanner without pausing the world', () => {
    const state = useGameStore.getState()
    state.startTravel('opportunity')
    state.equipScanner('spirit')

    const equipped = useGameStore.getState()
    expect(equipped.scannerEquipped).toBe(true)
    expect(equipped.scannerMissionId).toBe('spirit')
    expect(equipped.scannerSelectedComponentId).toBeNull()
    expect(equipped.scannerScanProgress).toBe(0)
    expect(equipped.scannerTriggerHeld).toBe(false)
    expect(equipped.travelTargetId).toBeNull()
    expect(isWorldPaused()).toBe(false)

    state.unequipScanner()
    expect(useGameStore.getState().scannerEquipped).toBe(false)
    expect(useGameStore.getState().scannerMissionId).toBeNull()
  })

  it('keeps assisted review and reading card paused', () => {
    const state = useGameStore.getState()
    state.equipScanner('spirit')
    state.openScanner('spirit')
    expect(useGameStore.getState().scannerOpen).toBe(true)
    expect(isWorldPaused()).toBe(true)
    state.closeScanner()
    expect(useGameStore.getState().scannerOpen).toBe(false)
    expect(useGameStore.getState().scannerEquipped).toBe(true)
    expect(isWorldPaused()).toBe(false)

    state.setScannerTarget('spirit-pancam')
    state.setScannerTrigger(true)
    state.setScannerScanProgress(0.6)
    state.openScannerCard('spirit-pancam')
    expect(useGameStore.getState().scannerCardComponentId).toBe(
      'spirit-pancam',
    )
    expect(useGameStore.getState().scannerTriggerHeld).toBe(false)
    expect(useGameStore.getState().scannerScanProgress).toBe(0)
    expect(isWorldPaused()).toBe(true)

    state.closeScannerCard()
    expect(useGameStore.getState().scannerCardComponentId).toBeNull()
    expect(isWorldPaused()).toBe(false)
  })

  it('keeps held movement input while equipping and putting away the scanner', () => {
    const state = useGameStore.getState()
    setTouchMove(1, 0)
    state.equipScanner('spirit')
    expect(readMoveAxes({ x: 0, y: 0 })).toEqual({ x: 1, y: 0 })
    expect(isWorldPaused()).toBe(false)

    state.unequipScanner()
    expect(readMoveAxes({ x: 0, y: 0 })).toEqual({ x: 1, y: 0 })
  })

  it('only changes target and trigger while equipped and resets hold progress on a new target', () => {
    const state = useGameStore.getState()
    state.setScannerTarget('spirit-pancam')
    state.setScannerTrigger(true)
    expect(useGameStore.getState().scannerSelectedComponentId).toBeNull()
    expect(useGameStore.getState().scannerTriggerHeld).toBe(false)

    state.equipScanner('spirit')
    state.setScannerTarget('spirit-pancam')
    state.setScannerScanProgress(0.4)
    expect(useGameStore.getState().scannerSelectedComponentId).toBe(
      'spirit-pancam',
    )
    expect(useGameStore.getState().scannerScanProgress).toBe(0.4)

    state.setScannerTarget('spirit-mini-tes')
    expect(useGameStore.getState().scannerScanProgress).toBe(0)

    state.setScannerTrigger(true)
    state.setScannerScanProgress(0.8)
    state.setScannerTrigger(false)
    expect(useGameStore.getState().scannerTriggerHeld).toBe(false)
    // Letting go early keeps the ring where it was (no penalty).
    expect(useGameStore.getState().scannerScanProgress).toBe(0.8)

    state.setScannerScanProgress(2)
    expect(useGameStore.getState().scannerScanProgress).toBe(1)
    state.setScannerScanProgress(-1)
    expect(useGameStore.getState().scannerScanProgress).toBe(0)
  })

  it('closes scanner and reading card when opening an Archive overlay', () => {
    const state = useGameStore.getState()
    state.equipScanner('spirit')
    state.openScanner('spirit')
    state.openScannerCard('spirit-pancam')
    state.openArchive('smart-letter', 'spirit')

    const opened = useGameStore.getState()
    expect(opened.archiveView).toBe('smart-letter')
    expect(opened.scannerOpen).toBe(false)
    expect(opened.scannerEquipped).toBe(false)
    expect(opened.scannerCardComponentId).toBeNull()
    expect(opened.scannerTriggerHeld).toBe(false)
    expect(opened.scannerScanProgress).toBe(0)
    expect(isWorldPaused()).toBe(true)
    state.closeArchive()
    expect(isWorldPaused()).toBe(false)
  })
})

describe('scanner accessibility settings', () => {
  it('keeps assisted component review explicitly opt-in', () => {
    useGameStore.getState().setAssistedScanEnabled(false)
    expect(useGameStore.getState().assistedScanEnabled).toBe(false)
    useGameStore.getState().setAssistedScanEnabled(true)
    expect(useGameStore.getState().assistedScanEnabled).toBe(true)
    useGameStore.getState().setAssistedScanEnabled(false)
  })
})

describe('scanner hold and distractor state', () => {
  beforeEach(() => {
    useGameStore.getState().unequipScanner()
  })

  it('keeps scan progress when the trigger is released early', () => {
    const store = useGameStore.getState()
    store.equipScanner('spirit')
    store.setScannerTrigger(true)
    useGameStore.setState({ scannerScanProgress: 0.6 })
    store.setScannerTrigger(false)
    expect(useGameStore.getState().scannerScanProgress).toBe(0.6)
  })

  it('shows one celebration per finished scan and dismisses it', () => {
    const store = useGameStore.getState()
    const at = { x: 0, y: 0, z: 0 }
    store.celebrateScan({ kind: 'practice', title: 'A', detail: 'a', at })
    store.celebrateScan({ kind: 'practice', title: 'B', detail: 'b', at })
    expect(useGameStore.getState().scanCelebration?.seq).toBe(2)
    expect(useGameStore.getState().scanCelebration?.title).toBe('B')
    store.dismissScanCelebration()
    expect(useGameStore.getState().scanCelebration).toBeNull()
  })

  it('tracks a distractor target exclusively and clears it on component target', () => {
    const store = useGameStore.getState()
    store.setScannerDistractorTarget('spirit-wheels')
    expect(useGameStore.getState().scannerDistractorId).toBeNull()

    store.equipScanner('spirit')
    store.setScannerDistractorTarget('spirit-wheels')
    expect(useGameStore.getState().scannerDistractorId).toBe('spirit-wheels')
    expect(useGameStore.getState().scannerSelectedComponentId).toBeNull()

    store.setScannerTarget('spirit-pancam')
    const after = useGameStore.getState()
    expect(after.scannerDistractorId).toBeNull()
    expect(after.scannerSelectedComponentId).toBe('spirit-pancam')

    store.setScannerDistractorTarget('spirit-antenna')
    store.unequipScanner()
    expect(useGameStore.getState().scannerDistractorId).toBeNull()
  })
})

describe('touch scan latch', () => {
  beforeEach(() => {
    useGameStore.getState().unequipScanner()
  })

  it('latches only while the trigger is held and the scanner is equipped', () => {
    const store = useGameStore.getState()
    store.setScannerLatched()
    expect(useGameStore.getState().scannerLatched).toBe(false)

    store.equipScanner('spirit')
    store.setScannerLatched()
    expect(useGameStore.getState().scannerLatched).toBe(false)

    store.setScannerTrigger(true)
    store.setScannerLatched()
    expect(useGameStore.getState().scannerLatched).toBe(true)
    expect(useGameStore.getState().scannerTriggerHeld).toBe(true)
  })

  it('releasing the trigger or putting the scanner away drops the latch', () => {
    const store = useGameStore.getState()
    store.equipScanner('spirit')
    store.setScannerTrigger(true)
    store.setScannerLatched()
    store.setScannerTrigger(false)
    expect(useGameStore.getState().scannerLatched).toBe(false)

    store.setScannerTrigger(true)
    store.setScannerLatched()
    store.unequipScanner()
    expect(useGameStore.getState().scannerLatched).toBe(false)
    expect(useGameStore.getState().scannerTriggerHeld).toBe(false)
  })
})

describe('scan station', () => {
  it('locks the child in place only while active, and is never persisted', () => {
    // This suite runs in the node environment, where localStorage can be absent.
    const storageLength = () =>
      typeof localStorage === 'undefined' ? 0 : localStorage.length
    const before = storageLength()
    useGameStore.getState().setScanStation(true)
    expect(useGameStore.getState().scanStation).toBe(true)
    useGameStore.getState().setScanStation(false)
    expect(useGameStore.getState().scanStation).toBe(false)
    expect(storageLength()).toBe(before)
  })
})
