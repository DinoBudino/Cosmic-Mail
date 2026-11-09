/**
 * Personalization data for the explorer discovery ritual.
 *
 * Content only — no React, no rendering. Aligned with the team design
 * document "Flujo Cartero Cósmico": five traits, two historical
 * explorers per trait, and the four mission items with their real-world
 * NASA inspirations. Historical profiles use widely verified facts; avoid
 * dates or claims that would need a fresh source check before publishing.
 */

export type TraitId = 'brave' | 'observant' | 'methodical' | 'careful' | 'reflective'

export interface Trait {
  id: TraitId
  name: string
  sigil: string
  description: string
  pipLine: string
}

export const TRAITS: readonly Trait[] = [
  {
    id: 'brave',
    name: 'Brave Explorer',
    sigil: '🔥',
    description: 'You take a step forward even when the path feels unknown.',
    pipLine: 'The stars shine brighter when you are brave. You are a Brave Explorer!',
  },
  {
    id: 'observant',
    name: 'Observant Explorer',
    sigil: '🔍',
    description: 'You notice what others walk past and learn from it.',
    pipLine: 'The stars twinkle when you watch closely. You are an Observant Explorer!',
  },
  {
    id: 'methodical',
    name: 'Methodical Explorer',
    sigil: '📋',
    description: 'You follow a plan step by step and finish what you start.',
    pipLine: 'The stars line up in order for you. You are a Methodical Explorer!',
  },
  {
    id: 'careful',
    name: 'Careful Explorer',
    sigil: '🛡️',
    description: 'You double-check, protect your crew and never rush a rescue.',
    pipLine: 'The stars feel safe near you. You are a Careful Explorer!',
  },
  {
    id: 'reflective',
    name: 'Reflective Explorer',
    sigil: '🤔',
    description: 'You think deeply about what things mean and why they matter.',
    pipLine: 'The stars wonder with you. You are a Reflective Explorer!',
  },
]

export const TRAIT_ORDER: readonly TraitId[] = [
  'brave',
  'observant',
  'methodical',
  'careful',
  'reflective',
]

export function getTrait(id: TraitId): Trait {
  const trait = TRAITS.find((entry) => entry.id === id)
  if (!trait) throw new Error(`Unknown trait: ${id}`)
  return trait
}

/* ------------------------------------------------------------------ */
/* Questions — hypothetical scenarios, one answer per trait            */
/* ------------------------------------------------------------------ */

export interface QuestionChoice {
  id: string
  /** The action the explorer would take. */
  title: string
  /** Short supporting line shown next to the action on the tablet. */
  hint: string
  trait: TraitId
}

export interface DiscoveryQuestion {
  id: string
  section: string
  /** PIP's spoken lead-in line before asking the question. */
  pipIntro: string
  question: string
  choices: readonly QuestionChoice[]
}

export const DISCOVERY_QUESTIONS: readonly DiscoveryQuestion[] = [
  {
    id: 'wonder',
    section: 'First wonder',
    pipIntro: 'Welcome aboard! Quick check before we fly.',
    question: 'You open your eyes on a quiet night sky. What calls you first?',
    choices: [
      { id: 'wonder-path', title: 'Follow the dark path', hint: 'You want to see where it leads.', trait: 'brave' },
      { id: 'wonder-stars', title: 'Watch the brightest star', hint: 'You study how it twinkles and why.', trait: 'observant' },
      { id: 'wonder-plan', title: 'Chart a route first', hint: 'You sketch the way before moving.', trait: 'methodical' },
      { id: 'wonder-check', title: 'Check my gear first', hint: 'First you make sure everything is safe.', trait: 'careful' },
      { id: 'wonder-meaning', title: 'Ask the big why', hint: 'You wonder what it all means.', trait: 'reflective' },
    ],
  },
  {
    id: 'mystery',
    section: 'A small mystery',
    pipIntro: 'Something strange is under our feet.',
    question: 'You find a tiny door on Mars that was not there before. What do you do?',
    choices: [
      { id: 'mystery-open', title: 'Open the door slowly', hint: 'Your heart beats, but you go ahead.', trait: 'brave' },
      { id: 'mystery-clues', title: 'Hunt for clues', hint: 'Footprints, scratches, a hidden key…', trait: 'observant' },
      { id: 'mystery-steps', title: 'Follow the steps in order', hint: 'One safe step at a time, in order.', trait: 'methodical' },
      { id: 'mystery-protect', title: 'Stand guard first', hint: 'You check the door is safe to touch.', trait: 'careful' },
      { id: 'mystery-think', title: 'Think it over first', hint: 'You sit and wonder who built it.', trait: 'reflective' },
    ],
  },
  {
    id: 'friend',
    section: 'A new friend',
    pipIntro: 'Friends make every mission brighter, do not you think?',
    question: 'A little robot is lost and cannot find its way home. What do you do?',
    choices: [
      { id: 'friend-guide', title: 'Guide it home', hint: 'Step by step, until it is safe.', trait: 'brave' },
      { id: 'friend-signal', title: 'Decode its signal', hint: 'Its beeps hide a clever message.', trait: 'observant' },
      { id: 'friend-route', title: 'Plan the route home', hint: 'You draw it out, stop by stop.', trait: 'methodical' },
      { id: 'friend-hug', title: 'Cheer it up gently', hint: 'A warm hello can fix a sad day.', trait: 'careful' },
      { id: 'friend-story', title: 'Ask for its story', hint: 'You wonder where it came from.', trait: 'reflective' },
    ],
  },
  {
    id: 'dream',
    section: 'Your dream',
    pipIntro: 'One last light, then the stars will show us something special.',
    question: 'At the end of the mission, what would make you smile most?',
    choices: [
      { id: 'dream-first', title: 'Be the first', hint: 'Doing something nobody has done.', trait: 'brave' },
      { id: 'dream-secret', title: 'Find a secret', hint: 'Something nobody knew before.', trait: 'observant' },
      { id: 'dream-invention', title: 'Make the plan work', hint: 'Every step in its place, mission complete.', trait: 'methodical' },
      { id: 'dream-letter', title: 'Deliver a special letter', hint: 'Words that make someone feel loved.', trait: 'careful' },
      { id: 'dream-meaning', title: 'Understand it all', hint: 'Knowing why the journey mattered.', trait: 'reflective' },
    ],
  },
]

/**
 * Pick the trait with the most answers. Ties are broken by the fixed
 * TRAIT_ORDER so results are deterministic and testable.
 */
export function computeTrait(answers: readonly TraitId[]): TraitId {
  const scores: Record<TraitId, number> = {
    brave: 0,
    observant: 0,
    methodical: 0,
    careful: 0,
    reflective: 0,
  }
  for (const answer of answers) scores[answer] += 1
  let best: TraitId = TRAIT_ORDER[0]
  for (const id of TRAIT_ORDER) {
    if (scores[id] > scores[best]) best = id
  }
  return best
}

/* ------------------------------------------------------------------ */
/* Historical explorers — two per trait                                */
/* ------------------------------------------------------------------ */

export interface HistoricalExplorer {
  id: string
  name: string
  trait: TraitId
  bio: string
  accent: string
}

export const HISTORICAL_EXPLORERS: readonly HistoricalExplorer[] = [
  {
    id: 'valentina-tereshkova',
    name: 'Valentina Tereshkova',
    trait: 'brave',
    bio: 'The first woman in space. In 1963 she orbited Earth alone aboard Vostok 6, spending almost three days in space on her historic flight.',
    accent: '#f4b4df',
  },
  {
    id: 'sally-ride',
    name: 'Sally Ride',
    trait: 'brave',
    bio: 'The first American woman in space in 1983. After her flights she became a science teacher who inspired thousands of children to explore.',
    accent: '#b8a6d9',
  },
  {
    id: 'mae-jemison',
    name: 'Mae Jemison',
    trait: 'observant',
    bio: 'A doctor and astronaut who became the first African American woman in space in 1992. She studied how bodies behave in zero gravity aboard the Space Shuttle Endeavour.',
    accent: '#f2b28c',
  },
  {
    id: 'chris-hadfield',
    name: 'Chris Hadfield',
    trait: 'observant',
    bio: 'A Canadian astronaut who commanded the International Space Station. He photographed Earth from orbit and shared how our planet looks from space with the whole world.',
    accent: '#ffd9a8',
  },
  {
    id: 'katherine-johnson',
    name: 'Katherine Johnson',
    trait: 'methodical',
    bio: 'A NASA mathematician who calculated trajectories for spaceflights, including John Glenn’s orbit around Earth. Her precise numbers helped astronauts fly safely.',
    accent: '#ffd9a8',
  },
  {
    id: 'margaret-hamilton',
    name: 'Margaret Hamilton',
    trait: 'methodical',
    bio: 'A computer scientist who led the team that wrote the software for the Apollo Guidance Computer. She helped give us the term “software engineering”.',
    accent: '#f2b28c',
  },
  {
    id: 'gene-kranz',
    name: 'Gene Kranz',
    trait: 'careful',
    bio: 'A NASA flight director who led mission teams through the Apollo program, including the safe return of Apollo 13. His careful planning kept crews safe far from home.',
    accent: '#b8a6d9',
  },
  {
    id: 'michael-collins',
    name: 'Michael Collins',
    trait: 'careful',
    bio: 'The Apollo 11 command module pilot who orbited the Moon alone while his crewmates landed. His careful flying brought everyone home safely.',
    accent: '#f4b4df',
  },
  {
    id: 'carl-sagan',
    name: 'Carl Sagan',
    trait: 'reflective',
    bio: 'An astronomer and writer who thought deeply about humanity’s place in the universe. He inspired the famous “Pale Blue Dot” photograph of Earth from far away.',
    accent: '#f2b28c',
  },
  {
    id: 'edgar-mitchell',
    name: 'Edgar Mitchell',
    trait: 'reflective',
    bio: 'An Apollo 14 astronaut who walked on the Moon and, looking back at Earth from deep space, reflected on how connected everything in the universe is.',
    accent: '#ffd9a8',
  },
]

export function explorersForTrait(trait: TraitId): readonly HistoricalExplorer[] {
  return HISTORICAL_EXPLORERS.filter((entry) => entry.trait === trait)
}

export function getExplorer(id: string): HistoricalExplorer {
  const explorer = HISTORICAL_EXPLORERS.find((entry) => entry.id === id)
  if (!explorer) throw new Error(`Unknown explorer: ${id}`)
  return explorer
}

/* ------------------------------------------------------------------ */
/* Mission modules (first item) — from the design document             */
/* ------------------------------------------------------------------ */

export interface MissionModule {
  id: string
  name: string
  /** Hologram glyph shown on the tablet. */
  glyph: string
  ability: string
  inspiration: string
  accent: string
}

export const MISSION_MODULES: readonly MissionModule[] = [
  {
    id: 'meteor-shield',
    glyph: '🛡️',
    name: 'Meteor Shield',
    ability: 'Survive one slip without starting over.',
    inspiration: 'Inspired by Whipple shields, the protective layers that guard spacecraft from tiny meteor hits.',
    accent: '#ffd9a8',
  },
  {
    id: 'explorer-visor',
    glyph: '🔭',
    name: 'Explorer Visor',
    ability: 'Highlights the path and the key point ahead.',
    inspiration: 'Inspired by the cameras and sensors that help rovers spot what matters on alien ground.',
    accent: '#f4b4df',
  },
  {
    id: 'wrist-checklist',
    glyph: '📋',
    name: 'Wrist Checklist',
    ability: 'Shows your mission plan step by step.',
    inspiration: 'Inspired by the checklists Apollo astronauts wore strapped to their wrists.',
    accent: '#f2b28c',
  },
  {
    id: 'mission-clock',
    glyph: '⏱️',
    name: 'Mission Clock',
    ability: 'Slows danger down so you can pause and think.',
    inspiration: 'Inspired by the mission timers that help space crews plan every second of a flight.',
    accent: '#b8a6d9',
  },
]

export function getModule(id: string): MissionModule {
  const module = MISSION_MODULES.find((entry) => entry.id === id)
  if (!module) throw new Error(`Unknown module: ${id}`)
  return module
}

/* ------------------------------------------------------------------ */
/* Validation helpers                                                  */
/* ------------------------------------------------------------------ */

export const MAX_NAME_LENGTH = 20

export function sanitizeExplorerName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH)
}

export function isValidExplorerName(raw: string): boolean {
  return sanitizeExplorerName(raw).length >= 2
}

export const STAMP_SLOTS = 12
export const MODULE_SLOTS = 4
