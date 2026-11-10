/**
 * Personalization data for the explorer discovery ritual.
 *
 * Content only — no React, no rendering. Five powers, one historical
 * hero per power. The hero IS the power's real-world face; there is no
 * separate mission module. Historical profiles use widely verified
 * facts; avoid dates or claims that would need a fresh source check
 * before publishing.
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
 * Pick the trait with the most answers. Ties are broken by RECeNCY:
 * among the top-scoring traits, the one from the player's most
 * recent answer wins (so varied answers can reach any trait —
 * a fixed order would make the first trait win every tie).
 * Empty answers fall back to the first trait in TRAIT_ORDER.
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
  const max = Math.max(...TRAIT_ORDER.map((id) => scores[id]))
  if (max === 0) return TRAIT_ORDER[0]
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    const candidate = answers[index]!
    if (scores[candidate] === max) return candidate
  }
  return TRAIT_ORDER[0]
}

/* ------------------------------------------------------------------ */
/* Historical explorers — two per trait                                */
/* ------------------------------------------------------------------ */

export interface HistoricalExplorer {
  id: string
  name: string
  trait: TraitId
  /** Informative only: the hero's gender is shown on the card, never a filter. */
  gender: 'girl' | 'boy'
  /** Why this person represents their power, in one kid-friendly line. */
  bio: string
  /** PIP's restored memory line when the fragment is recovered. */
  memoryLine: string
  /** Short spoken version of `bio` for PIP's explorer-step line. */
  spokenBio: string
  /** Brief history line for PIP (recorded per hero). */
  meetLine: string
  /** How that history inspires the hero's power (recorded per hero). */
  powerLine: string
  accent: string
}

/**
 * PIP's cinematic introduction, shown before the Routine Check:
 * five narrative moments over these ten subtitle lines.
 * Premise (NASA Space Apps Challenge 2026 — "Abandoned but not Forgotten"):
 * NASA left machines across the Moon, Mars and deep space; when their
 * missions ended they fell silent. The child is the new Cosmic Mail
 * carrier who will visit them and deliver their letters so their
 * stories are heard again. Letters are a fictional storytelling device;
 * the machine facts linked from the sites are the real NASA record.
 * These lines are recorded (see pipVoice.ts cabin-intro-* keys) and
 * spoken by Intro.tsx as each subtitle appears.
 */
export const INTRO_LINES: readonly string[] = [
  "Hi! I'm PIP, your cabin buddy. Welcome aboard Cosmic Mail!",
  'Long ago, explorers traveled to the Moon, Mars, and far beyond.',
  "They were machines, sent to discover things humans couldn't see.",
  'Some of their missions have ended.',
  'But their stories are still out there, waiting to be remembered.',
  "That's where you come in!",
  "You'll travel across space and deliver letters to these forgotten explorers. Will you help me?",
  'Every explorer sees the universe in a different way.',
  "Before we begin, let's discover your explorer spirit.",
]

export type IntroMoment = 'welcome' | 'explorers' | 'forgotten' | 'invitation' | 'reflection'

/** Which cinematic moment a subtitle line belongs to (shared by the
 *  intro visuals in Intro.tsx and PIP's reactions in MenuScene). */
export function introMomentForLine(index: number): IntroMoment {
  if (index <= 0) return 'welcome'
  if (index <= 2) return 'explorers'
  if (index <= 4) return 'forgotten'
  if (index <= 6) return 'invitation'
  return 'reflection'
}

/**
 * One hero per power. The hero IS the power's real-world face: the
 * Routine Check assigns one, and recovering a memory fragment in Mars
 * restores another (see onboardingStore.collectMemory).
 */
export const HISTORICAL_EXPLORERS: readonly HistoricalExplorer[] = [
  {
    id: 'sally-ride',
    name: 'Sally Ride',
    trait: 'brave',
    gender: 'girl',
    bio: 'Sally Ride became the first American woman in space in 1983.',
    memoryLine: 'I became the first American woman in space in 1983.',
    spokenBio: 'She became the first woman in space in 1983',
    meetLine: 'Sally Ride became the first American woman in space in 1983.',
    powerLine: 'Her courage inspires Second Chance: make one mistake without starting over!',
    accent: '#f4b4df',
  },
  {
    id: 'mae-jemison',
    name: 'Mae Jemison',
    trait: 'observant',
    gender: 'girl',
    bio: 'Mae Jemison traveled into space in 1992. She was both a scientist and an astronaut.',
    memoryLine: 'I traveled into space in 1992 and studied how bodies behave in zero gravity.',
    spokenBio: 'She traveled into space in 1992',
    meetLine: 'Mae Jemison traveled into space in 1992. She was both a scientist and an astronaut.',
    powerLine: 'Her curiosity inspires Explorer Vision: reveal important clues!',
    accent: '#f2b28c',
  },
  {
    id: 'katherine-johnson',
    name: 'Katherine Johnson',
    trait: 'methodical',
    gender: 'girl',
    bio: 'Katherine Johnson used mathematics to calculate important spaceflight paths.',
    memoryLine: 'My careful calculations helped astronauts travel safely.',
    spokenBio: 'She used mathematics to calculate important spaceflight paths',
    meetLine: 'Katherine Johnson used mathematics to calculate important spaceflight paths.',
    powerLine: 'Her careful math inspires Mission Plan: follow clear steps to solve challenges!',
    accent: '#ffd9a8',
  },
  {
    id: 'margaret-hamilton',
    name: 'Margaret Hamilton',
    trait: 'careful',
    gender: 'girl',
    bio: 'Margaret Hamilton led a team that developed software for the Apollo missions.',
    memoryLine: 'I led a team that wrote software for the Apollo missions.',
    spokenBio: 'She led a team that developed software for the Apollo missions',
    meetLine: 'Margaret Hamilton led a team that developed software for the Apollo missions.',
    powerLine: 'Her attention to detail inspires Safety Check: spot a possible mistake before acting!',
    accent: '#b8a6d9',
  },
  {
    id: 'carl-sagan',
    name: 'Carl Sagan',
    trait: 'reflective',
    gender: 'boy',
    bio: 'Carl Sagan studied planets and inspired people to explore big questions about the universe.',
    memoryLine: 'I helped people ask big questions about the universe.',
    spokenBio: 'He studied planets and inspired people to ask big questions',
    meetLine: 'Carl Sagan studied planets and inspired people to explore big questions about the universe.',
    powerLine: 'His curiosity inspires Time to Think: slow down danger and pause to decide!',
    accent: '#f2b28c',
  },
]

export function explorersForTrait(trait: TraitId): readonly HistoricalExplorer[] {
  return HISTORICAL_EXPLORERS.filter((entry) => entry.trait === trait)
}

/** The single hero who represents a power (one hero per power). */
export function getHeroForTrait(trait: TraitId): HistoricalExplorer {
  const hero = HISTORICAL_EXPLORERS.find((entry) => entry.trait === trait)
  if (!hero) throw new Error(`No hero for trait: ${trait}`)
  return hero
}

export function getExplorer(id: string): HistoricalExplorer {
  const explorer = HISTORICAL_EXPLORERS.find((entry) => entry.id === id)
  if (!explorer) throw new Error(`Unknown explorer: ${id}`)
  return explorer
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
/** Total hero memories in the archive (one per power). */
export const MEMORY_SLOTS = 5
