"use server";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/data";
import { buildImportPreview, guessMapping } from "@/lib/import/engine";
import { classifyMerchants } from "@/lib/import/categorize";
import type { ColumnMapping } from "@/lib/import/types";
import type { CommitRow, SourceKind } from "@/lib/data/types";
import Papa from "papaparse";

export async function toggleFixedPaid(categoryId: string, month: string, isPaid: boolean) {
  const store = await getStore();
  await store.setFixedPaid(categoryId, month, isPaid);
  revalidatePath("/");
}

/* ---------------------------------------------------------------- v2 edits */

export async function setTransactionExcluded(transactionId: string, isExcluded: boolean) {
  const store = await getStore();
  await store.setTransactionExcluded(transactionId, isExcluded);
  revalidatePath("/");
}

/** Deleting lowers the row's dedup count — re-importing the statement restores it. */
export async function deleteTransaction(transactionId: string) {
  const store = await getStore();
  await store.deleteTransaction(transactionId);
  revalidatePath("/");
}

export async function undoImportBatch(batchId: string): Promise<{ removed: number }> {
  const store = await getStore();
  const result = await store.deleteBatch(batchId);
  revalidatePath("/");
  revalidatePath("/import");
  return result;
}

export async function addManualTransaction(input: {
  sourceId: string;
  date: string;
  description: string;
  amountCents: number;
  categoryId: string | null;
}) {
  const store = await getStore();
  await store.addManualTransaction({
    sourceId: input.sourceId,
    date: input.date,
    description: input.description,
    amount: input.amountCents,
    categoryId: input.categoryId,
  });
  revalidatePath("/");
  revalidatePath("/import");
}

export async function updateSource(
  id: string,
  patch: { label?: string; ownerMemberId?: string; kind?: SourceKind },
) {
  const store = await getStore();
  await store.updateSource(id, patch);
  revalidatePath("/settings");
  revalidatePath("/import");
  revalidatePath("/");
}

export async function deleteSource(id: string): Promise<{ removedTransactions: number }> {
  const store = await getStore();
  const result = await store.deleteSource(id);
  revalidatePath("/settings");
  revalidatePath("/import");
  revalidatePath("/");
  return result;
}

export async function saveMonthNote(month: string, body: string) {
  const store = await getStore();
  const note = await store.saveMonthNote(month, body);
  revalidatePath("/");
  return note;
}

export async function recategorizeTransaction(transactionId: string, categoryId: string) {
  const store = await getStore();
  await store.setTransactionCategory(transactionId, categoryId);
  revalidatePath("/");
}

export async function updateCategoryCap(categoryId: string, capCents: number) {
  const store = await getStore();
  await store.updateCategory(categoryId, { monthlyCap: capCents });
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function sendInvite(email: string) {
  const store = await getStore();
  await store.createInvite(email);
  revalidatePath("/settings");
}

export interface MappingProbe {
  headers: string[];
  guess: Partial<ColumnMapping>;
  sampleRows: Record<string, string>[];
}

/** Step 1 of import: sniff headers and sample rows so the user can confirm the mapping. */
export async function probeCsv(csvText: string): Promise<MappingProbe> {
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    preview: 4,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  return { headers, guess: guessMapping(headers), sampleRows: parsed.data };
}

export interface PreviewRowDto {
  index: number;
  date: string;
  description: string;
  merchantNormalized: string;
  amount: number;
  kind: "spend" | "refund" | "payment";
  isExcluded: boolean;
  categoryId: string | null;
  categorySource: "rule" | "claude" | null;
}

export interface ImportPreviewDto {
  rows: PreviewRowDto[];
  skippedAsDuplicates: number;
  issues: { rowIndex: number; message: string }[];
  autoCategorizedCount: number;
  claudeAssignedCount: number;
}

/** Step 2: run the pure engine + one batched Claude call for unknown merchants. */
export async function previewImport(
  sourceId: string,
  csvText: string,
  mapping: ColumnMapping,
): Promise<ImportPreviewDto> {
  const store = await getStore();
  const [existingCounts, rules, categories] = await Promise.all([
    store.getDedupCounts(sourceId),
    store.listRules(),
    store.listCategories(),
  ]);

  const preview = buildImportPreview(
    csvText,
    mapping,
    existingCounts,
    rules.map((r) => ({ merchantNormalized: r.merchantNormalized, categoryId: r.categoryId })),
  );

  const assignments = await classifyMerchants(
    preview.unknownMerchants,
    categories.filter((c) => !c.isFixed).map((c) => ({ id: c.id, name: c.name })),
  );

  let claudeAssignedCount = 0;
  const rows = preview.rows.map<PreviewRowDto>((row, index) => {
    let categoryId = row.categoryId;
    let categorySource = row.categorySource as PreviewRowDto["categorySource"];
    if (!categoryId && row.kind !== "payment") {
      const assigned = assignments[row.merchantNormalized] ?? null;
      if (assigned) {
        categoryId = assigned;
        categorySource = "claude";
        claudeAssignedCount += 1;
      }
    }
    return {
      index,
      date: row.date,
      description: row.description,
      merchantNormalized: row.merchantNormalized,
      amount: row.amount,
      kind: row.kind,
      isExcluded: row.isExcluded,
      categoryId,
      categorySource,
    };
  });

  await store.saveSourceMapping(sourceId, mapping);

  return {
    rows,
    skippedAsDuplicates: preview.skippedAsDuplicates,
    issues: preview.issues,
    autoCategorizedCount: preview.autoCategorizedCount,
    claudeAssignedCount,
  };
}

export interface CommitRowDto extends PreviewRowDto {
  /** Reviewed category (may differ from the engine's suggestion). */
  finalCategoryId: string | null;
  includeExcluded: boolean;
}

/** Step 3: write reviewed rows; manual choices become merchant rules. */
export async function commitImport(
  sourceId: string,
  filename: string,
  rows: CommitRowDto[],
): Promise<{ inserted: number }> {
  const store = await getStore();

  const newRules: Record<string, string> = {};
  let manualCount = 0;
  const commitRows: CommitRow[] = rows.map((r) => {
    const isManual = r.finalCategoryId !== null && r.finalCategoryId !== (r.categorySource === "rule" ? r.categoryId : null);
    if (r.finalCategoryId && r.kind !== "payment") {
      // Every reviewed categorization writes/refreshes a rule (PRD §8).
      newRules[r.merchantNormalized] = r.finalCategoryId;
      if (isManual && r.categorySource !== "rule") manualCount += 1;
    }
    return {
      date: r.date,
      description: r.description,
      merchantNormalized: r.merchantNormalized,
      amount: r.amount,
      currency: "CAD",
      kind: r.kind,
      isExcluded: r.kind === "payment" ? !r.includeExcluded : false,
      categoryId: r.finalCategoryId,
      isConfirmed: r.finalCategoryId !== null,
      dedupHash: `${r.date}|${r.amount}|${r.merchantNormalized}`,
    };
  });

  const result = await store.commitImport({
    sourceId,
    filename,
    rows: commitRows,
    newRules,
    autoCategorizedCount: rows.filter((r) => r.categorySource === "rule").length,
    manualCount,
  });

  revalidatePath("/");
  revalidatePath("/import");
  return { inserted: result.inserted };
}
