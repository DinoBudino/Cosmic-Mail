import * as THREE from 'three'
import { isWorldPaused } from '../store/gameStore'
import { isTypingTarget } from './input'
import { CAMERA } from './worldConfig'

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
  orbit.yaw -= dx * CAMERA.orbitSensitivity
  orbit.yaw = Math.atan2(Math.sin(orbit.yaw), Math.cos(orbit.yaw))
  orbit.pitch = clamp(
    orbit.pitch + dy * CAMERA.orbitSensitivity,
    CAMERA.minPitch,
    CAMERA.maxPitch,
  )
}

export function zoomOrbit(delta: number): void {
  orbit.distance = clamp(
    orbit.distance + delta,
    CAMERA.minDistance,
    CAMERA.maxDistance,
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
 * Attaches pointer, wheel, pinch and recenter input to the WebGL canvas.
 * Dragging rotates the orbit; scrolling or pinching changes distance.
 */
export function attachCameraControls(element: HTMLElement): () => void {
  const pointers = new Map<number, { x: number; y: number }>()
  let dragging = false
  let lastX = 0
  let lastY = 0
  let pinchDistance = 0

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
  }

  const onPointerDown = (event: PointerEvent) => {
    if (isPaused()) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

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
    if (isPaused()) return
    event.preventDefault()
    zoomOrbit(event.deltaY * CAMERA.zoomSensitivity)
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
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    clearPointers()
  }
}
