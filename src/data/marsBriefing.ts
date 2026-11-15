/**
 * Mars arrival briefing: the guided welcome a child gets right after
 * landing, before taking a single step. PIP cheers, mentions the signal,
 * presents the radar and then runs a quick two-card tutorial (Radar,
 * Scanner). Pure content and rules, no React.
 *
 * Guidance over freedom: the world stays paused and every step offers
 * one big button. PIP opens each tool card himself as he explains it;
 * the child only moves the dialogue on. Nothing
 * is persisted: like the other opening protocol steps it replays after a
 * reload until the explorer is found (see `needsArrivalBriefing`).
 *
 * Identity discipline: nothing here names the explorer or its parts.
 */

import type { NarrativeExpression } from './missionNarrative'
import { pipLine } from './pipVoiceCatalog'
import { getActiveWorld } from './spiritSite'

export type BriefingStepId =
  | 'arrival'
  | 'signal'
  | 'radar'
  | 'tools'
  | 'radar-detail'
  | 'tools-scanner'
  | 'scanner-detail'
  | 'ready'

/** What is on screen: PIP alone, the two-card overview or one big card. */
export type BriefingView = 'pip' | 'tools' | 'radar' | 'scanner'

/** The tutorial's two tools, in the order PIP teaches them. */
export type BriefingTool = 'radar' | 'scanner'

export interface BriefingStep {
  id: BriefingStepId
  /** PIP's recorded line (subtitle and voice key). */
  line: string
  expression: NarrativeExpression
  view: BriefingView
  /**
   * The card PIP is about to open: it lights up during the line and the
   * step's button (or the card itself) opens it.
   */
  focus?: BriefingTool
  /** Big button label when the step moves on with a button. */
  cta?: string
  /** Tutorial progress bar (0..1), only for the card views. */
  progress: number
  /** The real HUD radar is on screen (and pulses on the radar step). */
  showRadar: boolean
}

export const BRIEFING_STEPS: readonly BriefingStep[] = [
  {
    id: 'arrival',
    line: pipLine('mars-briefing-arrival'),
    expression: 'celebrating',
    view: 'pip',
    cta: 'Continue',
    progress: 0,
    showRadar: false,
  },
  {
    id: 'signal',
    line: pipLine('mars-briefing-signal'),
    expression: 'excited',
    view: 'pip',
    cta: 'Continue',
    progress: 0,
    showRadar: false,
  },
  {
    id: 'radar',
    line: pipLine('mars-briefing-radar'),
    expression: 'happy',
    view: 'pip',
    cta: 'Show me!',
    progress: 0,
    showRadar: true,
  },
  {
    id: 'tools',
    line: pipLine('mars-briefing-tools'),
    expression: 'focused',
    view: 'tools',
    focus: 'radar',
    cta: 'Show me!',
    progress: 0.15,
    showRadar: true,
  },
  {
    id: 'radar-detail',
    line: pipLine('mars-briefing-radar-detail'),
    expression: 'happy',
    view: 'radar',
    cta: 'Got it!',
    progress: 0.5,
    showRadar: true,
  },
  {
    id: 'tools-scanner',
    line: pipLine('mars-briefing-tools-scanner'),
    expression: 'excited',
    view: 'tools',
    focus: 'scanner',
    cta: 'Show me!',
    progress: 0.5,
    showRadar: true,
  },
  {
    id: 'scanner-detail',
    line: pipLine('mars-briefing-scanner-detail'),
    expression: 'curious',
    view: 'scanner',
    cta: 'Got it!',
    progress: 1,
    showRadar: true,
  },
  {
    id: 'ready',
    line: pipLine('mars-briefing-ready'),
    expression: 'celebrating',
    view: 'tools',
    cta: 'Start exploring!',
    progress: 1,
    showRadar: true,
  },
]

/** On the Moon the welcome names the Moon; every other step is shared. */
const MOON_ARRIVAL: BriefingStep = {
  ...BRIEFING_STEPS[0]!,
  line: pipLine('moon-briefing-arrival'),
}

export function briefingStep(index: number): BriefingStep {
  const step = BRIEFING_STEPS[Math.max(0, Math.min(index, BRIEFING_STEPS.length - 1))]!
  return step.id === 'arrival' && getActiveWorld() === 'moon' ? MOON_ARRIVAL : step
}

export function isLastBriefingStep(index: number): boolean {
  return index >= BRIEFING_STEPS.length - 1
}

/** Tools already explained before this step (shown with a check mark). */
export function learnedTools(index: number): BriefingTool[] {
  const learned: BriefingTool[] = []
  const at = (id: BriefingStepId) => BRIEFING_STEPS.findIndex((step) => step.id === id)
  if (index > at('radar-detail')) learned.push('radar')
  if (index > at('scanner-detail')) learned.push('scanner')
  return learned
}

/**
 * Step after the child's action: the step's button, or a tap on the card
 * PIP is opening. Any other card tap is ignored (returns `index`).
 */
export function nextBriefingIndex(
  index: number,
  action: { kind: 'button' } | { kind: 'card'; tool: BriefingTool },
): number {
  const step = briefingStep(index)
  if (action.kind === 'card') {
    return step.focus === action.tool ? index + 1 : index
  }
  return index + 1
}

/** Tips shown on each big card: short, visual, keyed per device. */
export interface BriefingTip {
  /** Key chip (desktop) or touch label shown before the text. */
  key?: { desktop: string; touch: string }
  text: string
}

export const BRIEFING_CARDS: Readonly<
  Record<BriefingTool, { title: string; summary: string; tips: BriefingTip[] }>
> = {
  radar: {
    title: 'Radar',
    summary: 'Shows where to go',
    tips: [
      { text: 'You are the arrow in the middle.' },
      { text: 'The orange star is where we need to go.' },
      { key: { desktop: 'Drag mouse', touch: 'Drag' }, text: 'Turn until the star is at the top.' },
      { key: { desktop: 'W', touch: 'Joystick' }, text: 'Walk straight ahead to reach it.' },
    ],
  },
  scanner: {
    title: 'Scanner',
    summary: 'Looks at things up close',
    tips: [
      { key: { desktop: 'Q', touch: 'Scanner' }, text: 'Take out your scanner.' },
      { text: 'Aim at something that glows.' },
      {
        key: { desktop: 'Hold click', touch: 'Hold Scan' },
        text: 'Hold until the scan is complete.',
      },
    ],
  },
}

export const BRIEFING_TITLE = 'To start exploring, you need to know…'

/** Every visible string of the briefing (identity audit). */
export function getBriefingTexts(): string[] {
  const texts: string[] = [BRIEFING_TITLE]
  for (const step of [...BRIEFING_STEPS, MOON_ARRIVAL]) {
    texts.push(step.line)
    if (step.cta) texts.push(step.cta)
  }
  for (const card of Object.values(BRIEFING_CARDS)) {
    texts.push(card.title, card.summary, ...card.tips.map((tip) => tip.text))
  }
  return texts
}
