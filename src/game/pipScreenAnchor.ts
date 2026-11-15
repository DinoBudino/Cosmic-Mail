/**
 * PIP's position on screen (CSS px, viewport space), written by the
 * companion every frame. The speech box reads it to sit beside PIP at the
 * scan station. A plain mutable object: no React state, no re-renders.
 */
export const pipScreenAnchor = {
  x: 0,
  y: 0,
  /** PIP is in front of the camera and inside the view. */
  visible: false,
}
