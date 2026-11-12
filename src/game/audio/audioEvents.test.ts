import { afterEach, describe, expect, it, vi } from 'vitest'
import { audioManager } from './audioManager'
import { EVENT_PLANS, emitAudio, emitFootstep } from './audioEvents'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('audio event plans', () => {
  it('maps fragment recovery to one archive confirmation and not a loop', () => {
    const play = vi.spyOn(audioManager, 'playSfx').mockImplementation(() => {})
    const loop = vi.spyOn(audioManager, 'startLoop').mockImplementation(() => {})
    emitAudio('archiveFragmentRecovered')
    expect(play.mock.calls.map(([id]) => id)).toEqual([
      'archive.fragment',
      'archive.fragmentIdentified',
      'scanner.fragment',
      'pip.discovery',
    ])
    expect(loop).not.toHaveBeenCalled()
  })

  it('starts and stops the correct beds for a scan', () => {
    const start = vi.spyOn(audioManager, 'startLoop').mockImplementation(() => {})
    const stop = vi.spyOn(audioManager, 'stopLoop').mockImplementation(() => {})
    emitAudio('scanStarted')
    expect(start).toHaveBeenCalledWith('scanner', 'scanner.loop', {
      volume: 0.8,
    })
    emitAudio('scanInterrupted')
    expect(stop).toHaveBeenCalledWith('scanner')
  })

  it('sequences the transmission completion after the send sound', () => {
    const play = vi.spyOn(audioManager, 'playSfx').mockImplementation(() => {})
    const music = vi.spyOn(audioManager, 'playMusic').mockResolvedValue()
    emitAudio('transmissionStarted')
    expect(play.mock.calls.map(([id]) => id)).toEqual([
      'transmission.start',
      'transmission.signal',
    ])

    play.mockClear()
    emitAudio('transmissionCompleted')
    expect(play.mock.calls.map(([id, options]) => [id, options?.delayMs])).toEqual([
      ['transmission.received', 1100],
      ['transmission.stamp', 1700],
      ['transmission.historyRestored', 2000],
    ])
    expect(music).toHaveBeenCalledWith('transmission')
  })

  it('routes launch beds without leaving engine loops behind', () => {
    const start = vi.spyOn(audioManager, 'startLoop').mockImplementation(() => {})
    const stop = vi.spyOn(audioManager, 'stopLoop').mockImplementation(() => {})
    emitAudio('launchStarted')
    expect(start).toHaveBeenCalledWith('enginePrep', 'ship.enginePrep', {
      volume: 0.8,
    })
    emitAudio('launchLiftoff')
    expect(stop).toHaveBeenCalledWith('enginePrep')
    expect(start).toHaveBeenCalledWith('propulsion', 'ship.propulsion', {
      volume: 0.7,
    })
    emitAudio('launchSkipped')
    expect(stop).toHaveBeenCalledWith('enginePrep')
    expect(stop).toHaveBeenCalledWith('propulsion')
  })

  it('picks a real footstep variant instead of a nonexistent file', () => {
    const play = vi.spyOn(audioManager, 'playSfx').mockImplementation(() => {})
    emitFootstep('rock', 0)
    emitFootstep('rock', 5)
    emitFootstep('lunar', 1)
    expect(play.mock.calls[0]?.[0]).toBe('player.footstepRock1')
    expect(play.mock.calls[1]?.[0]).toBe('player.footstepRock2')
    expect(play.mock.calls[2]?.[0]).toBe('player.footstepLunar2')
  })

  it('has a plan for every event and no duplicate one-shot per plan', () => {
    for (const [event, plan] of Object.entries(EVENT_PLANS)) {
      const ids = plan.sfx ?? []
      expect(new Set(ids).size, event).toBe(ids.length)
    }
  })
})
