import { beforeEach, describe, expect, it } from 'vitest'
import { migrateExplorerId, useOnboardingStore } from './onboardingStore'

function resetStore() {
  useOnboardingStore.setState({
    phase: 'menu',
    passport: null,
    explorerName: '',
    answers: [],
    questionIndex: 0,
    trait: null,
    explorerId: null,
    dialogueIndex: 0,
    routeOpen: false,
    selectedZoneId: null,
    tutorialDone: false,
  })
}

function completeRitual(trait: 'brave' | 'careful' | 'observant' | 'methodical' = 'brave') {
  const store = () => useOnboardingStore.getState()
  store().startMission()
  store().continueFromIntro()
  for (let i = 0; i < 4; i += 1) store().answerQuestion(trait)
  store().continueFromReveal()
  store().confirmExplorer(store().explorerId!)
  store().submitName('Ada')
}

describe('roster migration', () => {
  it('maps the removed Valentina id to Sally Ride and leaves other ids alone', () => {
    expect(migrateExplorerId('valentina-tereshkova')).toBe('sally-ride')
    expect(migrateExplorerId('mae-jemison')).toBe('mae-jemison')
    expect(migrateExplorerId('katherine-johnson')).toBe('katherine-johnson')
  })
})

describe('onboarding flow', () => {
  beforeEach(resetStore)

  it('opens with the intro before the routine check', () => {
    const store = () => useOnboardingStore.getState()
    store().startMission()
    expect(store().phase).toBe('intro')
    expect(store().boardingStage).toBe('approach')
    // A new beginning runs the tutorial again.
    expect(store().tutorialDone).toBe(false)

    store().continueFromIntro()
    expect(store().phase).toBe('questions')
  })

  it('walks through the full ritual to the hub, signing the name last', () => {
    const store = () => useOnboardingStore.getState()

    store().startMission()
    expect(store().phase).toBe('intro')
    store().continueFromIntro()
    expect(store().phase).toBe('questions')

    for (let i = 0; i < 4; i += 1) store().answerQuestion('brave')
    expect(store().phase).toBe('reveal')
    expect(store().trait).toBe('brave')

    store().continueFromReveal()
    // The power's hero is assigned automatically on leaving the reveal.
    expect(store().explorerId).toBe('sally-ride')
    expect(store().phase).toBe('explorer')

    // Keeping the assigned hero goes straight to the name step: no module.
    store().confirmExplorer('sally-ride')
    expect(store().phase).toBe('name')
    expect(store().passport).toBeNull()

    store().submitName('  Ada  ')
    expect(store().phase).toBe('hub')
    expect(store().passport).toMatchObject({
      explorerName: 'Ada',
      trait: 'brave',
      explorerId: 'sally-ride',
      unlockedExplorerIds: ['sally-ride'],
      stamps: [],
      memorySites: [],
      missionNumber: 1,
      destination: null,
    })

    // PIP has reached the "tap the radar screen" line: unlocked.
    store().setDialogueIndex(3)
    store().selectZone('mars')
    store().takeOff()
    // The red button starts the lift-off cinematic, not the world.
    expect(store().phase).toBe('launching')
    expect(store().passport?.destination).toBe('mars')
    // First take-off: PIP only remembers the active hero.
    expect(store().passport?.unlockedExplorerIds).toEqual(['sally-ride'])
    store().finishLaunch()
    expect(store().phase).toBe('playing')
  })

  it('choosing another hero also changes the power', () => {
    const store = () => useOnboardingStore.getState()
    completeRitual('brave')
    expect(store().trait).toBe('brave')

    // A locked hero cannot be switched to from the archive.
    store().switchHero('mae-jemison')
    expect(store().trait).toBe('brave')

    // After recovering her memory, switching swaps hero AND power.
    expect(store().collectMemory('opportunity')).toBe('mae-jemison')
    store().switchHero('mae-jemison')
    expect(store().explorerId).toBe('mae-jemison')
    expect(store().trait).toBe('observant')
    expect(store().passport?.trait).toBe('observant')
  })

  it('collecting a memory restores the next locked hero once per site', () => {
    const store = () => useOnboardingStore.getState()
    completeRitual('brave')

    expect(store().collectMemory('opportunity')).toBe('mae-jemison')
    expect(store().collectMemory('opportunity')).toBeNull()
    expect(store().passport?.unlockedExplorerIds).toEqual([
      'sally-ride',
      'mae-jemison',
    ])
    expect(store().passport?.stamps).toEqual(['mae-jemison'])
    expect(store().passport?.memorySites).toEqual(['opportunity'])

    expect(store().collectMemory('insight')).toBe('katherine-johnson')
    expect(store().collectMemory('ingenuity')).toBe('margaret-hamilton')
    expect(store().passport?.unlockedExplorerIds).toHaveLength(4)
  })

  it('finishLaunch only ends an active launch (Skip is safe to repeat)', () => {
    const store = () => useOnboardingStore.getState()
    store().finishLaunch()
    expect(store().phase).toBe('menu')
  })

  it('rejects short names and keeps the signing step', () => {
    const store = () => useOnboardingStore.getState()
    store().startMission()
    store().continueFromIntro()
    for (let i = 0; i < 4; i += 1) store().answerQuestion('careful')
    store().continueFromReveal()
    store().confirmExplorer(store().explorerId!)
    expect(store().phase).toBe('name')

    store().submitName(' x ')
    expect(store().phase).toBe('name')
    expect(store().passport).toBeNull()
  })

  it('goes back one question at a time and replaces the answer', () => {
    const store = () => useOnboardingStore.getState()
    store().startMission()
    store().continueFromIntro()
    store().answerQuestion('brave')
    store().answerQuestion('careful')
    expect(store().questionIndex).toBe(2)

    store().goBack()
    expect(store().questionIndex).toBe(1)
    store().answerQuestion('reflective')
    expect(store().answers).toEqual(['brave', 'reflective'])
    expect(store().questionIndex).toBe(2)
  })

  it('goes back from reveal to the last question, from questions to intro, and from name to explorer', () => {
    const store = () => useOnboardingStore.getState()
    store().startMission()
    store().continueFromIntro()
    for (let i = 0; i < 4; i += 1) store().answerQuestion('observant')
    store().goBack()
    expect(store().phase).toBe('questions')
    expect(store().questionIndex).toBe(3)
    expect(store().trait).toBeNull()

    store().goBack()
    store().goBack()
    store().goBack()
    store().goBack()
    expect(store().phase).toBe('intro')

    store().continueFromIntro()
    for (let i = 0; i < 4; i += 1) store().answerQuestion('observant')
    store().continueFromReveal()
    store().confirmExplorer(store().explorerId!)
    expect(store().phase).toBe('name')
    store().goBack()
    expect(store().phase).toBe('explorer')
  })

  it('continueMission lands on the hub initial view, with no dialogue', () => {
    const store = () => useOnboardingStore.getState()

    completeRitual('brave')
    expect(store().phase).toBe('hub')
    expect(store().routeOpen).toBe(false)

    // Returning carrier: the hub opens on the initial cabin view
    // (route closed) and with no PIP bubble (no dialogue lines).
    store().continueMission()
    expect(store().phase).toBe('hub')
    expect(store().boardingStage).toBe('approach')
    expect(store().routeOpen).toBe(false)
    expect(store().selectedZoneId).toBeNull()
    expect(store().dialogueIndex).toBe(0)

    // Only tapping the navigation panel on the board leans the camera
    // in (routeOpen), where destinations can be chosen — and only
    // once PIP has said "tap the radar screen" (dialogue index 2).
    store().setDialogueIndex(3)
    store().setRouteOpen(true)
    expect(store().routeOpen).toBe(true)
    store().selectZone('mars')
    store().takeOff()
    expect(store().phase).toBe('launching')
    store().finishLaunch()
    expect(store().phase).toBe('playing')
    // The first take-off ends the tutorial.
    expect(store().tutorialDone).toBe(true)
  })

  it('clearSelection returns the navigation screen to the cards', () => {
    const store = () => useOnboardingStore.getState()
    useOnboardingStore.setState({ phase: 'hub', dialogueIndex: 3 })
    store().selectZone('mars')
    expect(store().selectedZoneId).toBe('mars')
    store().clearSelection()
    expect(store().selectedZoneId).toBeNull()
  })

  it('submitName clears the signing window so the hub tour can speak', () => {
    const store = () => useOnboardingStore.getState()
    store().startMission()
    store().continueFromIntro()
    for (let i = 0; i < 4; i += 1) store().answerQuestion('brave')
    store().continueFromReveal()
    store().confirmExplorer(store().explorerId!)
    // PIP's warning opened the signing window.
    store().setSigning(true)
    expect(store().signing).toBe(true)
    store().submitName('Zahir')
    expect(store().phase).toBe('hub')
    expect(store().signing).toBe(false)
  })

  it('the take-off lid only opens after SELECT confirms the route', () => {
    const store = () => useOnboardingStore.getState()
    useOnboardingStore.setState({ phase: 'hub', dialogueIndex: 3 })
    store().selectZone('mars')
    // Previewing a destination does not confirm it.
    expect(store().routeConfirmed).toBe(false)
    store().confirmRoute()
    expect(store().routeConfirmed).toBe(true)
    // Going back to the cards un-confirms it again.
    store().clearSelection()
    expect(store().routeConfirmed).toBe(false)
  })

  it('the navigation panel stays locked until PIP says "tap the radar screen"', () => {
    const store = () => useOnboardingStore.getState()
    useOnboardingStore.setState({ phase: 'hub', dialogueIndex: 0, tutorialDone: false, routeConfirmed: false })

    // Lines 0-2 (passport arrival, passport contents and navigation
    // intro): panel inert.
    for (const index of [0, 1, 2]) {
      store().setDialogueIndex(index)
      store().setRouteOpen(true)
      expect(store().routeOpen).toBe(false)
      store().selectZone('mars')
      expect(store().selectedZoneId).toBeNull()
    }

    // Line 3 ("tap the radar screen"): the side view and cards unlock.
    store().setDialogueIndex(3)
    store().setRouteOpen(true)
    expect(store().routeOpen).toBe(true)
    store().selectZone('mars')
    expect(store().selectedZoneId).toBe('mars')
  })

  it('returning carriers and confirmed routes are never locked out', () => {
    const store = () => useOnboardingStore.getState()
    useOnboardingStore.setState({ phase: 'hub', dialogueIndex: 0, tutorialDone: true, routeConfirmed: false })
    store().setRouteOpen(true)
    expect(store().routeOpen).toBe(true)

    useOnboardingStore.setState({ tutorialDone: false, routeConfirmed: true, routeOpen: false })
    store().setRouteOpen(true)
    expect(store().routeOpen).toBe(true)
  })

  it('resetJourney clears the passport and returns to the menu', () => {
    const store = () => useOnboardingStore.getState()
    completeRitual('methodical')
    expect(store().passport).not.toBeNull()

    store().setTutorialDone(true)
    expect(store().tutorialDone).toBe(true)

    store().resetJourney()
    expect(store().phase).toBe('menu')
    expect(store().passport).toBeNull()
    expect(store().explorerName).toBe('')
    // A new beginning has no tutorial done and no passport card.
    expect(store().tutorialDone).toBe(false)
  })
})
