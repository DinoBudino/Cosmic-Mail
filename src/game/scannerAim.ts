/**
 * Ephemeral aim point shared by the pointer raycast and the astronaut
 * arm pose. It is intentionally outside Zustand: it changes every frame
 * and must not trigger React renders.
 */
export interface ScannerAimState {
  x: number
  y: number
  z: number
  valid: boolean
}

export const scannerAim: ScannerAimState = {
  x: 0,
  y: 0,
  z: 0,
  valid: false,
}

export function setScannerAim(x: number, y: number, z: number): void {
  scannerAim.x = x
  scannerAim.y = y
  scannerAim.z = z
  scannerAim.valid = true
}

export function clearScannerAim(): void {
  scannerAim.valid = false
}

export interface AimDirection {
  x: number
  y: number
  z: number
}

/**
 * Keeps the procedural right-arm aim inside a plausible forward/right
 * cone. The beam still reaches the exact target; only the device/arm
 * orientation is clamped to avoid impossible shoulder twists.
 */
export function clampAimDirection(
  direction: AimDirection,
  forwardYaw: number,
  minYaw: number,
  maxYaw: number,
  minY: number,
  maxY: number,
): AimDirection {
  const forwardX = -Math.sin(forwardYaw)
  const forwardZ = -Math.cos(forwardYaw)
  const rightX = Math.cos(forwardYaw)
  const rightZ = -Math.sin(forwardYaw)

  const forwardDot = direction.x * forwardX + direction.z * forwardZ
  const rightDot = direction.x * rightX + direction.z * rightZ
  const yaw = Math.atan2(rightDot, forwardDot)
  const clampedYaw = Math.min(maxYaw, Math.max(minYaw, yaw))
  const cos = Math.cos(clampedYaw)
  const sin = Math.sin(clampedYaw)

  direction.x = forwardX * cos + rightX * sin
  direction.z = forwardZ * cos + rightZ * sin
  direction.y = Math.min(maxY, Math.max(minY, direction.y))

  const length = Math.hypot(direction.x, direction.y, direction.z)
  if (length < 1e-6) {
    direction.x = forwardX
    direction.y = 0
    direction.z = forwardZ
  } else {
    direction.x /= length
    direction.y /= length
    direction.z /= length
  }
  return direction
}
