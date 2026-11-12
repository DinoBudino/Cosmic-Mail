import * as THREE from 'three'
import { isWorldPaused, useGameStore } from '../store/gameStore'
import { isTypingTarget } from './input'
import { setScannerPointer } from './scannerPointer'
import { CAMERA, SCANNER } from './worldConfig'

export interface OrbitState {
  yaw: number
  pitch: number
  distance: number
}

const DEFAULT_ORBIT: OrbitState = {
  yaw: 0,
  pitch: CAMERA.pitch,
  distance: CAMERA.distance,
}

const orbit: OrbitState = { ...DEFAULT_ORBIT }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getOrbit(): Readonly<OrbitState> {
  return orbit
}

export function resetOrbit(): void {
  orbit.yaw = DEFAULT_ORBIT.yaw
  orbit.pitch = DEFAULT_ORBIT.pitch
  orbit.distance = DEFAULT_ORBIT.distance
}

export function applyOrbitDelta(dx: number, dy: number): void {
  const store = useGameStore.getState()
  const firstPerson =
    store.scannerEquipped && store.scannerCamera === 'first-person'
  orbit.yaw -= dx * CAMERA.orbitSensitivity
  orbit.yaw = Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw))
  orbit.pitch = clamp(
    orbit.pitch + dy * CAMERA.orbitSensitivity,
    firstPerson ? SCANNER.firstPersonPitchMin : CAMERA.minPitch,
    firstPerson ? SCANNER.firstPersonPitchMax : CAMERA.maxPitch,
  )
}

export function zoomOrbit(delta: number): void {
  orbit.distance = clamp(
    orbit.distance + delta,
    CAMERA.minDistance,
    CAMERA.maxDistance,
  )
}

/** Keep the shared pitch valid when switching scanner camera modes. */
export function clampOrbitPitch(firstPerson: boolean): void {
  orbit.pitch = clamp(
    orbit.pitch,
    firstPerson ? SCANNER.firstPersonPitchMin : CAMERA.minPitch,
    firstPerson ? SCANNER.firstPersonPitchMax : CAMERA.maxPitch,
  )
}

/** Forward and right unit vectors on the XZ plane for camera-relative movement. */
export function getMovementBasis(
  forward: THREE.Vector2,
  right: THREE.Vector2,
): void {
  forward.set(-Math.sin(orbit.yaw), -Math.cos(orbit.yaw))
  right.set(-forward.y, forward.x)
}

/** Camera offset relative to the look target, respecting pitch and distance. */
export function computeCameraOffset(out: THREE.Vector3): THREE.Vector3 {
  const horizontal = Math.cos(orbit.pitch) * orbit.distance
  out.set(
    Math.sin(orbit.yaw) * horizontal,
    Math.sin(orbit.pitch) * orbit.distance,
    Math.cos(orbit.yaw) * horizontal,
  )
  return out
}

/**
 * Comfortable third-person offset while the scanner is held. It keeps
 * the normal orbit framing (player centred) and only moves slightly
 * closer than the exploration camera, so walking and mouse aiming stay
 * natural and the transition in/out is smooth.
 */
export function computeScannerCameraOffset(out: THREE.Vector3): THREE.Vector3 {
  const horizontal = Math.cos(orbit.pitch) * SCANNER.cameraDistance
  out.set(
    Math.sin(orbit.yaw) * horizontal,
    Math.sin(orbit.pitch) * SCANNER.cameraDistance,
    Math.cos(orbit.yaw) * horizontal,
  )
  return out
}

/**
 * Attaches pointer, wheel, pinch and recenter input to the WebGL canvas.
 * Dragging rotates the orbit; scrolling or pinching changes distance.
 */
export function attachCameraControls(element: HTMLElement): () => void {
  const pointers = new Map<number, { x: number; y: number }>()
  let dragging = false
  let lastX = 0
  let lastY = 0
  let pinchDistance = 0
  let aimPointerId: number | null = null

  const isPaused = isWorldPaused

  const pointerDistance = (): number => {
    const values = [...pointers.values()]
    const first = values[0]
    const second = values[1]
    if (!first || !second) return 0
    return Math.hypot(first.x - second.x, first.y - second.y)
  }

  const clearPointers = () => {
    pointers.clear()
    dragging = false
    pinchDistance = 0
    aimPointerId = null
  }

  const onPointerDown = (event: PointerEvent) => {
    if (isPaused()) return
    const store = useGameStore.getState()
    const scannerAiming = store.scannerEquipped
    const firstPerson =
      scannerAiming && store.scannerCamera === 'first-person'
    if (scannerAiming && !firstPerson && event.pointerType !== 'mouse') {
      // Touch dragging aims the physical scanner reticle directly. It
      // never starts a scan or an accidental camera orbit. In first
      // person the reticle is centred and drag becomes look input.
      if (aimPointerId !== null) return
      aimPointerId = event.pointerId
      element.setPointerCapture(event.pointerId)
      setScannerPointer(event.clientX, event.clientY)
      return
    }
    if (event.pointerType === 'mouse') {
      if (firstPerson && event.button === 0) {
        // Pointer Lock is the primary mouse-look path. The browser blocks
        // it in some contexts, so drag-to-look remains the fallback.
        void element.requestPointerLock?.()
      }
      // Left click is reserved for hold-to-scan while the device is
      // equipped; right-drag orbits the aim camera.
      if (scannerAiming ? event.button !== 2 : event.button !== 0) return
    }

    element.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.size === 1) {
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
    } else {
      dragging = false
      pinchDistance = pointerDistance()
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const store = useGameStore.getState()
    const firstPerson =
      store.scannerEquipped && store.scannerCamera === 'first-person'
    if (
      firstPerson &&
      document.pointerLockElement === element &&
      event.pointerType === 'mouse'
    ) {
      applyOrbitDelta(event.movementX, event.movementY)
      return
    }
    if (aimPointerId === event.pointerId) {
      if (isPaused() || !useGameStore.getState().scannerEquipped) return
      setScannerPointer(event.clientX, event.clientY)
      return
    }

    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (isPaused()) {
      clearPointers()
      return
    }

    if (pointers.size >= 2) {
      const nextDistance = pointerDistance()
      if (pinchDistance > 0 && nextDistance > 0) {
        zoomOrbit((pinchDistance - nextDistance) * CAMERA.pinchSensitivity)
      }
      pinchDistance = nextDistance
      return
    }

    if (!dragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    applyOrbitDelta(dx, dy)
  }

  const endPointer = (event: PointerEvent) => {
    if (aimPointerId === event.pointerId) {
      aimPointerId = null
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId)
      }
      return
    }

    pointers.delete(event.pointerId)
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId)
    }

    if (pointers.size === 0) {
      dragging = false
      pinchDistance = 0
    } else {
      pinchDistance = pointerDistance()
      const remaining = pointers.values().next().value
      if (pointers.size === 1 && remaining) {
        dragging = true
        lastX = remaining.x
        lastY = remaining.y
      }
    }
  }

  const onWheel = (event: WheelEvent) => {
    if (isPaused() || useGameStore.getState().scannerEquipped) return
    event.preventDefault()
    zoomOrbit(event.deltaY * CAMERA.zoomSensitivity)
  }

  const onContextMenu = (event: Event) => {
    if (!useGameStore.getState().scannerEquipped) return
    event.preventDefault()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (isPaused()) return
    if (isTypingTarget(event.target)) return
    if (event.key.toLowerCase() !== 'c') return
    event.preventDefault()
    resetOrbit()
  }

  const onBlur = () => clearPointers()
  const onVisibilityChange = () => {
    if (document.hidden) clearPointers()
  }

  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerup', endPointer)
  element.addEventListener('pointercancel', endPointer)
  element.addEventListener('lostpointercapture', endPointer)
  element.addEventListener('wheel', onWheel, { passive: false })
  element.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    element.removeEventListener('pointerdown', onPointerDown)
    element.removeEventListener('pointermove', onPointerMove)
    element.removeEventListener('pointerup', endPointer)
    element.removeEventListener('pointercancel', endPointer)
    element.removeEventListener('lostpointercapture', endPointer)
    element.removeEventListener('wheel', onWheel)
    element.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    clearPointers()
  }
}
