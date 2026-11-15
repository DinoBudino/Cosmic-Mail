import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ACTIVE_MISSION_IDS,
  DESTINATION_IDS,
  MISSIONS,
  MISSION_IDS,
  findComponent,
  findMission,
  getMission,
  getMissionForDestination,
  isDestinationId,
  isMissionId,
} from './missions'

function isNasaUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('nasa.gov')
  } catch {
    return false
  }
}

describe('mission catalog', () => {
  it('defines the explorers: Surveyor 3 and Eagle on the Moon, Opportunity, Spirit and Viking 1 on Mars', () => {
    expect(MISSIONS).toHaveLength(6)
    expect(new Set(MISSIONS.map((mission) => mission.id))).toEqual(new Set(MISSION_IDS))
    expect(ACTIVE_MISSION_IDS).toEqual(['surveyor-3', 'apollo-11', 'opportunity', 'spirit', 'viking-1'])
    expect(new Set(MISSIONS.map((mission) => mission.destination)).size).toBe(
      DESTINATION_IDS.length,
    )
    for (const destination of DESTINATION_IDS) {
      expect(getMissionForDestination(destination).destination).toBe(destination)
    }
  })

  it('assigns the approved machines to Moon, Mars and Deep Space', () => {
    expect(getMissionForDestination('moon').machineName).toBe('Surveyor 3')
    expect(getMissionForDestination('mars').machineName).toBe('Opportunity')
    expect(getMissionForDestination('deep-space').machineName).toBe('Pioneer 10')
    expect(getMissionForDestination('deep-space').worldMode).toBe('hologram')
    expect(getMissionForDestination('moon').worldMode).toBe('surface')
    expect(getMissionForDestination('mars').worldMode).toBe('surface')
  })

  it('has exactly three components per mission and unique identifiers', () => {
    const missionIds = new Set<string>()
    const componentIds = new Set<string>()
    const stampIds = new Set<string>()

    for (const mission of MISSIONS) {
      expect(mission.components).toHaveLength(3)
      expect(missionIds.has(mission.id)).toBe(false)
      missionIds.add(mission.id)
      expect(stampIds.has(mission.stampId)).toBe(false)
      stampIds.add(mission.stampId)

      for (const component of mission.components) {
        expect(componentIds.has(component.id)).toBe(false)
        componentIds.add(component.id)
      }
    }

    expect(componentIds.size).toBe(18)
  })

  it('keeps the historical record, sources and PIP narrative separate', () => {
    for (const mission of MISSIONS) {
      expect(mission.summary.length).toBeGreaterThan(0)
      expect(mission.pipBriefing.length).toBeGreaterThan(0)
      expect(mission.summary).not.toBe(mission.pipBriefing)

      for (const component of mission.components) {
        expect(component.shortName.length).toBeGreaterThan(0)
        expect(component.historicalRecord.length).toBeGreaterThan(0)
        expect(component.pipLine.length).toBeGreaterThan(0)
        expect(component.historicalRecord).not.toBe(component.pipLine)
        expect(component.scanHint.length).toBeGreaterThan(0)
        expect(component.sources.length).toBeGreaterThan(0)
        expect(component.sources.every((source) => isNasaUrl(source.url))).toBe(
          true,
        )
        if (component.hotspot) {
          expect(component.hotspot.x).toBeGreaterThanOrEqual(0)
          expect(component.hotspot.x).toBeLessThanOrEqual(100)
          expect(component.hotspot.y).toBeGreaterThanOrEqual(0)
          expect(component.hotspot.y).toBeLessThanOrEqual(100)
        }
      }

      expect(mission.sources.length).toBeGreaterThan(0)
      expect(mission.sources.every((source) => isNasaUrl(source.url))).toBe(
        true,
      )
    }
  })

  it('provides a spatial hotspot for every Mars (Opportunity) component', () => {
    const mars = getMission('opportunity')
    expect(mars.components.every((component) => component.hotspot)).toBe(
      true,
    )
    expect(
      new Set(
        mars.components.map(
          (component) =>
            `${component.hotspot?.x}:${component.hotspot?.y}`,
        ),
      ).size,
    ).toBe(3)
  })

  it('includes the Pioneer 10 plaque as educational content', () => {
    const pioneer = getMission('pioneer-10')
    const plaque = pioneer.components.find((component) =>
      component.name.toLowerCase().includes('plaque'),
    )
    expect(plaque).toBeDefined()
    expect(plaque?.historicalRecord.toLowerCase()).toContain('pulsar')
    expect(pioneer.sources.some((source) => source.url.includes('pioneer-plaque'))).toBe(
      true,
    )
  })

  it('marks the Pioneer 10 final component selection as pending review', () => {
    const pioneer = getMission('pioneer-10')
    expect(pioneer.contentStatus).toBe('pending-review')
    expect(pioneer.reviewNote).toBeTruthy()
    expect(getMission('surveyor-3').contentStatus).toBe('source-checked')
    expect(getMission('opportunity').contentStatus).toBe('source-checked')
    expect(
      MISSIONS.flatMap((mission) => mission.components).every(
        (component) => component.validation === 'source-checked',
      ),
    ).toBe(true)
  })

  it('covers the four canonical story dimensions for every mission', () => {
    for (const mission of MISSIONS) {
      for (const dimension of [
        mission.smartLetter.identity,
        mission.smartLetter.trajectory,
        mission.smartLetter.discoveries,
        mission.smartLetter.missionEnd,
      ]) {
        expect(dimension.length).toBeGreaterThan(40)
      }
      const { status, video } = mission.reconstruction
      expect(status).toBe(video ? 'video' : 'script-draft')
      if (video) {
        expect(existsSync(new URL(`../../public/${video}`, import.meta.url))).toBe(true)
        // Every story also ships as H.264 MP4, so Safari / iPhone can play it.
        const mp4 = video.replace(/\.webm$/, '.mp4')
        expect(existsSync(new URL(`../../public/${mp4}`, import.meta.url))).toBe(true)
      }
      expect(mission.reconstruction.lines.length).toBeGreaterThanOrEqual(4)
      expect(mission.reconstruction.title.toLowerCase()).toContain(
        'reconstruction',
      )
    }
    expect(getMission('opportunity').reconstruction.video).toBe('video/opportunity-720p.webm')
    expect(getMission('spirit').reconstruction.video).toBe('video/spirit-720p.webm')
    expect(getMission('opportunity').completionStory).toContain('never be forgotten')
  })

  it('keeps the Mars narrative reusable and free of invented claims', () => {
    const mars = getMission('opportunity')
    const narrative = mars.narrative
    expect(narrative).toBeDefined()
    expect(narrative!.entered.length).toBeGreaterThan(0)
    expect(narrative!.detected.length).toBeGreaterThan(0)
    expect(narrative!.approached.length).toBeGreaterThan(0)
    expect(narrative!.approachedTouch.length).toBeGreaterThan(0)
    expect(narrative!.completed.length).toBeGreaterThan(0)
    expect(narrative!.memoryRecovered.length).toBeGreaterThan(0)
    expect(narrative!.letterPrepared.length).toBeGreaterThan(0)
    expect(narrative!.genericHint.length).toBeGreaterThan(0)
    expect(narrative!.revisitInProgress.length).toBeGreaterThan(0)
    expect(narrative!.revisitLetterReady.length).toBeGreaterThan(0)
    expect(narrative!.revisitTransmitted.length).toBeGreaterThan(0)
    for (const component of mars.components) {
      expect(component.pipHint?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('does not describe repair, reactivation or rescue of the machines', () => {
    const forbidden = /repair|reactivat|reviv|rescue/i
    for (const mission of MISSIONS) {
      expect(mission.summary).not.toMatch(forbidden)
      expect(mission.pipBriefing).not.toMatch(forbidden)
      expect(mission.completionStory).not.toMatch(forbidden)
      expect(mission.smartLetter.identity).not.toMatch(forbidden)
      expect(mission.smartLetter.trajectory).not.toMatch(forbidden)
      expect(mission.smartLetter.discoveries).not.toMatch(forbidden)
      expect(mission.smartLetter.missionEnd).not.toMatch(forbidden)
      expect(mission.reconstruction.lines.join(' ')).not.toMatch(forbidden)
      expect(mission.stampLabel).not.toMatch(forbidden)
      if (mission.narrative) {
        const lines = [
          mission.narrative.entered,
          mission.narrative.detected,
          mission.narrative.approached,
          mission.narrative.scannerPromptDesktop,
          mission.narrative.scannerPromptTouch,
          mission.narrative.approachedTouch,
          mission.narrative.completed,
          mission.narrative.memoryRecovered,
          mission.narrative.letterPrepared,
          mission.narrative.genericHint,
          mission.narrative.revisitInProgress,
          mission.narrative.revisitLetterReady,
          mission.narrative.revisitTransmitted,
        ]
        for (const line of lines) expect(line).not.toMatch(forbidden)
      }
      for (const component of mission.components) {
        expect(component.historicalRecord).not.toMatch(forbidden)
        expect(component.pipLine).not.toMatch(forbidden)
        expect(component.scanHint).not.toMatch(forbidden)
        if (component.pipHint) expect(component.pipHint).not.toMatch(forbidden)
      }
    }
  })

  it('resolves missions and components safely', () => {
    expect(findMission('spirit')?.machineName).toBe('Spirit')
    expect(findMission('unknown')).toBeNull()
    expect(() => getMission('unknown' as never)).toThrow()
    expect(findComponent('spirit', 'spirit-pancam')?.name).toContain('Pancam')
    expect(findComponent('spirit', 'surveyor-3-tv-camera')).toBeNull()
    expect(findComponent('unknown' as never, 'anything')).toBeNull()
  })

  it('guards destination and mission ids', () => {
    expect(isDestinationId('mars')).toBe(true)
    expect(isDestinationId('earth')).toBe(false)
    expect(isDestinationId(null)).toBe(false)
    expect(isMissionId('spirit')).toBe(true)
    expect(isMissionId('voyager-1')).toBe(false)
    expect(isMissionId(3)).toBe(false)
  })

  it('tells Opportunity from the sourced record, without the invented last words', () => {
    const mars = getMission('opportunity')
    const all = [
      mars.summary,
      mars.pipBriefing,
      ...Object.values(mars.smartLetter),
      ...mars.reconstruction.lines,
      ...mars.components.flatMap((c) => [c.historicalRecord, c.pipLine]),
      ...(mars.distractors ?? []).flatMap((d) => [d.historicalRecord, d.pipNote]),
    ].join(' ')
    // NASA sources never contain this phrase; it must not be presented as
    // the rover's last message.
    expect(all).not.toMatch(/battery is low|getting dark/i)
    expect(mars.smartLetter.trajectory).toContain('Meridiani Planum')
    expect(mars.smartLetter.missionEnd).toContain('10 June 2018')
    expect(mars.smartLetter.missionEnd).toContain('13 February 2019')
    expect(mars.sources.every((source) => isNasaUrl(source.url))).toBe(true)
  })
})
