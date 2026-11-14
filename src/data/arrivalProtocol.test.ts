import { describe, expect, it } from 'vitest'
import { getMission } from './missions'
import { createJourney } from '../store/journeySchema'
import {
  markMissionDiscovered,
  prepareSmartLetter,
  scanComponent,
  completeFullScan,
  transmitLetter,
  getMissionProgress,
} from '../store/journeyLogic'
import {
  CALIBRATION_SAMPLE,
  CALIBRATION_STATION,
  CORRIDOR_HALF_WIDTH,
  INITIAL_PROTOCOL_FLAGS,
  areFreeScansAllowed,
  distanceToTrail,
  getObjective,
  getPreDiscoveryTexts,
  getProtocolStep,
  getRadarTargetKind,
  hasReachedStation,
  hasWalkedEnough,
  isCalibrationActive,
  isOutsideCorridor,
  isRadarVisible,
  isScannerUnlocked,
  type ProtocolFlags,
  type ProtocolStep,
} from './arrivalProtocol'

const mission = getMission('spirit')

function progressOf(save: ReturnType<typeof createJourney>) {
  return getMissionProgress(save, 'spirit')
}

function step(
  save: ReturnType<typeof createJourney>,
  flags: Partial<ProtocolFlags> = {},
  priorFieldWork = false,
): ProtocolStep {
  return getProtocolStep({
    progress: progressOf(save),
    flags: { ...INITIAL_PROTOCOL_FLAGS, ...flags },
    priorFieldWork,
  })
}

describe('protocol step derivation', () => {
  const fresh = createJourney('Ada')

  it('walks M0 → M1 → M2 → M3 as the ephemeral flags are earned', () => {
    expect(step(fresh)).toBe('M0')
    expect(step(fresh, { walked: true })).toBe('M1')
    expect(step(fresh, { walked: true, stationReached: true })).toBe('M2')
    expect(
      step(fresh, { walked: true, stationReached: true, calibrated: true }),
    ).toBe('M3')
  })

  it('derives M4–M7 from journey progress only, whatever the flags say', () => {
    let save = markMissionDiscovered(fresh, 'spirit')
    expect(step(save)).toBe('M4')
    for (const component of mission.components) {
      save = scanComponent(save, 'spirit', component.id).save
    }
    expect(step(save)).toBe('M5')
    save = completeFullScan(save, 'spirit').save
    expect(step(save)).toBe('M6')
    save = prepareSmartLetter(save, 'spirit').save
    expect(step(save)).toBe('M6')
    save = transmitLetter(save, 'spirit').save
    expect(step(save)).toBe('M7')
  })

  it('resumes at the right step after a reload (flags lost, progress kept)', () => {
    const discovered = markMissionDiscovered(fresh, 'spirit')
    // A reload wipes the ephemeral flags; discovered progress still wins.
    expect(step(discovered, INITIAL_PROTOCOL_FLAGS)).toBe('M4')
    // Before discovery the short opening replays from the start.
    expect(step(fresh, INITIAL_PROTOCOL_FLAGS)).toBe('M0')
  })

  it('skips the opening for saves that already show field work', () => {
    expect(step(fresh, {}, true)).toBe('M3')
  })

  it('never goes backwards once discovered', () => {
    const discovered = markMissionDiscovered(fresh, 'spirit')
    expect(step(discovered, { walked: false })).toBe('M4')
  })
})

describe('protocol gating', () => {
  it('shows the radar from M1 and unlocks the scanner at M2', () => {
    expect(isRadarVisible('M0')).toBe(false)
    expect(isRadarVisible('M1')).toBe(true)
    expect(isScannerUnlocked('M1')).toBe(false)
    expect(isScannerUnlocked('M2')).toBe(true)
  })

  it('allows landscape scans only in free exploration (M7)', () => {
    const steps: ProtocolStep[] = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']
    for (const s of steps) expect(areFreeScansAllowed(s)).toBe(false)
    expect(areFreeScansAllowed('M7')).toBe(true)
  })

  it('only calibrates during M2 and points the radar at the station first', () => {
    expect(isCalibrationActive('M2')).toBe(true)
    expect(isCalibrationActive('M3')).toBe(false)
    expect(getRadarTargetKind('M1')).toBe('station')
    expect(getRadarTargetKind('M2')).toBe('station')
    expect(getRadarTargetKind('M3')).toBe('signal')
  })
})

describe('movement rules', () => {
  it('finishes the landing step after about 8 m', () => {
    expect(hasWalkedEnough({ x: 0, z: 75 })).toBe(false)
    expect(hasWalkedEnough({ x: 0, z: 66 })).toBe(true)
  })

  it('reaches the station within its radius', () => {
    expect(hasReachedStation(CALIBRATION_STATION)).toBe(true)
    expect(hasReachedStation({ x: 60, z: 47 })).toBe(false)
  })

  it('puts the calibration sample within scan range of the station', () => {
    const d = Math.hypot(
      CALIBRATION_SAMPLE.position.x - CALIBRATION_STATION.x,
      CALIBRATION_SAMPLE.position.z - CALIBRATION_STATION.z,
    )
    expect(d).toBeLessThan(CALIBRATION_SAMPLE.scanRange)
  })

  it('keeps the station and the landing on the trail corridor', () => {
    expect(isOutsideCorridor('M1', { x: 0, z: 75 })).toBe(false)
    expect(distanceToTrail(CALIBRATION_STATION)).toBeLessThan(
      CORRIDOR_HALF_WIDTH,
    )
  })

  it('only nudges the player back during the guided steps', () => {
    const far = { x: 110, z: 20 }
    expect(isOutsideCorridor('M1', far)).toBe(true)
    expect(isOutsideCorridor('M3', far)).toBe(true)
    expect(isOutsideCorridor('M0', far)).toBe(false)
    expect(isOutsideCorridor('M4', far)).toBe(false)
    expect(isOutsideCorridor('M7', far)).toBe(false)
  })
})

describe('objectives', () => {
  const base = {
    coarsePointer: false,
    scannerEquipped: false,
    aimingAtSample: false,
    lens: 'visual' as const,
    scannedCount: 0,
    nearSignal: false,
    memoryRecovered: false,
    aimingAtPart: false,
    lensTouched: false,
    nextMarker: 1,
  }

  it('teaches equip → aim → lens → hold in M2', () => {
    const at = (over: object) =>
      getObjective({ ...base, step: 'M2', ...over })
    expect(at({}).highlight).toBe('scanner-key')
    expect(at({ scannerEquipped: true }).highlight).toBe('sample')
    expect(
      at({ scannerEquipped: true, aimingAtSample: true }).highlight,
    ).toBe('lens')
    expect(
      at({
        scannerEquipped: true,
        aimingAtSample: true,
        lens: 'contact',
      }).highlight,
    ).toBe('hold')
  })

  it('guides the first part: equip → aim at marker 1 → hold, teaching the lens rule', () => {
    const at = (over: object) => getObjective({ ...base, step: 'M4', ...over })
    expect(at({}).text).toContain('marker 1')
    expect(at({ scannerEquipped: true }).highlight).toBe('marker')
    const aimed = at({ scannerEquipped: true, aimingAtPart: true })
    expect(aimed.highlight).toBe('lens-picker')
    expect(aimed.text).toMatch(/look.*touch.*heat/i)
    // The rule is taught, the right lens is not named.
    expect(aimed.text).not.toMatch(/visual|contact|thermal/i)
    expect(
      at({ scannerEquipped: true, aimingAtPart: true, lensTouched: true })
        .highlight,
    ).toBe('hold')
  })

  it('suggests the next marker for parts 2 and 3 without blocking', () => {
    const at = (over: object) => getObjective({ ...base, step: 'M4', ...over })
    expect(
      at({ scannerEquipped: true, scannedCount: 1, nextMarker: 2 }).text,
    ).toContain('marker 2')
    expect(
      at({ scannerEquipped: true, scannedCount: 2, nextMarker: 3 }).text,
    ).toContain('marker 3')
  })

  it('shows the recognition count in M4 and uses one short line each', () => {
    expect(getObjective({ ...base, step: 'M4', scannedCount: 2 }).text).toBe(
      "Recognize the explorer's parts (2/3)",
    )
    for (const s of ['M0', 'M1', 'M3', 'M4', 'M5', 'M6', 'M7'] as const) {
      expect(getObjective({ ...base, step: s }).text.length).toBeLessThan(70)
    }
  })

  it('swaps controls copy for touch', () => {
    expect(
      getObjective({ ...base, step: 'M0', coarsePointer: true }).text,
    ).toContain('joystick')
  })
})

describe('identity discipline', () => {
  it('never names the explorer or its parts before discovery', () => {
    const banned = [
      'spirit',
      'pancam',
      'mini-tes',
      'abrasion',
      'rover',
      'opportunity',
      'mars exploration',
    ]
    for (const text of getPreDiscoveryTexts()) {
      for (const word of banned) {
        expect(text.toLowerCase()).not.toContain(word)
      }
    }
  })
})
