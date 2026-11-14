export interface MoveVector {
  x: number
  z: number
}

export interface MoveAxes {
  x: number
  y: number
}

const MOVEMENT_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
])

const INTERACT_KEY = 'e'
const BOOT_KEY = ' '
const RUN_KEY = 'shift'
const SCANNER_KEY = 'q'

const pressed = new Set<string>()
const touchAxes: MoveAxes = { x: 0, y: 0 }
let touchBoot = false
let touchRun = false
let interactQueued = false
let scannerToggleQueued = false
let scannerLensKeyQueued: string | null = null

/** Normalizes a 2D movement vector so diagonals are not faster. */
export function normalizeMoveVector(x: number, z: number): MoveVector {
  const length = Math.hypot(x, z)
  if (length < 1e-6) return { x: 0, z: 0 }
  return { x: x / length, z: z / length }
}

/**
 * Clamps a movement vector to the unit circle while preserving analog input.
 * Keyboard diagonals become unit length; a partially tilted joystick stays
 * slower than a fully tilted one.
 */
export function clampMoveVector(x: number, z: number): MoveVector {
  const length = Math.hypot(x, z)
  if (length < 1e-6) return { x: 0, z: 0 }
  if (length <= 1) return { x, z }
  return { x: x / length, z: z / length }
}

/** Writes the touch joystick axes into the shared input state. */
export function setTouchMove(x: number, y: number): void {
  touchAxes.x = Math.min(1, Math.max(-1, x))
  touchAxes.y = Math.min(1, Math.max(-1, y))
}

/** Writes the touch jet-boot button (hold) into the shared input state. */
export function setTouchBoot(held: boolean): void {
  touchBoot = held
}

/** Writes the touch full-tilt run flag into the shared input state. */
export function setTouchRun(run: boolean): void {
  touchRun = run
}

/** True while Space (or the touch button) is held — edge/hold handled by physics. */
export function isBootHeld(): boolean {
  return pressed.has(BOOT_KEY) || touchBoot
}

/** True while Shift (or a full-tilt touch pad) requests running. */
export function isRunHeld(): boolean {
  return pressed.has(RUN_KEY) || touchRun
}

/** True once per E press. Consumed by the contextual interaction system. */
export function consumeInteract(): boolean {
  if (!interactQueued) return false
  interactQueued = false
  return true
}

/** True once per Q press. Toggles the physical Cosmic Scanner. */
export function consumeScannerToggle(): boolean {
  if (!scannerToggleQueued) return false
  scannerToggleQueued = false
  return true
}

/** The queued lens key ('1' | '2' | '3'), consumed once, or null. */
export function consumeScannerLensKey(): string | null {
  const key = scannerLensKeyQueued
  scannerLensKeyQueued = null
  return key
}

/**
 * Reads keyboard and touch input as camera-relative axes: x is right, y is
 * forward. Values stay inside the unit circle so touch input can be analog.
 */
export function readMoveAxes(out: MoveAxes): MoveAxes {
  const right =
    (pressed.has('d') || pressed.has('arrowright') ? 1 : 0) -
    (pressed.has('a') || pressed.has('arrowleft') ? 1 : 0)
  const forward =
    (pressed.has('w') || pressed.has('arrowup') ? 1 : 0) -
    (pressed.has('s') || pressed.has('arrowdown') ? 1 : 0)
  const clamped = clampMoveVector(right + touchAxes.x, forward + touchAxes.y)
  out.x = clamped.x
  out.y = clamped.z
  return out
}

/**
 * Reads keyboard input into a normalized world-space vector. Forward (W) points
 * toward negative Z, matching the default Three.js camera orientation.
 */
export function readMoveVector(out: MoveVector): MoveVector {
  const right =
    (pressed.has('d') || pressed.has('arrowright') ? 1 : 0) -
    (pressed.has('a') || pressed.has('arrowleft') ? 1 : 0)
  const forward =
    (pressed.has('w') || pressed.has('arrowup') ? 1 : 0) -
    (pressed.has('s') || pressed.has('arrowdown') ? 1 : 0)
  const normalized = normalizeMoveVector(right, -forward)
  out.x = normalized.x
  out.z = normalized.z
  return out
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function clearInput(): void {
  pressed.clear()
  touchAxes.x = 0
  touchAxes.y = 0
  touchBoot = false
  touchRun = false
  interactQueued = false
  scannerToggleQueued = false
  scannerLensKeyQueued = null
}

/** Attaches keyboard listeners once. Returns a cleanup function. */
export function attachInput(isPaused: () => boolean = () => false): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isPaused()) return
    if (isTypingTarget(event.target)) return
    const key = event.key.toLowerCase()

    if (key === INTERACT_KEY) {
      if (!event.repeat) interactQueued = true
      return
    }

    if (key === SCANNER_KEY) {
      if (!event.repeat) scannerToggleQueued = true
      event.preventDefault()
      return
    }

    if (key === '1' || key === '2' || key === '3') {
      if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        scannerLensKeyQueued = key
      }
      return
    }

    if (key === BOOT_KEY || key === RUN_KEY) {
      pressed.add(key)
      event.preventDefault()
      return
    }

    if (!MOVEMENT_KEYS.has(key)) return
    pressed.add(key)
    event.preventDefault()
  }

  const onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    if (MOVEMENT_KEYS.has(key) || key === BOOT_KEY || key === RUN_KEY) pressed.delete(key)
  }

  const onBlur = () => clearInput()
  const onVisibilityChange = () => {
    if (document.hidden) clearInput()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    clearInput()
  }
}
