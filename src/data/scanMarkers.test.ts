import { describe, expect, it } from 'vitest'
import { getScanAnchors } from './spiritSite'
import { getMission } from './missions'
import {
  fragmentLabel,
  getMarkerViews,
  getNextMarkerNumber,
} from './scanMarkers'

const ids = getScanAnchors().map((a) => a.componentId)

describe('scan markers', () => {
  it('numbers every mission component exactly once, from data', () => {
    const missionIds = getMission('opportunity').components.map((c) => c.id)
    expect([...ids].sort()).toEqual([...missionIds].sort())
    expect(getMarkerViews(ids, [], null).map((m) => m.number)).toEqual([1, 2, 3])
  })

  it('marks pending / next / aimed / recorded', () => {
    expect(getMarkerViews(ids, [], null).map((m) => m.state)).toEqual([
      'next',
      'pending',
      'pending',
    ])
    expect(getMarkerViews(ids, [ids[0]!], ids[2]!).map((m) => m.state)).toEqual([
      'recorded',
      'next',
      'aimed',
    ])
    expect(
      getMarkerViews(ids, [...ids], null).every((m) => m.state === 'recorded'),
    ).toBe(true)
  })

  it('aiming the next marker shows it as aimed, not next', () => {
    expect(getMarkerViews(ids, [], ids[0]!)[0]!.state).toBe('aimed')
  })

  it('suggests 1 → 2 → 3 without blocking another order', () => {
    expect(getNextMarkerNumber(ids, [])).toBe(1)
    expect(getNextMarkerNumber(ids, [ids[1]!])).toBe(1)
    expect(getNextMarkerNumber(ids, [ids[0]!, ids[1]!])).toBe(3)
    expect(getNextMarkerNumber(ids, [...ids])).toBeNull()
  })

  it('never names a part before it is recorded', () => {
    const mission = getMission('opportunity')
    for (const id of ids) {
      const label = fragmentLabel(ids, id).toLowerCase()
      for (const component of mission.components) {
        expect(label).not.toContain(component.shortName.toLowerCase())
      }
      expect(label).toMatch(/^fragment [123]$/)
    }
  })
})
