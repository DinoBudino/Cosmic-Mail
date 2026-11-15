import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_LABELS,
  HUB_RETURNING_LINE,
  HUB_TOUR_LINES,
  INTRO_BEATS,
  LAUNCH_CABIN_LINE,
  REGISTRATION_LINE,
  ROUTE_READY_LINE,
  TRANSMISSION_DESTINATION,
  TRANSMISSION_SUCCESS_LINE,
  HUB_ASSIGNMENT_LINE,
  hubDialogueLines,
  hubDialogueSteps,
  HUB_TOUR_STEPS,
  isHubTourActive,
  INTRO_HOLOGRAM_LABELS,
  introBeatForLine,
  introCameraForLine,
  introEmotionForLine,
  introHologramForLine,
  introHologramTimeline,
  introMomentForLine,
  registrationWelcomeLine,
  type IntroBeat,
  type IntroMoment,
} from './onboardingNarrative'
import PIP_VOICE_LINES from './pipVoiceLines.json'

const ALL_TEXT = [
  ...INTRO_BEATS.map((beat) => beat.line),
  REGISTRATION_LINE,
  ...HUB_TOUR_LINES,
  HUB_RETURNING_LINE,
  ROUTE_READY_LINE,
  LAUNCH_CABIN_LINE,
  ...Object.values(ARCHIVE_LABELS),
].join(' ')

describe('Proposal A onboarding beat sheet', () => {
  const indexOf = (predicate: (beat: IntroBeat) => boolean) =>
    INTRO_BEATS.findIndex(predicate)
  const byLine = (pattern: RegExp) => {
    const index = indexOf((beat) => pattern.test(beat.line))
    expect(index, String(pattern)).toBeGreaterThanOrEqual(0)
    return INTRO_BEATS[index]!
  }

  it('uses the five cinematic scenes in canonical, contiguous order', () => {
    const order: IntroMoment[] = ['arrival', 'archive', 'fault', 'hope', 'invitation']
    const moments = INTRO_BEATS.map((beat) => beat.moment)
    // Each scene is one contiguous block, in canonical order.
    const blocks = moments.filter((moment, i) => moment !== moments[i - 1])
    expect(blocks).toEqual(order)
    expect(introMomentForLine(0)).toBe('arrival')
    expect(introMomentForLine(INTRO_BEATS.length - 1)).toBe('invitation')
  })

  it('splits the Solar Storm scene into its phases, in order', () => {
    const fault = INTRO_BEATS.filter((beat) => beat.moment === 'fault')
    const phases = fault
      .map((beat) => beat.subphase)
      .filter((phase, i, all) => phase !== all[i - 1])
    expect(phases).toEqual([
      'first-anomaly',
      'fault-spreads',
      'solar-alert',
      'storm-reveal',
      'archive-damage',
      'failed-recovery',
      'pip-affected',
    ])
  })

  it('shows the anomaly first, detects the storm next and explains it last', () => {
    const lastCalm = indexOf((beat) => /all connected/.test(beat.line))
    const firstLoss = indexOf((beat) => beat.hologram === 'losing1')
    const spread = indexOf((beat) => beat.hologram === 'losing3')
    const alert = indexOf((beat) => beat.hologram === 'solarAlert')
    const storm = indexOf((beat) => beat.hologram === 'solarStorm')
    const explanation = indexOf((beat) => /communication network/.test(beat.line))
    const damage = indexOf((beat) => /while its memories were being updated/.test(beat.line))
    const pip = indexOf((beat) => /my own memories are missing/.test(beat.line))

    expect(introHologramForLine(lastCalm)).toBe('stable')
    expect([lastCalm, firstLoss, spread, alert, storm, explanation, damage, pip]).toEqual(
      [...[lastCalm, firstLoss, spread, alert, storm, explanation, damage, pip]].sort((a, b) => a - b),
    )
    // Nothing names the storm before Mailwing detects it.
    for (const beat of INTRO_BEATS.slice(0, alert)) {
      expect(beat.line).not.toMatch(/solar|storm|Sun/i)
    }
    expect(introBeatForLine(alert).line).toMatch(/detected something unusual/)
    expect(introBeatForLine(storm).line).toMatch(/solar storm/)
  })

  it('keeps the original fault states and adds the solar ones in between', () => {
    const states = INTRO_BEATS.map((beat) => beat.hologram)
    const at = (state: string) => states.indexOf(state as never)
    for (const state of [
      'mail', 'stable', 'losing1', 'losing3', 'solarAlert', 'solarStorm', 'stormImpact',
      'fragmented', 'recovering', 'offline', 'memory', 'forgotten',
      'locations', 'route', 'dossier', 'letter',
    ]) {
      expect(at(state), state).toBeGreaterThanOrEqual(0)
    }
    expect(at('fragmented')).toBeLessThan(at('recovering'))
    expect(at('recovering')).toBeLessThan(at('offline'))
    expect(at('offline')).toBeLessThan(at('memory'))
    // The solar projection never leaks outside the Solar Storm scene.
    for (const beat of INTRO_BEATS) {
      if (['solarAlert', 'solarStorm', 'stormImpact', 'syncError'].includes(beat.hologram)) {
        expect(beat.moment).toBe('fault')
      }
    }
  })

  it('syncs every beat with an expression, hologram, camera shot and mood', () => {
    expect(introEmotionForLine(0)).toBe('welcome')
    expect(byLine(/lost its connection/).emotion).toBe('surprised')
    expect(byLine(/going dark/).emotion).toBe('worried')
    expect(byLine(/detected something unusual/).emotion).toBe('focused')
    expect(byLine(/communication network/).emotion).toBe('explaining')
    expect(byLine(/my own memories are missing/).emotion).toBe('sad')
    expect(byLine(/two places/).emotion).toBe('excited')
    expect(byLine(/will you help me/).emotion).toBe('hopeful')

    expect(introHologramForLine(0)).toBe('none')
    expect(introCameraForLine(0)).toBe('welcome')
    expect(byLine(/Cosmic Archive/).camera).toBe('archive')
    expect(byLine(/my own memories are missing/).camera).toBe('pip')
    expect(byLine(/will you help me/).camera).toBe('invitation')
    // The storm sub-variation only frames the solar projection.
    for (const beat of INTRO_BEATS) {
      if (beat.camera === 'storm') expect(beat.subphase).toMatch(/solar-alert|storm-reveal|archive-damage/)
    }
    // Reduced motion keeps one stable frontal frame.
    INTRO_BEATS.forEach((_, i) => expect(introCameraForLine(i, true)).toBe('welcome'))

    // Emergency light: none at first, grows with the storm, gone with hope.
    expect(introBeatForLine(0).ambience).toBe('calm')
    expect(byLine(/solar storm/).ambience).toBe('storm')
    expect(byLine(/my own memories are missing/).ambience).toBe('soft')
    for (const beat of INTRO_BEATS) {
      if (beat.moment === 'hope' || beat.moment === 'invitation') {
        expect(beat.ambience).toBe('hope')
      }
    }
  })

  it('animates holograms toward a settled frame that Replay can restart', () => {
    for (const [i, beat] of INTRO_BEATS.entries()) {
      const timeline = introHologramTimeline(i)
      expect(timeline.length).toBeGreaterThan(0)
      expect(timeline[0]!.at).toBe(0)
      for (let k = 1; k < timeline.length; k += 1) {
        expect(timeline[k]!.at).toBeGreaterThan(timeline[k - 1]!.at)
      }
      // The settled frame is the beat's own state.
      expect(timeline[timeline.length - 1]!.state).toBe(beat.hologram)
      // Reduced motion: only the settled frame, shown at once.
      const reduced = introHologramTimeline(i, true)
      expect(reduced).toHaveLength(1)
      expect(reduced[0]).toEqual({ ...timeline[timeline.length - 1], at: 0 })
    }
    // Replaying the first disconnection starts from the connected node.
    const firstLoss = introHologramTimeline(indexOf((beat) => beat.hologram === 'losing1'))
    expect(firstLoss.length).toBeGreaterThanOrEqual(3)
    expect(firstLoss[0]!.variant).not.toBe(firstLoss[firstLoss.length - 1]!.variant)
    // The last calm line hides a single, discreet blink of one link.
    const calm = introHologramTimeline(indexOf((beat) => /all connected/.test(beat.line)))
    expect(calm[0]!.variant).toBe(calm[calm.length - 1]!.variant)
    expect(new Set(calm.map((frame) => frame.variant)).size).toBe(2)
  })

  it('is fully player-paced and ends on the invitation', () => {
    for (const beat of INTRO_BEATS) {
      expect(beat).not.toHaveProperty('autoAdvance')
    }
    expect(introBeatForLine(INTRO_BEATS.length - 1).line).toBe('So... will you help me?')
  })

  it('pairs each line with a projection that shows what it says', () => {
    expect(byLine(/Cosmic Mail/).hologram).toBe('mail')
    expect(byLine(/file in the Cosmic Archive/).hologram).toBe('stable')
    expect(byLine(/solar storm/).hologram).toBe('solarStorm')
    expect(byLine(/communication network/).hologram).toBe('stormImpact')
    expect(byLine(/memories were being updated/).hologram).toBe('syncError')
    expect(byLine(/stories are incomplete/).hologram).toBe('fragmented')
    expect(byLine(/trying to fix them/).hologram).toBe('recovering')
    expect(byLine(/pieces don't fit/).hologram).toBe('offline')
    expect(byLine(/my own memories are missing/).hologram).toBe('memory')
    expect(byLine(/I can't remember/).hologram).toBe('forgotten')
    expect(byLine(/two places/).hologram).toBe('locations')
    expect(byLine(/recover their missing stories/).hologram).toBe('route')
    expect(byLine(/waiting to be remembered/).hologram).toBe('dossier')
    expect(byLine(/rebuild their memories/).hologram).toBe('letter')
    // Consecutive beats never settle on the same picture.
    for (let i = 1; i < INTRO_BEATS.length; i += 1) {
      const a = introHologramTimeline(i - 1).at(-1)!
      const b = introHologramTimeline(i).at(-1)!
      expect(`${b.state}:${b.variant}`).not.toBe(`${a.state}:${a.variant}`)
    }
  })

  it('shows PIP checking himself only when his own memories fail', () => {
    const glitches = INTRO_BEATS.filter((beat) => beat.pipGlitch)
    expect(glitches).toHaveLength(1)
    expect(glitches[0]!.line).toMatch(/my own memories are missing/)
    for (const beat of INTRO_BEATS) {
      if (beat.pipPanel === 'memoryCheck') expect(beat.subphase).toBe('pip-affected')
      if (beat.pipPanel === 'diagnostic') expect(beat.subphase).toBe('solar-alert')
    }
    expect(byLine(/detected something unusual/).pipPanel).toBe('diagnostic')
  })

  it('leaves the cue changes to AudioDirector so no sound fires twice', () => {
    for (const beat of INTRO_BEATS) {
      expect(beat.sound).not.toBe('archiveFaultStarted')
      expect(beat.sound).not.toBe('archiveClueRecovered')
      expect(beat.sound).not.toBe('introStarted')
    }
    expect(byLine(/lost its connection/).sound).toBeUndefined()
    expect(byLine(/two places/).sound).toBeUndefined()
    expect(byLine(/detected something unusual/).sound).toBe('solarAlert')
  })

  it('records every intro line with its own key', () => {
    const ids = INTRO_BEATS.map((beat) => beat.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const beat of INTRO_BEATS) {
      const recording = PIP_VOICE_LINES.find((line) => line.key === beat.id)
      expect(recording?.text, beat.id).toBe(beat.line)
    }
  })

  it('establishes the storm, the damaged Archive and PIP fragmentation', () => {
    expect(ALL_TEXT).toMatch(/Cosmic Archive/i)
    expect(ALL_TEXT).toMatch(/lost its connection/i)
    expect(ALL_TEXT).toMatch(/solar storm/i)
    expect(ALL_TEXT).toMatch(/energy and particles/i)
    expect(ALL_TEXT).toMatch(/communication network/i)
    expect(ALL_TEXT).toMatch(/stories are incomplete/i)
    expect(ALL_TEXT).toMatch(/pieces don't fit/i)
    expect(ALL_TEXT).toMatch(/my own memories are missing/i)
    expect(ALL_TEXT).toMatch(/I can't remember/i)
    expect(ALL_TEXT).toMatch(/two places/i)
    expect(ALL_TEXT).toMatch(/recover their missing stories/i)
    expect(ALL_TEXT).toMatch(/Carrier ID/i)
    expect(ALL_TEXT).toMatch(/Earth/i)
  })

  it('never claims the Archive was wiped out completely', () => {
    expect(ALL_TEXT).not.toMatch(/none of the files|all .* destroyed|everything is gone/i)
    expect(INTRO_HOLOGRAM_LABELS.offline).toMatch(/backup signals/i)
    expect(INTRO_HOLOGRAM_LABELS.solarStorm).toMatch(/recorded/i)
  })

  it('does not reveal Surveyor 3, Opportunity, Spirit or Pioneer 10 before discovery', () => {
    expect(ALL_TEXT).not.toMatch(/Surveyor|Opportunity|Spirit|Pioneer/i)
  })

  it('contains no retired B or hero/power narrative language', () => {
    for (const retired of [
      'find their way home',
      'found their way home',
      'unfinished stories',
      'hero',
      'trait',
      'personality',
      'routine check',
      'lost memory',
      'explorer spirit',
    ]) {
      expect(ALL_TEXT.toLowerCase()).not.toContain(retired)
    }
    // "Power" as a hero ability is retired; a "powerful solar storm" is science.
    expect(ALL_TEXT).not.toMatch(/\b(super)?powers?\b/i)
  })

  it('defines the Earth Archive transmission labels', () => {
    expect(TRANSMISSION_DESTINATION).toBe('Earth Cosmic Archive')
    expect(TRANSMISSION_SUCCESS_LINE).toContain('ENTREGA COMPLETADA')
    expect(TRANSMISSION_SUCCESS_LINE).toContain('HISTORIA RESTAURADA')
  })

  it('connects accepting the mission with registration', () => {
    expect(REGISTRATION_LINE).toMatch(/Carrier ID/)
    expect(HUB_ASSIGNMENT_LINE).toContain('mission album')
    expect(ALL_TEXT).not.toMatch(/passport/i)
  })

  it('does not greet a first-time carrier as if they had returned', () => {
    const firstVisit = hubDialogueLines({
      routeConfirmed: false,
      hubVisited: false,
      hubTourDone: false,
    })
    expect(firstVisit[0]).toBe(HUB_ASSIGNMENT_LINE)
    expect(firstVisit.join(' ')).not.toContain('Welcome back')
    expect(firstVisit).toHaveLength(HUB_TOUR_STEPS.length)

    expect(
      hubDialogueLines({
        routeConfirmed: false,
        hubVisited: false,
        hubTourDone: true,
      }),
    ).toEqual([])

    expect(
      hubDialogueLines({
        routeConfirmed: false,
        hubVisited: true,
        hubTourDone: true,
      }),
    ).toEqual([HUB_RETURNING_LINE])
  })

  it('guides the child through the album and the navigation screen', () => {
    const first = { routeConfirmed: false, hubVisited: false, hubTourDone: false }
    const steps = hubDialogueSteps(first)
    expect(isHubTourActive(first)).toBe(true)
    // PIP points at the album, then at the navigation screen, and opens
    // each one himself on the next line.
    const albumIntro = steps.findIndex((step) => step.target === 'album')
    const navIntro = steps.findIndex((step) => step.target === 'nav')
    expect(albumIntro).toBeGreaterThan(0)
    expect(navIntro).toBeGreaterThan(albumIntro)
    const places = steps.map((step) => step.place)
    expect(places.indexOf('album')).toBe(albumIntro + 1)
    expect(places.indexOf('nav')).toBe(navIntro + 1)
    // He turns the album pages himself: missions, discoveries, stamps.
    const tabs = steps.filter((step) => step.place === 'album').map((step) => step.albumTab)
    expect([...new Set(tabs)]).toEqual(['missions', 'discoveries', 'stamps'])
    // The child is never asked to tap to follow the tour: only real
    // choices (where to fly, confirming the route) wait for the child.
    expect(steps.map((step) => step.awaits).filter(Boolean)).toEqual(['destination', 'confirm'])
    for (const step of steps.filter((entry) => !entry.awaits)) {
      expect(step.line, step.line).not.toMatch(/\b(tap|click|press)\b/i)
    }
    // The tour ends on confirming the route, which hands over to the red button.
    expect(steps[steps.length - 1]!.awaits).toBe('confirm')
    // Navigation is never described as a single destination.
    expect(steps.map((step) => step.line).join(' ')).not.toMatch(/Mars|Moon|closest/)

    const ready = hubDialogueSteps({ ...first, routeConfirmed: true })
    expect(ready).toEqual([
      { line: ROUTE_READY_LINE, target: 'button', awaits: null, place: 'cabin' },
    ])
    expect(isHubTourActive({ ...first, routeConfirmed: true })).toBe(false)
    expect(isHubTourActive({ ...first, hubTourDone: true })).toBe(false)
  })

  it('personalizes the registration welcome line safely', () => {
    expect(registrationWelcomeLine('Ada')).toContain('Ada')
    expect(registrationWelcomeLine('Ada')).toContain(
      'officially part of Cosmic Mail',
    )
  })
})
