import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getMission } from '../data/missions'
import { useJourneyStore } from '../store/journeyStore'
import { createJourney } from '../store/journeySchema'
import { markMissionDiscovered, scanComponent } from '../store/journeyLogic'
import { FullScanDialog } from './FullScanDialog'

const mission = getMission('spirit')

function saveWithScans(count: number) {
  let save = markMissionDiscovered(createJourney('Ada'), 'spirit')
  for (const component of mission.components.slice(0, count)) {
    save = scanComponent(save, 'spirit', component.id).save
  }
  return save
}

function render() {
  // Zustand reads getInitialState() during server rendering; point it at the
  // live state (it is mutated in place) so the test sees the save it just set.
  Object.assign(useJourneyStore.getInitialState(), useJourneyStore.getState())
  return renderToStaticMarkup(
    <FullScanDialog mission={mission} onClose={() => {}} />,
  )
}

describe('FullScanDialog render', () => {
  beforeEach(() => {
    useJourneyStore.setState({ save: saveWithScans(3) })
  })

  it('shows both steps with enabled controls once 3/3 is recognized', () => {
    const html = render()
    expect(html).toContain('1 · Sweep the explorer')
    expect(html).toContain('2 · Rebuild the memory core')
    expect(html.indexOf('1 · Sweep')).toBeLessThan(
      html.indexOf('2 · Rebuild'),
    )
    // Four traces, all enabled (no disabled attribute on trace buttons).
    const traces = html.match(/<button[^>]*recon-trace[^>]*>/g) ?? []
    expect(traces).toHaveLength(4)
    for (const trace of traces) expect(trace).not.toContain('disabled')
    // Four timeline slots exist; they open once a fragment is selected.
    expect(html.match(/class="recon-slot[" ]/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(html).toContain('Return to exploring')
  })

  it('shows step 1 active with progress, and step 2 visibly locked', () => {
    const html = render()
    expect(html).toContain('aria-label="Scan steps"')
    expect(html).toContain('aria-label="Sweep progress"')
    expect(html).toContain('aria-valuenow="0"')
    expect(html).toContain('0/4 traces')
    expect(html).toContain('Locked until all four traces are revealed.')
    expect(html).toMatch(/class="recon is-locked"/)
    // Locked step: its slots cannot be activated yet.
    const slots = html.match(/<button[^>]*class="recon-slot[^>]*>/g) ?? []
    expect(slots).toHaveLength(4)
    for (const slot of slots) expect(slot).toContain('disabled')
    // The first trace is the first control, so initial focus lands on it.
    expect(html.indexOf('recon-trace')).toBeLessThan(html.indexOf('recon-slot'))
  })

  it('stays locked (and says why) below 3/3', () => {
    useJourneyStore.setState({ save: saveWithScans(2) })
    const html = render()
    expect(html).toContain('still locked')
    expect(html).not.toContain('recon-trace')
  })
})

describe('reconstruction styles', () => {
  it('never paints cream text on the cream letter paper', () => {
    const css = readFileSync('src/App.css', 'utf8')
    const start = css.indexOf('Full scan reconstruction')
    const end = css.indexOf('Postal delivery (Mailwing)')
    const block = css.slice(start, end)
    expect(block.length).toBeGreaterThan(500)
    expect(block).not.toContain('var(--cream')
    expect(block).not.toContain('#ffd9a8')
  })
})
