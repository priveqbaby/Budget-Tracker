import type { CategorizedRow, ColumnMapping, MerchantRule, ParseIssue } from "./types";
import { parseStatement } from "./parse";
import { dedupeCountAware } from "./dedup";
import { applyRules } from "./rules";

export interface ImportPreview {
  rows: CategorizedRow[];
  unknownMerchants: string[];
  issues: ParseIssue[];
  skippedAsDuplicates: number;
  autoCategorizedCount: number;
}

/**
 * The pure part of an import: parse → canonicalize → count-aware dedup →
 * rule matching. Claude classification of unknown merchants and the actual
 * write happen in the caller (server action), which then presents everything
 * for review — nothing is confirmed here.
 */
export function buildImportPreview(
  csvText: string,
  mapping: ColumnMapping,
  existingCounts: Map<string, number>,
  rules: MerchantRule[],
): ImportPreview {
  const { rows, issues } = parseStatement(csvText, mapping);
  const { toInsert, skipped } = dedupeCountAware(rows, existingCounts);
  const { categorized, unknownMerchants } = applyRules(toInsert, rules);

  return {
    rows: categorized,
    unknownMerchants,
    issues,
    skippedAsDuplicates: skipped,
    autoCategorizedCount: categorized.filter((r) => r.categorySource === "rule").length,
  };
}

/** Guess a column mapping from CSV headers, for first-time sources. */
export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const find = (patterns: RegExp[]) =>
    headers.find((h) => patterns.some((p) => p.test(h.trim())));
  return {
    date: find([/^date$/i, /date/i]),
    description: find([/^description$/i, /desc|merchant|detail|narrative|transaction/i]),
    amount: find([/^amount$/i, /amount|montant|value/i]),
  };
}
