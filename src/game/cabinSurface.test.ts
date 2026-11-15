import { describe, expect, it } from 'vitest'
import { CABIN_SURFACES, NOISE_SIZE, cabinNoiseTexture, surfaceDefines } from './cabinSurface'

describe('cabin surface', () => {
  it('builds one shared, tiling noise lattice', () => {
    const texture = cabinNoiseTexture()
    expect(cabinNoiseTexture()).toBe(texture)
    const data = texture.image.data as Uint8Array
    expect(data.length).toBe(NOISE_SIZE ** 3)
    // Real noise: values spread over the whole byte range.
    const mean = data.reduce((sum, value) => sum + value, 0) / data.length
    expect(mean).toBeGreaterThan(110)
    expect(mean).toBeLessThan(145)
  })

  it('compiles out features a preset does not use', () => {
    const floor = surfaceDefines(CABIN_SURFACES.CM_FLOOR!)
    expect(floor).toContain('#define CM_PLATE')
    expect(floor).not.toContain('CM_PANELS')
    const hull = surfaceDefines(CABIN_SURFACES.CM_PANEL_WHITE!)
    expect(hull).toContain('#define CM_PANELS 1.0')
    expect(hull).not.toContain('CM_STREAKS')
  })
})
