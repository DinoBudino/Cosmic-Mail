/**
 * Single rule for the temporary ground-survey restriction. Flight is a level
 * design tool here, not a broken jetpack: it unlocks as soon as the explorer
 * memory is recovered, and every UI reads this same helper.
 */
export function isFlightUnlocked(
  progress: { memoryRecoveredAt: number | null } | null | undefined,
): boolean {
  return progress?.memoryRecoveredAt != null
}
