/**
 * Pointer state for the physical scanner. Mouse moves update the real
 * screen position; touch keeps the reticle centred and relies on the
 * existing camera drag. This module is mutable and does not trigger
 * React renders on every mouse move.
 */
export type ScannerPointerMode = 'pointer' | 'center'

export interface ScannerPointerState {
  mode: ScannerPointerMode
  clientX: number
  clientY: number
}

export const scannerPointer: ScannerPointerState = {
  mode: 'center',
  clientX: 0,
  clientY: 0,
}

export function setScannerPointer(clientX: number, clientY: number): void {
  scannerPointer.mode = 'pointer'
  scannerPointer.clientX = clientX
  scannerPointer.clientY = clientY
}

export function setScannerPointerCenter(): void {
  scannerPointer.mode = 'center'
}

export interface CanvasRect {
  left: number
  top: number
  width: number
  height: number
}

function clampNdc(value: number): number {
  return Math.min(1, Math.max(-1, value))
}

/**
 * Converts viewport/client coordinates into Three.js NDC using the real
 * canvas rectangle. This keeps cursor and raycast aligned after resize,
 * scrolling or canvas scaling.
 */
export function clientToNdc(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  return {
    x: clampNdc(((clientX - rect.left) / rect.width) * 2 - 1),
    y: clampNdc(-((clientY - rect.top) / rect.height) * 2 + 1),
  }
}
