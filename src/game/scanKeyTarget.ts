import type { ProtocolStep } from '../data/arrivalProtocol'

export type ScanKeyTarget = 'practice-rock' | 'explorer'

/**
 * Where the floating "Press Q" goes: only while the objective is to take
 * the scanner out (the objective bar's 'scanner-key' highlight). The
 * practice step points at the practice rock; the parts hunt at the
 * explorer.
 */
export function getScanKeyTarget(
  step: ProtocolStep,
  highlight: string | null | undefined,
): ScanKeyTarget | null {
  if (highlight !== 'scanner-key') return null
  if (step === 'M2') return 'practice-rock'
  if (step === 'M4') return 'explorer'
  return null
}
