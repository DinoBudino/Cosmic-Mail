import { MAILWING_LANDING } from '../data/spiritSite'
import type { WorldPosition } from '../data/marsObjects'
import type { JourneySave } from '../store/journeySchema'
import { useGameStore } from '../store/gameStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { emitAudio } from './audio/audioEvents'
import { stopPipVoice } from './pipVoice'
import { PLAYER } from './worldConfig'

export function distanceToShip(position: WorldPosition): number {
  return Math.hypot(
    position.x - MAILWING_LANDING.position.x,
    position.z - MAILWING_LANDING.position.z,
  )
}

export function isNearShip(position: WorldPosition): boolean {
  return distanceToShip(position) <= MAILWING_LANDING.boardRadius
}

/** Boarding opens once the letter is sealed (and stays open after). */
export function canBoardShip(
  save: JourneySave | null,
  missionId: keyof JourneySave['missions'],
): boolean {
  const progress = save?.missions[missionId]
  return progress?.smartLetterCreatedAt != null || progress?.transmittedAt != null
}

/** Keeps the player outside the landed ship's legs. Mutates x/z. */
export function resolveShipCollision(position: WorldPosition): void {
  const { x, z } = MAILWING_LANDING.position
  const dx = position.x - x
  const dz = position.z - z
  const distance = Math.hypot(dx, dz)
  const minimum = MAILWING_LANDING.collisionRadius + PLAYER.radius
  if (distance >= minimum) return
  if (distance < 1e-4) {
    position.x = x + minimum
    return
  }
  position.x = x + (dx / distance) * minimum
  position.z = z + (dz / distance) * minimum
}

/** Climb aboard: the ship lifts back to Mars orbit with the letter. */
export function boardShip(): void {
  const game = useGameStore.getState()
  if (game.archiveView !== 'none') game.closeArchive()
  if (game.scannerEquipped) game.unequipScanner()
  game.setScanStation(false)
  game.setNearbyShip(false)
  stopPipVoice()
  emitAudio('uiConfirm')
  useOnboardingStore.getState().returnToOrbit()
}
