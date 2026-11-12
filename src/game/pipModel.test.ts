/// <reference types="node" />
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PIP_ASSET_URL } from './HubPipModel'

describe('official PIP Blender asset', () => {
  it('ships the Retro Space Post GLB used by Companion and the hub', () => {
    const file = join(process.cwd(), 'public', PIP_ASSET_URL)
    expect(existsSync(file), file).toBe(true)
    expect(statSync(file).size).toBeGreaterThan(100_000)
  })

  it('keeps the editable Blender master in the repository', () => {
    const blend = join(
      process.cwd(),
      'blender',
      'PIP',
      'PIP_RetroSpacePost.blend',
    )
    expect(existsSync(blend), blend).toBe(true)
  })
})
