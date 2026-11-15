import { describe, expect, it } from 'vitest'
import { getMission } from './missions'
import {
  getAmbientCue,
  getApproachedCue,
  getArchiveCue,
  getComponentCue,
  getCompletionCue,
  getDetectedCue,
  getHuntClueCue,
  getHuntTarget,
  getHintCue,
  getIdentifiedCue,
  getLetterPreparedCue,
  getMissionEntryCue,
  getNewComponentIds,
  getPendingComponents,
  getReturnToShipCue,
  getScannerPromptCue,
  getSoftHintCue,
  scannedComponentCount,
  type NarrativeProgress,
} from './missionNarrative'

const mission = getMission('spirit')

function progress(
  scanned: readonly string[],
  overrides: Partial<NarrativeProgress> = {},
): NarrativeProgress {
  return { scannedComponentIds: [...scanned], ...overrides }
}

const ALL = mission.components.map((component) => component.id)

describe('Spirit narrative rules', () => {
  it('moves through entry cues without inventing a seal', () => {
    expect(getMissionEntryCue(mission, null)).toBeNull()

    const entered = getMissionEntryCue(mission, progress([]))
    expect(entered?.text).toBe(mission.narrative?.entered)
    expect(entered?.priority).toBe('mission')

    const investigating = getMissionEntryCue(mission, progress([ALL[0]]))
    expect(investigating?.text).toBe(mission.narrative?.revisitInProgress)

    const ready = getMissionEntryCue(mission, progress(ALL))
    expect(ready?.text).toBe(mission.narrative?.revisitInProgress)

    const memory = getMissionEntryCue(
      mission,
      progress(ALL, { memoryRecoveredAt: 100 }),
    )
    expect(memory?.text).toMatch(/seal the letter/i)

    const letter = getMissionEntryCue(
      mission,
      progress(ALL, { memoryRecoveredAt: 100, smartLetterCreatedAt: 200 }),
    )
    expect(letter?.text).toBe(mission.narrative?.revisitLetterReady)

    const transmitted = getMissionEntryCue(
      mission,
      progress(ALL, {
        memoryRecoveredAt: 100,
        smartLetterCreatedAt: 200,
        transmittedAt: 300,
      }),
    )
    expect(transmitted?.text).toBe(mission.narrative?.revisitTransmitted)
  })

  it('identifies pending components from save order', () => {
    expect(
      getPendingComponents(mission, progress([])).map(
        (component) => component.id,
      ),
    ).toEqual(ALL)
    expect(
      getPendingComponents(mission, progress([ALL[0]])).map(
        (component) => component.id,
      ),
    ).toEqual(ALL.slice(1))
    expect(getPendingComponents(mission, progress(ALL))).toEqual([])
    expect(scannedComponentCount(progress([ALL[0], ALL[0]]))).toBe(1)
  })

  it('never treats a duplicate scan as a new narrative event', () => {
    expect(getNewComponentIds([ALL[0]], [])).toEqual([ALL[0]])
    expect(getNewComponentIds([ALL[0]], [ALL[0]])).toEqual([])
    expect(getNewComponentIds([ALL[0], ALL[1]], [ALL[0]])).toEqual([ALL[1]])
    expect(getNewComponentIds([], [ALL[0]])).toEqual([])
  })

  it('explains exactly the freshly recorded component after discovery', () => {
    for (const component of mission.components) {
      const cue = getComponentCue(mission, component.id)
      expect(cue?.text).toBe(component.pipLine)
      expect(cue?.componentId).toBe(component.id)
    }
    expect(getComponentCue(mission, 'unknown')).toBeNull()
  })

  it('keeps the identity hidden until the discovery event', () => {
    const hidden = [
      getDetectedCue(mission)?.text ?? '',
      getApproachedCue(mission)?.text ?? '',
    ]
    for (const text of hidden) {
      expect(text).not.toMatch(/spirit|pancam|mini-tes|rock abrasion|\brat\b/i)
    }
    expect(getIdentifiedCue(mission)?.text).toMatch(/Spirit/)
    expect(getIdentifiedCue(mission)?.priority).toBe('discovery')
  })

  it('runs the parts hunt: one clue per part, in order, after discovery', () => {
    expect(getHuntTarget(mission, progress([]))).toBeNull()
    const found = { ...progress([]), discovered: true }
    const first = getHuntTarget(mission, found)
    expect(first?.id).toBe(mission.components[0]!.id)
    const clue = getHuntClueCue(mission, first!.id)
    expect(clue?.id).toBe(`${mission.id}:clue:${first!.id}`)
    expect(clue?.componentId).toBe(first!.id)
    const next = getHuntTarget(mission, {
      ...found,
      scannedComponentIds: [first!.id],
    })
    expect(next?.id).toBe(mission.components[1]!.id)
    expect(getHuntClueCue(mission, next!.id)?.id).not.toBe(clue?.id)
  })

  it('makes the touch approach line say Inspect', () => {
    expect(getApproachedCue(mission, true)?.text).toBe(
      mission.narrative?.approachedTouch,
    )
  })

  it('offers capped ambient observations', () => {
    expect(getAmbientCue(mission, 0)?.text).toBe(
      mission.narrative?.ambient[0],
    )
    expect(getAmbientCue(mission, 1)?.priority).toBe('ambient')
    expect(getAmbientCue(mission, 99)).toBeNull()
  })

  it('keeps Ask PIP anonymous before any component is recognized', () => {
    const unknown = getHintCue(mission, progress([]))
    expect(unknown?.componentId).toBeUndefined()
    expect(unknown?.text).not.toMatch(/spirit|pancam|mini-tes|rock abrasion/i)
    expect(unknown?.once).toBe(false)
    expect(unknown?.priority).toBe('hint')

    // After discovery the first answer repeats the hunt clue: it points at
    // the part (glow) but never says its name.
    const discovered = getHintCue(
      mission,
      progress([], { discovered: true }),
    )
    expect(discovered?.componentId).toBe(ALL[0])
    expect(discovered?.text).toBe(mission.components[0]!.huntClue?.line)
    expect(discovered?.text).not.toMatch(/pancam|mini-tes|rock abrasion/i)
  })

  it('escalates hunt hints from clue to nudge to direct help', () => {
    const found = progress([], { discovered: true })
    expect(getHintCue(mission, found, 0)?.text).toBe(
      mission.components[0]!.huntClue?.line,
    )
    const nudge = getHintCue(mission, found, 1)
    expect(nudge?.componentId).toBe(ALL[0])
    expect(nudge?.text).toBe(
      mission.components[0]!.pipHint ?? mission.components[0]!.pipDirectHint,
    )

    const direct = getHintCue(
      mission,
      progress([ALL[0]], { discovered: true }),
      2,
    )
    expect(direct?.componentId).toBe(ALL[1])
    expect(direct?.text).toBe(mission.components[1].pipDirectHint)
    expect(direct?.once).toBe(false)
  })

  it('keeps orientation and context hints before discovery', () => {
    expect(getHintCue(mission, progress([]), 0)?.text).toBe(
      mission.narrative?.hintOrientation,
    )
    expect(getHintCue(mission, progress([]), 1)?.text).toBe(
      mission.narrative?.hintContext,
    )
  })

  it('uses a separate id for a proactive soft hint', () => {
    const soft = getSoftHintCue(mission, progress([], { discovered: true }))
    expect(soft?.componentId).toBe(ALL[0])
    expect(soft?.id).toMatch(/soft-hint/)
    expect(soft?.priority).toBe('hint')
  })

  it('points to the letter once the memory is back', () => {
    const letter = getHintCue(
      mission,
      progress(ALL, { memoryRecoveredAt: 100 }),
    )
    expect(letter?.text).toMatch(/seal the letter/i)
    expect(letter?.componentId).toBeUndefined()
  })

  it('celebrates the last part once, then hands over to the tablet', () => {
    const done = getCompletionCue(mission)
    expect(done?.text).toBe(mission.narrative?.completed)
    expect(done?.expression).toBe('celebrating')
    expect(getLetterPreparedCue(mission)?.text).toBe(
      mission.narrative?.letterPrepared,
    )
    expect(getReturnToShipCue(mission)?.text).toBe(
      mission.narrative?.returnToShip,
    )
  })

  it('adapts the scanner prompt to desktop and touch', () => {
    expect(getScannerPromptCue(mission, false)?.text).toBe(
      mission.narrative?.scannerPromptDesktop,
    )
    expect(getScannerPromptCue(mission, true)?.text).toBe(
      mission.narrative?.scannerPromptTouch,
    )
    expect(getDetectedCue(mission)?.text).toBe(mission.narrative?.detected)
    expect(getApproachedCue(mission)?.text).toBe(
      mission.narrative?.approached,
    )
    expect(getIdentifiedCue(mission)?.expression).toBe('excited')
  })

  it('switches the archive PIP line by stage without duplication', () => {
    expect(getArchiveCue(mission, progress([]))).toMatchObject({
      kind: 'locked',
      text: mission.narrative?.revisitInProgress,
    })
    expect(getArchiveCue(mission, progress(ALL))).toMatchObject({
      kind: 'locked',
    })
    expect(
      getArchiveCue(mission, progress(ALL, { memoryRecoveredAt: 100 })),
    ).toMatchObject({ kind: 'memory', text: mission.narrative?.memoryRecovered })
    expect(
      getArchiveCue(
        mission,
        progress(ALL, {
          memoryRecoveredAt: 100,
          smartLetterCreatedAt: 200,
        }),
      ),
    ).toMatchObject({
      kind: 'letter',
      text: mission.narrative?.letterPrepared,
    })
    expect(
      getArchiveCue(
        mission,
        progress(ALL, {
          memoryRecoveredAt: 100,
          smartLetterCreatedAt: 200,
          transmittedAt: 300,
        }),
      ),
    ).toMatchObject({ kind: 'transmitted', text: mission.completionStory })
  })
})
