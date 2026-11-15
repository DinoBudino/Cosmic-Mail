import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useOnboardingStore } from '../../store/onboardingStore'
import { Intro } from './Intro'

describe('cinematic Intro component', () => {
  afterEach(() => {
    useOnboardingStore.getState().resetPresentation()
  })

  it('starts on the welcome beat with Replay, Skip and Continue controls', () => {
    useOnboardingStore.setState({ phase: 'intro', boardingStage: 'cabin', dialogueIndex: 0 })
    const html = renderToStaticMarkup(<Intro />)

    expect(html).toContain('this is Mailwing')
    expect(html).toContain('Replay')
    expect(html).toContain('Skip intro')
    expect(html).toContain('Continue')
    expect(html).toContain('Welcome aboard')
  })

  it('renders every control as an accessible button', () => {
    useOnboardingStore.setState({ phase: 'intro', boardingStage: 'cabin', dialogueIndex: 0 })
    const html = renderToStaticMarkup(<Intro />)
    const buttons = html.match(/<button/g) ?? []
    expect(buttons.length).toBeGreaterThanOrEqual(4)
    expect(html).toContain('aria-label="Replay this line"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('role="progressbar"')
  })
})
