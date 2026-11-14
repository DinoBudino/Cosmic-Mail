/**
 * Development-only pacing instrumentation: how long from "New Game" (or
 * Continue) until the player first controls the astronaut on Mars. It only
 * observes the onboarding phase and the first unpaused world frame; it never
 * changes behavior, and it is a no-op in production builds.
 */

import { useOnboardingStore } from '../store/onboardingStore'

export interface PacingMark {
  name: string
  /** performance.now() timestamp. */
  at: number
}

export interface PacingStep {
  name: string
  /** Milliseconds since the first mark. */
  sinceStartMs: number
  /** Milliseconds since the previous mark. */
  deltaMs: number
}

export interface PacingReport {
  steps: PacingStep[]
  totalMs: number
}

/** Pure: turns ordered marks into a readable report. */
export function buildPacingReport(marks: readonly PacingMark[]): PacingReport {
  if (marks.length === 0) return { steps: [], totalMs: 0 }
  const start = marks[0].at
  const steps = marks.map((mark, index) => ({
    name: mark.name,
    sinceStartMs: Math.round(mark.at - start),
    deltaMs: Math.round(mark.at - (marks[index - 1]?.at ?? mark.at)),
  }))
  return { steps, totalMs: steps[steps.length - 1].sinceStartMs }
}

const marks: PacingMark[] = []
let installed = false
let controlMarked = false

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function mark(name: string): void {
  marks.push({ name, at: now() })
}

export function getPacingReport(): PacingReport {
  return buildPacingReport(marks)
}

/** Called once per unpaused world frame; only the first one counts. */
export function markFirstControl(): void {
  if (!import.meta.env.DEV || controlMarked || marks.length === 0) return
  controlMarked = true
  mark('first-control')
  const report = getPacingReport()
  console.info(
    `[pacing] start → first control on Mars: ${(report.totalMs / 1000).toFixed(1)} s`,
    report.steps,
  )
}

/** Dev only. Starts a new measurement whenever the menu is left. */
export function installPacing(): void {
  if (!import.meta.env.DEV || installed) return
  installed = true
  let previous = useOnboardingStore.getState().phase
  useOnboardingStore.subscribe((state) => {
    const phase = state.phase
    if (phase === previous) return
    if (previous === 'menu') {
      marks.length = 0
      controlMarked = false
      mark(phase === 'intro' ? 'new-game' : 'continue')
    }
    if (marks.length > 0) mark(`phase:${phase}`)
    if (phase === 'menu') {
      marks.length = 0
      controlMarked = false
    }
    previous = phase
  })
  ;(window as unknown as { __cosmicPacing?: () => PacingReport }).__cosmicPacing =
    getPacingReport
}
