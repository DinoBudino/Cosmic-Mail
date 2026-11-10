import type { TraitId } from './personalization'

/**
 * Presentation metadata for the power each hero grants. These are
 * design proposals shown in the explorer phase — the challenge
 * mechanics themselves are not implemented yet, so the copy must stay
 * descriptive ("what this power will help you do"), never claiming an
 * active gameplay feature.
 *
 * One ability per trait; no extra state is persisted — the ability is
 * always derived from the current trait.
 */
export interface TraitAbility {
  id: string
  name: string
  /** One kid-friendly line, shown inside the hero card. */
  description: string
}

export const TRAIT_ABILITIES: Readonly<Record<TraitId, TraitAbility>> = {
  brave: {
    id: 'second-chance',
    name: 'Second Chance',
    description: 'Make one mistake without starting over.',
  },
  observant: {
    id: 'explorer-vision',
    name: 'Explorer Vision',
    description: 'Reveal important clues.',
  },
  methodical: {
    id: 'mission-plan',
    name: 'Mission Plan',
    description: 'Follow clear steps to solve challenges.',
  },
  careful: {
    id: 'safety-check',
    name: 'Safety Check',
    description: 'Spot a possible mistake before acting.',
  },
  reflective: {
    id: 'time-to-think',
    name: 'Time to Think',
    description: 'Slow down danger and pause to decide.',
  },
}

export function getTraitAbility(trait: TraitId): TraitAbility {
  return TRAIT_ABILITIES[trait]
}
