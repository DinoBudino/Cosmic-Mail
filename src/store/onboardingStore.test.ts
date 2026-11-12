import { beforeEach, describe, expect, it } from 'vitest'
import { useJourneyStore } from './journeyStore'
import { useOnboardingStore } from './onboardingStore'

function resetStores() {
  useOnboardingStore.getState().resetPresentation()
  useJourneyStore.setState({
    save: null,
    loadStatus: 'empty',
    persisted: false,
  })
}

function prepareJourney() {
  useJourneyStore.getState().startJourney('Ada')
}

describe('new onboarding flow', () => {
  beforeEach(resetStores)

  it('exposes only the new presentation fields', () => {
    const state = useOnboardingStore.getState()
    for (const retired of [
      'passport',
      'answers',
      'questionIndex',
      'trait',
      'explorerId',
      'tutorialDone',
      'routineFocus',
      'explorerPreviewId',
      'signing',
      'selectedZoneId',
      'collectMemory',
      'switchHero',
      'answerQuestion',
      'continueFromReveal',
      'confirmExplorer',
    ]) {
      expect(state).not.toHaveProperty(retired)
    }
  })

  it('starts a new journey with the intro and a clean presentation state', () => {
    const onboarding = useOnboardingStore.getState()
    onboarding.startNewJourney()

    const state = useOnboardingStore.getState()
    expect(state.phase).toBe('intro')
    expect(state.boardingStage).toBe('approach')
    expect(state.selectedDestination).toBeNull()
    expect(state.routeConfirmed).toBe(false)
    expect(state.hubVisited).toBe(false)
    expect(state.dialogueIndex).toBe(0)
  })

  it('moves intro -> registration -> hub without personality steps', () => {
    const onboarding = useOnboardingStore.getState()
    onboarding.startNewJourney()
    onboarding.finishIntro()
    expect(useOnboardingStore.getState().phase).toBe('registration')

    useOnboardingStore.getState().completeRegistration()
    const hub = useOnboardingStore.getState()
    expect(hub.phase).toBe('hub')
    expect(hub.hubVisited).toBe(false)
    expect(hub.dialogueIndex).toBe(0)
  })

  it('continues a saved journey directly at the hub', () => {
    prepareJourney()
    useOnboardingStore.getState().continueJourney()
    const state = useOnboardingStore.getState()
    expect(state.phase).toBe('hub')
    expect(state.hubVisited).toBe(true)
    expect(state.boardingStage).toBe('approach')
  })

  it('refuses Continue when there is no save', () => {
    useOnboardingStore.setState({ phase: 'menu' })
    useOnboardingStore.getState().continueJourney()
    expect(useOnboardingStore.getState().phase).toBe('menu')
  })

  it('returns to Mailwing from a mission without losing progress', () => {
    prepareJourney()
    useOnboardingStore.setState({ phase: 'playing' })
    useJourneyStore.getState().scan('spirit', 'spirit-pancam')

    useOnboardingStore.getState().returnToShip()
    const state = useOnboardingStore.getState()
    expect(state.phase).toBe('hub')
    expect(state.boardingStage).toBe('cabin')
    expect(state.hubVisited).toBe(true)
    expect(
      useJourneyStore.getState().save?.missions.spirit.scannedComponentIds,
    ).toEqual(['spirit-pancam'])
  })

  it('only selects the implemented Mars destination', () => {
    useOnboardingStore.setState({ phase: 'hub' })
    const onboarding = useOnboardingStore.getState()

    onboarding.selectDestination('moon')
    expect(useOnboardingStore.getState().selectedDestination).toBeNull()
    onboarding.selectDestination('deep-space')
    expect(useOnboardingStore.getState().selectedDestination).toBeNull()

    onboarding.selectDestination('mars')
    expect(useOnboardingStore.getState().selectedDestination).toBe('mars')
    expect(useOnboardingStore.getState().routeConfirmed).toBe(false)
  })

  it('persists the confirmed destination in JourneySave', () => {
    prepareJourney()
    useOnboardingStore.setState({ phase: 'hub' })
    const onboarding = useOnboardingStore.getState()
    onboarding.selectDestination('mars')
    onboarding.confirmRoute()

    expect(useOnboardingStore.getState().routeConfirmed).toBe(true)
    expect(useOnboardingStore.getState().routeOpen).toBe(false)
    expect(useJourneyStore.getState().save?.currentDestination).toBe('mars')
  })

  it('launches only a confirmed route and enters the world once', () => {
    prepareJourney()
    useOnboardingStore.setState({ phase: 'hub' })
    const onboarding = useOnboardingStore.getState()

    onboarding.takeOff()
    expect(useOnboardingStore.getState().phase).toBe('hub')

    onboarding.selectDestination('mars')
    onboarding.confirmRoute()
    onboarding.takeOff()
    expect(useOnboardingStore.getState().phase).toBe('launching')
    expect(useJourneyStore.getState().save?.onboardingComplete).toBe(true)

    useOnboardingStore.getState().finishLaunch()
    expect(useOnboardingStore.getState().phase).toBe('playing')
    useOnboardingStore.getState().finishLaunch()
    expect(useOnboardingStore.getState().phase).toBe('playing')
  })

  it('keeps route open only in the hub', () => {
    useOnboardingStore.setState({ phase: 'menu' })
    useOnboardingStore.getState().setRouteOpen(true)
    expect(useOnboardingStore.getState().routeOpen).toBe(false)

    useOnboardingStore.setState({ phase: 'hub' })
    useOnboardingStore.getState().setRouteOpen(true)
    expect(useOnboardingStore.getState().routeOpen).toBe(true)
  })

  it('goes back through the explicit presentation transitions', () => {
    useOnboardingStore.getState().startNewJourney()
    useOnboardingStore.getState().goBack()
    expect(useOnboardingStore.getState().phase).toBe('menu')

    useOnboardingStore.getState().startNewJourney()
    useOnboardingStore.getState().finishIntro()
    useOnboardingStore.getState().goBack()
    expect(useOnboardingStore.getState().phase).toBe('intro')

    useOnboardingStore.setState({ phase: 'hub' })
    useOnboardingStore.getState().goBack()
    expect(useOnboardingStore.getState().phase).toBe('menu')
  })

  it('finishes the first hub tour without pretending the carrier returned', () => {
    useOnboardingStore.setState({
      phase: 'hub',
      hubVisited: false,
      hubTourDone: false,
    })
    useOnboardingStore.getState().markHubVisited()
    expect(useOnboardingStore.getState().hubTourDone).toBe(true)
    expect(useOnboardingStore.getState().hubVisited).toBe(false)
  })
})
