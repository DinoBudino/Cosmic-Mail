import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createJourney } from '../../store/journeySchema'
import { DestinationNavigation } from './DestinationNavigation'

describe('cabin navigation', () => {
  it('keeps the three destinations visible without revealing identities', () => {
    const save = createJourney('Ada', 1000)
    const html = renderToStaticMarkup(
      <DestinationNavigation saveOverride={save} />,
    )

    expect(html).toContain('Mars')
    expect(html).toContain('Moon')
    expect(html).toContain('Deep Space')
    expect(html).toContain('Signal awaiting identification')
    expect(html).toContain('Mission in development')
    expect(html).not.toMatch(/Surveyor|Spirit|Pioneer/i)
  })

  it('marks only Mars as a selectable destination', () => {
    const save = createJourney('Ada', 1000)
    const html = renderToStaticMarkup(
      <DestinationNavigation saveOverride={save} />,
    )
    const disabled = html.match(/disabled=""/g) ?? []
    expect(disabled).toHaveLength(2)
    expect(html).toContain('aria-label="Mars: signal awaiting identification"')
  })
})
