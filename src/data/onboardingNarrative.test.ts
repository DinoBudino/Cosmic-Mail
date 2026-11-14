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
  estimatePipLineMs,
  HUB_ASSIGNMENT_LINE,
  hubDialogueLines,
  introAutoAdvanceForMode,
  introAutoAdvanceMs,
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
      /trying to reconnect/i.test(beat.line),
    )

    expect(firstLoss).toBeGreaterThan(0)
    expect(explanation).toBeGreaterThan(firstLoss)
    expect(introHologramForLine(firstLoss)).toBe('losing1')
    expect(introHologramForLine(explanation)).toBe('recovering')
  })

  it('syncs every beat with an expression, hologram and camera shot', () => {
    expect(introEmotionForLine(0)).toBe('welcome')
    expect(introEmotionForLine(3)).toBe('surprised')
    expect(introEmotionForLine(5)).toBe('confused')
    expect(introEmotionForLine(7)).toBe('worried')
    expect(introEmotionForLine(9)).toBe('thoughtful')
    expect(introEmotionForLine(11)).toBe('happy')

    expect(introHologramForLine(0)).toBe('none')
    expect(introHologramForLine(2)).toBe('stable')
    expect(introHologramForLine(3)).toBe('losing1')
    expect(introHologramForLine(4)).toBe('losing3')
    expect(introHologramForLine(5)).toBe('fragmented')
    expect(introHologramForLine(6)).toBe('recovering')
    expect(introHologramForLine(10)).toBe('hint')
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

  it('auto-advances reactions but waits for the final invitation', () => {
    expect(introAutoAdvanceMs(0)).toBeGreaterThan(estimatePipLineMs(introBeatForLine(0).line))
    expect(introAutoAdvanceMs(INTRO_BEATS.length - 1)).toBeNull()
    expect(introAutoAdvanceForMode(0, true)).toBeNull()
    expect(introAutoAdvanceForMode(0, false)).toBeGreaterThan(0)
    expect(INTRO_BEATS.every((beat) => typeof beat.autoAdvance === 'boolean')).toBe(
      true,
    )
    expect(introBeatForLine(INTRO_BEATS.length - 1).line).toMatch(
      /Will you help me bring their stories back\?/,
    )
  })

  it('establishes the Archive fault and PIP fragmentation', () => {
    expect(ALL_TEXT).toMatch(/Cosmic Archive/i)
    expect(ALL_TEXT).toMatch(/connection/i)
    expect(ALL_TEXT).toMatch(/pieces don’t match/i)
    expect(ALL_TEXT).toMatch(/my own records are missing/i)
    expect(ALL_TEXT).toMatch(/I can’t remember/i)
    expect(ALL_TEXT).toMatch(/old locations/i)
    expect(ALL_TEXT).toMatch(/put their stories back together/i)
    expect(ALL_TEXT).toMatch(/smart letter|Cosmic Mail Carrier/i)
    expect(ALL_TEXT).toMatch(/Earth/i)
  })

  it('does not reveal Surveyor 3, Spirit or Pioneer 10 before discovery', () => {
    expect(ALL_TEXT).not.toMatch(/Surveyor|Spirit|Pioneer/i)
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
    expect(REGISTRATION_LINE).toBe(
      "Then let's make it official! Every Cosmic Mail Carrier needs a name.",
    )
    expect(HUB_ASSIGNMENT_LINE).toContain('passport')
  })

  it('does not greet a first-time carrier as if they had returned', () => {
    const firstVisit = hubDialogueLines({
      routeConfirmed: false,
      hubVisited: false,
      hubTourDone: false,
    })
    expect(firstVisit[0]).toBe(HUB_ASSIGNMENT_LINE)
    expect(firstVisit.join(' ')).not.toContain('Welcome back')
    expect(firstVisit).toHaveLength(5)

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

  it('personalizes the registration welcome line safely', () => {
    expect(registrationWelcomeLine('Ada')).toContain('Ada')
    expect(registrationWelcomeLine('Ada')).toContain(
      'officially part of Cosmic Mail',
    )
  })
})
