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
  introBeatForLine,
  introCameraForLine,
  introEmotionForLine,
  introHologramForLine,
  introMomentForLine,
  registrationWelcomeLine,
} from './onboardingNarrative'

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
  it('uses the five cinematic scenes in canonical order', () => {
    expect(new Set(INTRO_BEATS.map((beat) => beat.moment))).toEqual(
      new Set(['arrival', 'archive', 'fault', 'hope', 'invitation']),
    )
    expect(introMomentForLine(0)).toBe('arrival')
    expect(introMomentForLine(2)).toBe('archive')
    expect(introMomentForLine(5)).toBe('fault')
    expect(introMomentForLine(10)).toBe('hope')
    expect(introMomentForLine(INTRO_BEATS.length - 1)).toBe('invitation')

    const order = INTRO_BEATS.map((beat) => beat.moment)
    const first = Object.fromEntries(
      [...new Set(order)].map((moment) => [moment, order.indexOf(moment)]),
    )
    expect(first.arrival).toBeLessThan(first.archive)
    expect(first.archive).toBeLessThan(first.fault)
    expect(first.fault).toBeLessThan(first.hope)
    expect(first.hope).toBeLessThan(first.invitation)
  })

  it('shows the failure before PIP explains it', () => {
    const firstLoss = INTRO_BEATS.findIndex((beat) =>
      /lost its connection/i.test(beat.line),
    )
    const explanation = INTRO_BEATS.findIndex((beat) =>
      /trying to fix them/i.test(beat.line),
    )

    expect(firstLoss).toBeGreaterThan(0)
    expect(explanation).toBeGreaterThan(firstLoss)
    expect(introHologramForLine(firstLoss)).toBe('losing1')
    expect(introHologramForLine(explanation)).toBe('recovering')
  })

  it('syncs every beat with an expression, hologram and camera shot', () => {
    expect(introEmotionForLine(0)).toBe('welcome')
    expect(introEmotionForLine(3)).toBe('surprised')
    expect(introEmotionForLine(5)).toBe('worried')
    expect(introEmotionForLine(7)).toBe('worried')
    expect(introEmotionForLine(9)).toBe('thoughtful')
    expect(introEmotionForLine(11)).toBe('happy')

    expect(introHologramForLine(0)).toBe('none')
    expect(introHologramForLine(2)).toBe('stable')
    expect(introHologramForLine(3)).toBe('losing1')
    expect(introHologramForLine(4)).toBe('losing3')
    expect(introHologramForLine(5)).toBe('fragmented')
    expect(introHologramForLine(6)).toBe('recovering')
    expect(introHologramForLine(10)).toBe('locations')
    expect(introHologramForLine(12)).toBe('dossier')
    expect(introHologramForLine(13)).toBe('letter')

    expect(introCameraForLine(0)).toBe('welcome')
    expect(introCameraForLine(2)).toBe('archive')
    expect(introCameraForLine(5)).toBe('pip')
    expect(introCameraForLine(12)).toBe('invitation')
    // Reduced motion keeps one stable frontal frame.
    expect(introCameraForLine(5, true)).toBe('welcome')
    expect(introCameraForLine(12, true)).toBe('welcome')
  })

  it('is fully player-paced and ends on the invitation', () => {
    for (const beat of INTRO_BEATS) {
      expect(beat).not.toHaveProperty('autoAdvance')
    }
    expect(introBeatForLine(INTRO_BEATS.length - 1).line).toMatch(
      /will you help me bring their stories home\?/,
    )
  })

  it('pairs each line with a projection that shows what it says', () => {
    const byLine = (pattern: RegExp) =>
      introBeatForLine(INTRO_BEATS.findIndex((beat) => pattern.test(beat.line)))
    expect(byLine(/Cosmic Mail/).hologram).toBe('mail')
    expect(byLine(/my own memories are missing/).hologram).toBe('memory')
    expect(byLine(/my own memories are missing/).emotion).toBe('sad')
    expect(byLine(/I can't remember/).hologram).toBe('forgotten')
    expect(byLine(/two places/).hologram).toBe('locations')
    expect(byLine(/two places/).emotion).toBe('excited')
    expect(byLine(/fix their stories/).hologram).toBe('route')
    expect(byLine(/signals have gone quiet/).hologram).toBe('dossier')
    // Consecutive beats never repeat the same projection.
    for (let i = 1; i < INTRO_BEATS.length; i += 1) {
      expect(INTRO_BEATS[i]!.hologram).not.toBe(INTRO_BEATS[i - 1]!.hologram)
    }
  })

  it('establishes the Archive fault and PIP fragmentation', () => {
    expect(ALL_TEXT).toMatch(/Cosmic Archive/i)
    expect(ALL_TEXT).toMatch(/connection/i)
    expect(ALL_TEXT).toMatch(/pieces don't fit/i)
    expect(ALL_TEXT).toMatch(/my own memories are missing/i)
    expect(ALL_TEXT).toMatch(/I can't remember/i)
    expect(ALL_TEXT).toMatch(/two places/i)
    expect(ALL_TEXT).toMatch(/fix their stories/i)
    expect(ALL_TEXT).toMatch(/Carrier ID/i)
    expect(ALL_TEXT).toMatch(/Earth/i)
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
      'power',
      'trait',
      'personality',
      'routine check',
      'lost memory',
      'explorer spirit',
    ]) {
      expect(ALL_TEXT.toLowerCase()).not.toContain(retired)
    }
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
    // The album comes before navigation, and each one must be opened.
    const albumWait = steps.findIndex((step) => step.awaits === 'album')
    const navWait = steps.findIndex((step) => step.awaits === 'nav')
    expect(albumWait).toBeGreaterThan(0)
    expect(navWait).toBeGreaterThan(albumWait)
    expect(steps[albumWait]!.target).toBe('album')
    expect(steps[navWait]!.target).toBe('nav')
    // PIP explains every album section and the navigation screen from
    // inside, and the child has to tap each part.
    for (const awaited of ['tab-stamps', 'tab-discoveries', 'album-close', 'destination', 'confirm']) {
      expect(steps.some((step) => step.awaits === awaited)).toBe(true)
    }
    const places = steps.map((step) => step.place)
    expect(places.indexOf('album')).toBe(albumWait + 1)
    expect(places.indexOf('nav')).toBe(navWait + 1)
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
