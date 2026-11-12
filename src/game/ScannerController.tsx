import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { getEnvironmentalSite } from '../data/environmentalSites'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { playerPosition } from './playerPosition'
import { clearScannerAim, setScannerAim } from './scannerAim'
import { clientToNdc, scannerPointer } from './scannerPointer'
import { pickScannerTarget, type ScannerRayHit } from './scannerRay'
import { SCANNER } from './worldConfig'

const AIM_FALLBACK = new THREE.Vector3()

interface AncestorData {
  componentId: string | null
  missionId: string | null
  environmentalId: string | null
  ignored: boolean
}

function findAncestorData(object: THREE.Object3D): AncestorData {
  let current: THREE.Object3D | null = object
  let ignored = false
  let componentId: string | null = null
  let missionId: string | null = null
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
      environmentalId === null &&
      typeof current.userData?.scannerEnvironmentalId === 'string'
    ) {
      environmentalId = current.userData.scannerEnvironmentalId
    }
    current = current.parent
  }

  return { componentId, missionId, environmentalId, ignored }
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
        environmentalId: data.environmentalId,
        distance: intersection.distance,
        x: intersection.point.x,
        y: intersection.point.y,
        z: intersection.point.z,
        ignored: data.ignored,
        opaque: isOpaque(intersection.object),
      })
    }

    const picked = pickScannerTarget(
      rayHits.current,
      missionId,
      playerPosition,
      SCANNER.range,
    )
    const componentId =
      picked && 'componentId' in picked ? picked.componentId : null
    const environmentalId =
      picked && 'environmentalId' in picked
        ? picked.environmentalId
        : null
    const environmental = environmentalId
      ? getEnvironmentalSite(environmentalId)
      : null
    const environmentalInRange =
      environmental !== null &&
      picked !== null &&
      picked.distance <= environmental.scanRange

    // Keep the physical device pointed at the surface under the reticle,
    // even when it is not a valid target.
    const aimHit =
      picked ?? rayHits.current.find((hit) => !hit.ignored && hit.opaque)
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
        ((hit.componentId && hit.missionId === missionId) ||
          Boolean(hit.environmentalId)),
    )
    const firstOpaqueHit = rayHits.current.find(
      (hit) => !hit.ignored && hit.opaque,
    )
    const physicalState =
      componentId || validEnvironmentalId
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

    const targetKey = componentId
      ? `component:${componentId}`
      : validEnvironmentalId
        ? `environment:${validEnvironmentalId}`
        : null

    if (targetKey !== lastTargetId.current) {
      lastTargetId.current = targetKey
      holdProgress.current = 0
      if (componentId) {
        store.setScannerTarget(componentId)
      } else if (validEnvironmentalId) {
        store.setScannerEnvironmentalTarget(validEnvironmentalId)
      } else {
        store.setScannerEnvironmentalTarget(null)
        store.setScannerTarget(null)
      }
      store.setScannerScanProgress(0)
    }

    const journey = useJourneyStore.getState()
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
    const historicalLocked = Boolean(store.historicalExplanationId)
    const discovered = Boolean(progress?.discovered)
    const canScanComponent =
      Boolean(save) &&
      Boolean(componentId) &&
      discovered &&
      !historicalLocked &&
      store.scannerTriggerHeld &&
      !alreadyScanned
    const canScanEnvironmental =
      Boolean(save) &&
      Boolean(validEnvironmentalId) &&
      store.scannerTriggerHeld &&
      !environmentalDetailedDone

    if (canScanComponent && componentId) {
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
