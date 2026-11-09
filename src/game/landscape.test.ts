import { describe, expect, it } from 'vitest'
import { buildMesaGeometry, buildRockGeometry, ROCK_FORMATIONS } from './landscape'
import { CAMERA, WORLD } from './worldConfig'

describe('stylized landscape', () => {
  it('creates deterministic erosion with finite attributes and a broad top', () => {
    const first = buildMesaGeometry(0x5e7a)
    const second = buildMesaGeometry(0x5e7a)
    for (const name of ['position', 'normal', 'color']) {
      const attribute = first.getAttribute(name)
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
      expect(attribute.array).toEqual(second.getAttribute(name).array)
    }
    const position = first.getAttribute('position')
    const normal = first.getAttribute('normal')
    let topWidth = 0
    let topFaces = 0
    for (let index = 0; index < position.count; index += 1) {
      if (position.getY(index) > 0.97) {
        topWidth = Math.max(topWidth, Math.hypot(position.getX(index), position.getZ(index)))
        if (normal.getY(index) > 0.8) topFaces += 1
      }
    }
    expect(topWidth).toBeGreaterThan(0.45)
    expect(topFaces).toBeGreaterThan(12)
    expect(position.count / 3).toBeLessThan(200)
    first.dispose()
    second.dispose()
  })

  it('keeps large formations clear of the entire playable camera envelope', () => {
    const geometries = [0x5e7a, 0x6f8b, 0x709c].map(buildMesaGeometry)
    for (const formation of ROCK_FORMATIONS) {
      const position = geometries[formation.variant].getAttribute('position')
      let bound = 0
      for (let index = 0; index < position.count; index += 1) {
        bound = Math.max(bound, Math.hypot(position.getX(index) * formation.width, position.getZ(index) * formation.depth))
      }
      expect(Math.hypot(formation.x, formation.z) - bound).toBeGreaterThan(WORLD.playRadius + CAMERA.maxDistance)
    }
    geometries.forEach((geometry) => geometry.dispose())
  })

  it('uses distinct low-poly rock shapes without invalid normals', () => {
    const geometries = [0, 1, 2].map(buildRockGeometry)
    const counts = geometries.map((geometry) => geometry.getAttribute('position').count)
    expect(new Set(counts).size).toBe(3)
    for (const geometry of geometries) {
      expect(Array.from(geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true)
      geometry.dispose()
    }
  })
})
