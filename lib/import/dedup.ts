import type { ParsedRow } from "./types";

/**
 * Count-aware deduplication (PRD §8, amended).
 *
 * For each dedup hash, compare how many times it occurs in the incoming file
 * against how many are already stored for this source, and keep only the
 * difference. Two identical same-day coffees import as two transactions;
 * re-uploading an overlapping statement double-counts nothing.
 */
export function dedupeCountAware(
  incoming: ParsedRow[],
  existingCounts: Map<string, number>,
): { toInsert: ParsedRow[]; skipped: number } {
  const seen = new Map<string, number>();
  const toInsert: ParsedRow[] = [];
  let skipped = 0;

  for (const row of incoming) {
    const already = existingCounts.get(row.dedupHash) ?? 0;
    const usedSoFar = seen.get(row.dedupHash) ?? 0;
    if (usedSoFar < already) {
      // This occurrence is covered by a stored transaction.
      seen.set(row.dedupHash, usedSoFar + 1);
      skipped += 1;
    } else {
      seen.set(row.dedupHash, usedSoFar + 1);
      toInsert.push(row);
    }
  }

  return { toInsert, skipped };
}
