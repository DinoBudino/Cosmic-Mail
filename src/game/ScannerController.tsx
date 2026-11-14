import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import {
  CALIBRATION_SAMPLE,
  INSPECT_FIRST_LINE,
  LATER_LINE,
  areFreeScansAllowed,
  isCalibrationActive,
  isCalibrationSampleId,
} from '../data/arrivalProtocol'
import { getEnvironmentalSite } from '../data/environmentalSites'
import { getMission } from '../data/missions'
import { pickTraceHit, type TraceRayHit } from '../data/fullScanSweep'
import { stageForProgress } from '../data/missionNarrative'
import type { MemoryFragmentKind } from '../data/fullScanReconstruction'
import { lensMatchesComponent } from '../data/scannerLenses'
import { emitAudio } from './audio/audioEvents'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { getCurrentProtocolStep } from './protocolStep'
import { useNarrativeStore } from '../store/narrativeStore'
import {
  requestDistractorNote,
  requestProtocolLine,
  requestWrongLensFeedback,
} from './missionNarrative'
import { playerPosition } from './playerPosition'
import { clearScannerAim, setScannerAim } from './scannerAim'
import { clientToNdc, scannerPointer } from './scannerPointer'
import { pickScannerTarget, type ScannerRayHit } from './scannerRay'
import { SCANNER } from './worldConfig'

const AIM_FALLBACK = new THREE.Vector3()

interface AncestorData {
  componentId: string | null
  missionId: string | null
  distractorId: string | null
  environmentalId: string | null
  ignored: boolean
}

function findAncestorData(object: THREE.Object3D): AncestorData {
  let current: THREE.Object3D | null = object
  let ignored = false
  let componentId: string | null = null
  let missionId: string | null = null
  let distractorId: string | null = null
  let environmentalId: string | null = null

  while (current) {
    if (current.userData?.scannerIgnore === true) ignored = true
    if (
      componentId === null &&
      typeof current.userData?.scannerComponentId === 'string'
    ) {
      componentId = current.userData.scannerComponentId
      missionId =
        typeof current.userData?.scannerMissionId === 'string'
          ? current.userData.scannerMissionId
          : null
    }
    if (
      distractorId === null &&
      typeof current.userData?.scannerDistractorId === 'string'
    ) {
      distractorId = current.userData.scannerDistractorId
      missionId =
        typeof current.userData?.scannerMissionId === 'string'
          ? current.userData.scannerMissionId
          : missionId
    }
    if (
      environmentalId === null &&
      typeof current.userData?.scannerEnvironmentalId === 'string'
    ) {
      environmentalId = current.userData.scannerEnvironmentalId
    }
    current = current.parent
  }

  return { componentId, missionId, distractorId, environmentalId, ignored }
}

function findTraceKind(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  while (current) {
    if (typeof current.userData?.scannerTraceKind === 'string') {
      return current.userData.scannerTraceKind
    }
    current = current.parent
  }
  return null
}

function isOpaque(object: THREE.Object3D): boolean {
  if (!(object instanceof THREE.Mesh)) return false
  const material = object.material
  if (Array.isArray(material)) {
    return material.some(
      (entry) => !entry.transparent || entry.opacity >= 0.9,
    )
  }
  return !material.transparent || material.opacity >= 0.9
}

/**
 * Physical scanner loop:
 * - raycast from the real mouse position (or the centre on touch);
 * - validate mission, range and occlusion;
 * - keep the arm aimed at the surface under the reticle;
 * - commit the 1.2 s hold exactly once through journeyStore.scan().
 */
export function ScannerController() {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const canvas = useThree((state) => state.gl.domElement)
  const raycaster = useRef(new THREE.Raycaster())
  const ndc = useRef(new THREE.Vector2())
  const intersections = useRef<THREE.Intersection[]>([])
  const rayHits = useRef<ScannerRayHit[]>([])
  const lastTargetId = useRef<string | null>(null)
  const holdProgress = useRef(0)
  const lastHudUpdate = useRef(0)
  const prevTriggerHeld = useRef(false)

  useFrame((state, delta) => {
    const store = useGameStore.getState()
    if (!store.scannerEquipped) {
      clearScannerAim()
      if (lastTargetId.current !== null) {
        lastTargetId.current = null
        holdProgress.current = 0
        store.setScannerTarget(null)
      }
      return
    }

    if (isWorldPaused()) {
      if (store.scannerTriggerHeld) store.setScannerTrigger(false)
      if (holdProgress.current !== 0) {
        holdProgress.current = 0
        store.setScannerScanProgress(0)
      }
      return
    }

    const missionId = store.scannerMissionId
    if (!missionId) return

    // Arrival protocol gates, derived from the journey save every frame.
    const journeyState = useJourneyStore.getState()
    const step = getCurrentProtocolStep(journeyState.save)
    const envAllowed = (id: string | null | undefined): boolean =>
      Boolean(id) &&
      (areFreeScansAllowed(step) ||
        (isCalibrationSampleId(id) && isCalibrationActive(step)))
    const explorerKnown = Boolean(
      journeyState.save?.missions[missionId]?.discovered,
    )

    camera.updateMatrixWorld()
    if (scannerPointer.mode === 'pointer') {
      const rect = canvas.getBoundingClientRect()
      const point = clientToNdc(
        scannerPointer.clientX,
        scannerPointer.clientY,
        rect,
      )
      ndc.current.set(point.x, point.y)
    } else {
      ndc.current.set(0, 0)
    }

    raycaster.current.setFromCamera(ndc.current, camera)
    raycaster.current.far = SCANNER.rayFar
    intersections.current.length = 0
    raycaster.current.intersectObjects(
      scene.children,
      true,
      intersections.current,
    )

    rayHits.current.length = 0
    for (const intersection of intersections.current) {
      const data = findAncestorData(intersection.object)
      rayHits.current.push({
        componentId: data.componentId,
        missionId: data.missionId,
        distractorId: data.distractorId,
        environmentalId: data.environmentalId,
        distance: intersection.distance,
        x: intersection.point.x,
        y: intersection.point.y,
        z: intersection.point.z,
        ignored: data.ignored,
        opaque: isOpaque(intersection.object),
      })
    }

    // Full-scan sweep: memory traces around the identified explorer.
    let trace: { kind: MemoryFragmentKind; index: number } | null = null
    if (
      store.fullScanSweepActive &&
      explorerKnown &&
      stageForProgress(journeyState.save?.missions[missionId] ?? null) ===
        'ready_for_full_scan'
    ) {
      const traceHits: TraceRayHit[] = intersections.current.map(
        (intersection, index) => {
          const hit = rayHits.current[index]!
          return {
            traceKind: findTraceKind(intersection.object),
            componentId: hit.componentId,
            distractorId: hit.distractorId ?? null,
            ignored: hit.ignored,
            opaque: hit.opaque,
            distance: hit.distance,
          }
        },
      )
      trace = pickTraceHit(traceHits, store.fullScanRecon.revealed, SCANNER.range)
    }

    const picked = pickScannerTarget(
      rayHits.current,
      missionId,
      playerPosition,
      SCANNER.range,
    )
    // Before the explorer is identified the scanner does not react to it:
    // no target, no label. One short notice points the player to E.
    const rawComponentId =
      picked && 'componentId' in picked ? picked.componentId : null
    const rawDistractorId =
      picked && 'distractorId' in picked ? picked.distractorId : null
    const componentId = explorerKnown && !trace ? rawComponentId : null
    const distractorId = explorerKnown && !trace ? rawDistractorId : null
    if (
      !explorerKnown &&
      (rawComponentId || rawDistractorId) &&
      store.scannerTriggerHeld
    ) {
      requestProtocolLine(INSPECT_FIRST_LINE, 20_000)
    }
    const rawEnvironmentalId =
      picked && 'environmentalId' in picked
        ? picked.environmentalId
        : null
    // Landscape and memorial scans open in free exploration; the only
    // exception is the calibration sample while calibrating.
    const environmentalId = envAllowed(rawEnvironmentalId)
      ? rawEnvironmentalId
      : null
    if (
      rawEnvironmentalId &&
      !environmentalId &&
      !isCalibrationSampleId(rawEnvironmentalId) &&
      store.scannerTriggerHeld
    ) {
      requestProtocolLine(LATER_LINE, 30_000)
    }
    const environmental = environmentalId
      ? getEnvironmentalSite(environmentalId)
      : null
    const environmentalInRange =
      environmental !== null &&
      picked !== null &&
      picked.distance <= environmental.scanRange

    // Keep the physical device pointed at the surface under the reticle,
    // even when it is not a valid target.
    const aimHit = trace
      ? rayHits.current[trace.index]
      : (picked ?? rayHits.current.find((hit) => !hit.ignored && hit.opaque))
    if (aimHit) {
      setScannerAim(aimHit.x, aimHit.y, aimHit.z)
    } else {
      raycaster.current.ray.at(SCANNER.fallbackAimDistance, AIM_FALLBACK)
      setScannerAim(AIM_FALLBACK.x, AIM_FALLBACK.y, AIM_FALLBACK.z)
    }

    const validEnvironmentalId = environmentalInRange
      ? environmentalId
      : null
    const firstRelevantHit = rayHits.current.find(
      (hit) =>
        !hit.ignored &&
        (((hit.componentId || hit.distractorId) &&
          hit.missionId === missionId &&
          explorerKnown) ||
          envAllowed(hit.environmentalId)),
    )
    const firstOpaqueHit = rayHits.current.find(
      (hit) => !hit.ignored && hit.opaque,
    )
    const physicalState =
      trace || componentId || distractorId || validEnvironmentalId
        ? ('valid' as const)
        : environmentalId && environmental && picked
          ? ('out-of-range' as const)
          : firstRelevantHit &&
              firstOpaqueHit &&
              firstOpaqueHit.distance < firstRelevantHit.distance
            ? ('occluded' as const)
            : firstRelevantHit
              ? ('out-of-range' as const)
              : ('idle' as const)
    store.setScannerPhysicalState(physicalState)

    const targetKey = trace
      ? `trace:${trace.kind}`
      : componentId
      ? `component:${componentId}`
      : distractorId
        ? `distractor:${distractorId}`
        : validEnvironmentalId
        ? `environment:${validEnvironmentalId}`
        : null

    if (targetKey !== lastTargetId.current) {
      lastTargetId.current = targetKey
      holdProgress.current = 0
      // A latched touch scan belongs to one target: losing or changing it
      // releases the trigger so the player never scans something by accident.
      if (store.scannerLatched) store.setScannerTrigger(false)
      if (trace) {
        store.setScannerTraceTarget(trace.kind)
      } else if (componentId) {
        store.setScannerTarget(componentId)
      } else if (distractorId) {
        store.setScannerDistractorTarget(distractorId)
      } else if (validEnvironmentalId) {
        store.setScannerEnvironmentalTarget(validEnvironmentalId)
      } else {
        store.setScannerEnvironmentalTarget(null)
        store.setScannerDistractorTarget(null)
        store.setScannerTarget(null)
      }
      if (!trace) store.setScannerTraceTarget(null)
      store.setScannerScanProgress(0)
    }

    const journey = journeyState
    const save = journey.save
    const progress = save?.missions[missionId]
    const alreadyScanned = componentId
      ? (progress?.scannedComponentIds.includes(componentId) ?? false)
      : false
    const environmentalDetailedDone = validEnvironmentalId
      ? Boolean(
          save?.environmentalDetailedDiscoveries.includes(
            validEnvironmentalId,
          ),
        )
      : false
    const discovered = Boolean(progress?.discovered)
    const targetComponent =
      componentId && missionId
        ? (getMission(missionId).components.find(
            (component) => component.id === componentId,
          ) ?? null)
        : null
    // The right lens is part of recognizing a component. A wrong lens is a
    // soft nudge from PIP, never a failure or a penalty.
    const lensOk = targetComponent
      ? lensMatchesComponent(targetComponent, store.scannerLens)
      : false
    const wantsScan =
      Boolean(save) &&
      discovered &&
      store.scannerTriggerHeld
    const canScanComponent =
      wantsScan && Boolean(componentId) && !alreadyScanned && lensOk
    const canScanDistractor = wantsScan && Boolean(distractorId)
    // One wrong-lens attempt = one press of the scan control on a pending
    // part, never one frame. The ladder (panel → PIP → pulse) lives in
    // lensFeedback; the press is counted here.
    const pressRising = store.scannerTriggerHeld && !prevTriggerHeld.current
    prevTriggerHeld.current = store.scannerTriggerHeld
    if (
      pressRising &&
      wantsScan &&
      componentId &&
      !alreadyScanned &&
      targetComponent &&
      !lensOk
    ) {
      const attempt = store.registerWrongLensAttempt(componentId)
      requestWrongLensFeedback(componentId, missionId, attempt)
      if (store.scannerLatched) store.setScannerTrigger(false)
    }
    const calibrating =
      Boolean(validEnvironmentalId) &&
      isCalibrationSampleId(validEnvironmentalId) &&
      isCalibrationActive(step)
    const calibrationLensOk = store.scannerLens === CALIBRATION_SAMPLE.lens
    const canCalibrate =
      calibrating && store.scannerTriggerHeld && calibrationLensOk
    const canScanEnvironmental =
      Boolean(save) &&
      Boolean(validEnvironmentalId) &&
      !calibrating &&
      store.scannerTriggerHeld &&
      !environmentalDetailedDone

    if (trace && store.scannerTriggerHeld) {
      holdProgress.current = Math.min(
        1,
        holdProgress.current + Math.min(delta, 0.05) / SCANNER.holdSeconds,
      )
      if (holdProgress.current >= 1) {
        holdProgress.current = 0
        store.setScannerScanProgress(0)
        store.setScannerTrigger(false)
        if (store.revealFullScanTrace(trace.kind, missionId)) {
          emitAudio('scanCompleted')
        }
      }
    } else if (canScanComponent && componentId) {
      holdProgress.current = Math.min(
        1,
        holdProgress.current + Math.min(delta, 0.05) / SCANNER.holdSeconds,
      )

      if (holdProgress.current >= 1) {
        const result = journey.scan(missionId, componentId)
        holdProgress.current = 0
        store.setScannerScanProgress(0)
        if (result?.status === 'scanned') {
          store.setScannerTrigger(false)
          // The narrative controller reacts to the new record and PIP
          // explains it in-world; the reading card stays optional.
        }
      }
    } else if (canScanDistractor && distractorId) {
      holdProgress.current = Math.min(
        1,
        holdProgress.current + Math.min(delta, 0.05) / SCANNER.holdSeconds,
      )
      if (holdProgress.current >= 1) {
        requestDistractorNote(distractorId, missionId)
        holdProgress.current = 0
        store.setScannerScanProgress(0)
        store.setScannerTrigger(false)
      }
    } else if (canCalibrate) {
      holdProgress.current = Math.min(
        1,
        holdProgress.current + Math.min(delta, 0.05) / SCANNER.holdSeconds,
      )
      if (holdProgress.current >= 1) {
        useNarrativeStore.getState().markProtocol('calibrated')
        holdProgress.current = 0
        store.setScannerScanProgress(0)
        store.setScannerTrigger(false)
      }
    } else if (canScanEnvironmental && validEnvironmentalId) {
      holdProgress.current = Math.min(
        1,
        holdProgress.current +
          Math.min(delta, 0.05) / SCANNER.environmentalDetailSeconds,
      )
      const quickThreshold =
        SCANNER.environmentalQuickSeconds /
        SCANNER.environmentalDetailSeconds

      if (
        store.scannerAnalysis === 'idle' &&
        holdProgress.current >= quickThreshold
      ) {
        const result = journey.recordEnvironmentalScan(
          validEnvironmentalId,
          false,
        )
        if (result && (result.status === 'quick' || result.status === 'duplicate')) {
          store.setScannerAnalysis('quick')
        }
      }

      if (holdProgress.current >= 1) {
        const result = journey.recordEnvironmentalScan(
          validEnvironmentalId,
          true,
        )
        if (result && (result.status === 'detailed' || result.status === 'duplicate')) {
          store.setScannerAnalysis('detailed')
        }
        holdProgress.current = 0
        store.setScannerScanProgress(0)
        store.setScannerTrigger(false)
      }
    } else {
      holdProgress.current = 0
    }

    const now = state.clock.elapsedTime
    if (
      holdProgress.current === 0 ||
      now - lastHudUpdate.current > 0.05
    ) {
      lastHudUpdate.current = now
      store.setScannerScanProgress(holdProgress.current)
    }
  })

  return null
}
