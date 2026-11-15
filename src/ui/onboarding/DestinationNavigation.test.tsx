import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createJourney } from '../../store/journeySchema'
import { DestinationNavigation } from './DestinationNavigation'

describe('cabin navigation', () => {
  it('keeps both destinations visible without revealing identities', () => {
    const save = createJourney('Ada', 1000)
    const html = renderToStaticMarkup(
      <DestinationNavigation saveOverride={save} />,
    )

    expect(html).toContain('Mars')
    expect(html).toContain('Moon')
    expect(html).toContain('Signal awaiting identification')
    expect(html).not.toMatch(/Surveyor|Spirit|Pioneer/i)
  })

  it('marks both the Moon and Mars as selectable destinations', () => {
    const save = createJourney('Ada', 1000)
    const html = renderToStaticMarkup(
      <DestinationNavigation saveOverride={save} />,
    )
    const disabled = html.match(/disabled=""/g) ?? []
    expect(disabled).toHaveLength(0)
    expect(html).toContain('aria-label="Mars: signal awaiting identification"')
    expect(html).toContain('aria-label="Moon: signal awaiting identification"')
  })
})
