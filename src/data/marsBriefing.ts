/**
 * Mars arrival briefing: the guided welcome a child gets right after
 * landing, before taking a single step. PIP cheers, mentions the signal,
 * presents the radar and then runs a quick two-card tutorial (Radar,
 * Scanner). Pure content and rules, no React.
 *
 * Guidance over freedom: the world stays paused, and every step either
 * waits for one specific tap (a card) or offers one big button. Nothing
 * is persisted: like the other opening protocol steps it replays after a
 * reload until the explorer is found (see `needsArrivalBriefing`).
 *
 * Identity discipline: nothing here names the explorer or its parts.
 */

import type { NarrativeExpression } from './missionNarrative'
import { pipLine } from './pipVoiceCatalog'

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
  /** The card the child must tap to move on (no button on this step). */
  awaits?: BriefingTool
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
    awaits: 'radar',
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
    awaits: 'scanner',
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

export function briefingStep(index: number): BriefingStep {
  return BRIEFING_STEPS[Math.max(0, Math.min(index, BRIEFING_STEPS.length - 1))]!
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
 * Step after the child's action: the awaited card was tapped, or the
 * step's button was pressed. Any other tap is ignored (returns `index`).
 */
export function nextBriefingIndex(
  index: number,
  action: { kind: 'button' } | { kind: 'card'; tool: BriefingTool },
): number {
  const step = briefingStep(index)
  if (action.kind === 'card') {
    return step.awaits === action.tool ? index + 1 : index
  }
  return step.awaits ? index : index + 1
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
  for (const step of BRIEFING_STEPS) {
    texts.push(step.line)
    if (step.cta) texts.push(step.cta)
  }
  for (const card of Object.values(BRIEFING_CARDS)) {
    texts.push(card.title, card.summary, ...card.tips.map((tip) => tip.text))
  }
  return texts
}
