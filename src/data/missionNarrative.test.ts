import { describe, expect, it } from 'vitest'
import { getMission } from './missions'
import {
  getAmbientCue,
  getApproachedCue,
  getArchiveCue,
  getComponentCue,
  getCompletionCues,
  getDetectedCue,
  getFullScanCompleteCues,
  getFullScanReadyCue,
  getFullScanStartedCue,
  getHintCue,
  getIdentifiedCue,
  getLetterPreparedCue,
  getMissionEntryCue,
  getNewComponentIds,
  getPendingComponents,
  getReturnToShipCue,
  getScannerEquippedCue,
  getScannerPromptCue,
  getScanInterruptedCue,
  getScanStartedCue,
  getSoftHintCue,
  getTargetDetectedCue,
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
    expect(memory?.text).toBe(mission.narrative?.fullScanComplete[1])

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

  it('reacts to reticle, hold and interruption without duplicating ids', () => {
    expect(getTargetDetectedCue(mission)?.text).toBe(
      mission.narrative?.targetDetected,
    )
    const started = getScanStartedCue(mission, ALL[0])
    expect(started?.text).toBe(mission.narrative?.scanStarted)
    expect(started?.componentId).toBe(ALL[0])
    expect(started?.id).toBe(`${mission.id}:scan-start:${ALL[0]}`)
    expect(getScanStartedCue(mission, ALL[1])?.id).not.toBe(started?.id)

    const interrupted = getScanInterruptedCue(mission)
    expect(interrupted?.text).toBe(mission.narrative?.scanInterrupted)
    expect(interrupted?.once).toBe(false)
    expect(interrupted?.priority).toBe('hint')
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

    const discovered = getHintCue(
      mission,
      progress([], { discovered: true }),
    )
    expect(discovered?.componentId).toBeUndefined()
    expect(discovered?.text).not.toMatch(/pancam|mini-tes|rock abrasion/i)
  })

  it('escalates hints from orientation to context to direct help', () => {
    const orientation = getHintCue(mission, progress([], { discovered: true }), 0)
    expect(orientation?.text).toBe(mission.narrative?.hintOrientation)
    expect(orientation?.componentId).toBeUndefined()

    const context = getHintCue(mission, progress([], { discovered: true }), 1)
    expect(context?.text).toBe(mission.narrative?.hintContext)
    expect(context?.componentId).toBeUndefined()

    const direct = getHintCue(
      mission,
      progress([ALL[0]], { discovered: true }),
      2,
    )
    expect(direct?.componentId).toBe(ALL[1])
    expect(direct?.text).toBe(mission.components[1].pipDirectHint)
    expect(direct?.once).toBe(false)
  })

  it('uses a separate id for a proactive soft hint', () => {
    const soft = getSoftHintCue(mission, progress([], { discovered: true }))
    expect(soft?.text).toBe(mission.narrative?.hintContext)
    expect(soft?.id).toMatch(/soft-hint/)
    expect(soft?.priority).toBe('hint')
  })

  it('points to the full scan and the letter at the right stages', () => {
    const fullScan = getHintCue(mission, progress(ALL, { discovered: true }))
    expect(fullScan?.text).toBe(
      'Every part is recognized. Open the full recognition scan when you are ready; it studies the complete explorer, not a single part.',
    )
    expect(fullScan?.componentId).toBeUndefined()

    const letter = getHintCue(
      mission,
      progress(ALL, { memoryRecoveredAt: 100 }),
    )
    expect(letter?.text).toMatch(/prepare the smart letter/i)
    expect(letter?.componentId).toBeUndefined()
  })

  it('queues completion and full-scan invitation lines in order', () => {
    const cues = getCompletionCues(mission)
    expect(cues.map((cue) => cue.text)).toEqual([
      ...(mission.narrative?.completed ?? []),
    ])
    expect(cues).toHaveLength(2)
    expect(new Set(cues.map((cue) => cue.id)).size).toBe(2)

    expect(getFullScanReadyCue(mission)?.text).toBe(
      mission.narrative?.fullScanReady,
    )
    expect(getFullScanStartedCue(mission)?.text).toBe(
      mission.narrative?.fullScanStarted,
    )
    const recovered = getFullScanCompleteCues(mission)
    expect(recovered.map((cue) => cue.text)).toEqual([
      ...(mission.narrative?.fullScanComplete ?? []),
    ])
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
    expect(getScannerEquippedCue(mission)?.text).toBe(
      mission.narrative?.scannerEquipped,
    )
    expect(getIdentifiedCue(mission)?.expression).toBe('excited')
    expect(getFullScanStartedCue(mission)?.expression).toBe('focused')
    expect(getScanInterruptedCue(mission)?.expression).toBe('concerned')
  })

  it('switches the archive PIP line by stage without duplication', () => {
    expect(getArchiveCue(mission, progress([]))).toMatchObject({
      kind: 'locked',
      text: mission.narrative?.fullScanReady,
    })
    expect(getArchiveCue(mission, progress(ALL))).toMatchObject({
      kind: 'locked',
    })
    expect(
      getArchiveCue(mission, progress(ALL, { memoryRecoveredAt: 100 })),
    ).toMatchObject({ kind: 'memory' })
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
