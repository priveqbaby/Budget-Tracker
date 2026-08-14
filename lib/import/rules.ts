import type { CategorizedRow, MerchantRule, ParsedRow } from "./types";

/**
 * Apply merchant rules: exact match on the normalized merchant string.
 * Rows without a rule come back with categoryId null; their merchants are
 * collected for one batched Claude call.
 */
export function applyRules(
  rows: ParsedRow[],
  rules: MerchantRule[],
): { categorized: CategorizedRow[]; unknownMerchants: string[] } {
  const byMerchant = new Map(rules.map((r) => [r.merchantNormalized, r.categoryId]));
  const unknown = new Set<string>();

  const categorized = rows.map<CategorizedRow>((row) => {
    if (row.kind === "payment") {
      return { ...row, categoryId: null, categorySource: null };
    }
    const categoryId = byMerchant.get(row.merchantNormalized) ?? null;
    if (categoryId === null) unknown.add(row.merchantNormalized);
    return { ...row, categoryId, categorySource: categoryId ? "rule" : null };
  });

  return { categorized, unknownMerchants: [...unknown] };
}
