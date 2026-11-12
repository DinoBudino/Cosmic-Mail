import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  clientToNdc,
  scannerPointer,
  setScannerPointer,
  setScannerPointerCenter,
} from './scannerPointer'

const RECT = { left: 100, top: 50, width: 800, height: 600 }

describe('scanner pointer', () => {
  beforeEach(() => setScannerPointerCenter())

  it('maps the canvas centre to NDC zero', () => {
    expect(clientToNdc(500, 350, RECT)).toEqual({ x: 0, y: 0 })
  })

  it('maps the corners to NDC bounds', () => {
    expect(clientToNdc(100, 50, RECT)).toEqual({ x: -1, y: 1 })
    expect(clientToNdc(900, 650, RECT)).toEqual({ x: 1, y: -1 })
  })

  it('uses the real canvas offset, not the viewport origin', () => {
    expect(clientToNdc(300, 200, RECT)).toEqual({ x: -0.5, y: 0.5 })
  })

  it('clamps points outside the canvas', () => {
    expect(clientToNdc(0, 0, RECT)).toEqual({ x: -1, y: 1 })
    expect(clientToNdc(1200, 900, RECT)).toEqual({ x: 1, y: -1 })
  })

  it('records mouse and centre modes', () => {
    setScannerPointer(420, 240)
    expect(scannerPointer).toMatchObject({
      mode: 'pointer',
      clientX: 420,
      clientY: 240,
    })
    setScannerPointerCenter()
    expect(scannerPointer.mode).toBe('center')
  })
})

function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 100)
  camera.position.set(0, 0, 0)
  camera.lookAt(0, 0, -1)
  camera.updateMatrixWorld()
  return camera
}

function raycastPlane(
  camera: THREE.PerspectiveCamera,
  clientX: number,
  clientY: number,
) {
  const ndc = clientToNdc(clientX, clientY, RECT)
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera)
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial(),
  )
  plane.position.set(0, 0, -10)
  plane.updateMatrixWorld()
  const point = raycaster.intersectObject(plane, false)[0]?.point ?? null
  plane.geometry.dispose()
  ;(plane.material as THREE.Material).dispose()
  return { ndc, point }
}

describe('cursor raycast alignment', () => {
  it('fires the ray from the real mouse position, not the centre', () => {
    const camera = createCamera()
    const centre = raycastPlane(camera, 500, 350)
    const right = raycastPlane(camera, 700, 350)
    const up = raycastPlane(camera, 500, 150)

    expect(centre.point?.x).toBeCloseTo(0, 5)
    expect(centre.point?.y).toBeCloseTo(0, 5)
    expect(right.point!.x).toBeGreaterThan(0.5)
    expect(right.point!.y).toBeCloseTo(0, 5)
    expect(up.point!.y).toBeGreaterThan(0.5)
  })

  it('keeps cursor and hit point aligned after the camera moves', () => {
    const camera = createCamera()
    const before = raycastPlane(camera, 640, 300)

    camera.position.set(3, 2, 1)
    camera.lookAt(0, 0, -5)
    camera.updateMatrixWorld()
    const after = raycastPlane(camera, 640, 300)

    expect(after.point).not.toBeNull()
    expect(after.point!.distanceTo(before.point!)).toBeGreaterThan(0.1)

    // Projecting the world hit back to NDC returns the same cursor point.
    const projected = after.point!.clone().project(camera)
    expect(projected.x).toBeCloseTo(after.ndc.x, 5)
    expect(projected.y).toBeCloseTo(after.ndc.y, 5)
  })

  it('changes the world target when only the cursor moves', () => {
    const camera = createCamera()
    const first = raycastPlane(camera, 300, 350)
    const second = raycastPlane(camera, 800, 350)
    expect(first.point!.distanceTo(second.point!)).toBeGreaterThan(1)
  })
})
