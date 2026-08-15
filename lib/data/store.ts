import type { ColumnMapping } from "@/lib/import/types";
import type {
  Category,
  CommitRow,
  FixedPayment,
  Household,
  ImportBatchMeta,
  Invite,
  MonthData,
  MonthNote,
  Source,
  SourceKind,
  StoredRule,
  Transaction,
} from "./types";

/**
 * All data access goes through this interface (CLAUDE.md convention).
 * Demo store (in-memory, seeded) when Supabase env vars are absent;
 * Supabase store otherwise. The import engine never touches either.
 */
export interface DataStore {
  getHousehold(): Promise<Household>;
  listCategories(): Promise<Category[]>;
  listSources(): Promise<Source[]>;
  listMonths(): Promise<string[]>;
  getMonthData(month: string): Promise<MonthData>;
  /** dedup_hash -> stored count, for count-aware dedup. */
  getDedupCounts(sourceId: string): Promise<Map<string, number>>;
  listRules(): Promise<StoredRule[]>;
  listImportBatches(): Promise<ImportBatchMeta[]>;
  listInvites(): Promise<Invite[]>;

  commitImport(input: {
    sourceId: string;
    filename: string;
    rows: CommitRow[];
    /** merchant -> categoryId rules learned in review (exact normalized match). */
    newRules: Record<string, string>;
    autoCategorizedCount: number;
    manualCount: number;
  }): Promise<{ batchId: string; inserted: number }>;

  saveSourceMapping(sourceId: string, mapping: ColumnMapping): Promise<void>;
  setFixedPaid(categoryId: string, month: string, isPaid: boolean): Promise<void>;
  updateCategory(
    id: string,
    patch: Partial<Pick<Category, "name" | "monthlyCap" | "isFixed">>,
  ): Promise<void>;
  setTransactionCategory(id: string, categoryId: string): Promise<Transaction>;
  createInvite(email: string): Promise<Invite>;

  // --- v2 (PRD v2.1): editable data, real sources, journal ---
  /** Exclude/include a transaction from spend without touching its category. */
  setTransactionExcluded(id: string, isExcluded: boolean): Promise<void>;
  /** Deleting lowers the row's dedup count; re-importing the statement restores it. */
  deleteTransaction(id: string): Promise<void>;
  /** Undo an import: removes exactly the transactions the batch inserted. */
  deleteBatch(batchId: string): Promise<{ removed: number }>;
  /** Minimal manual entry — cash has no CSV (review amendment 1). */
  addManualTransaction(input: {
    sourceId: string;
    date: string;
    description: string;
    amount: number; // cents, spend positive
    categoryId: string | null;
  }): Promise<Transaction>;

  createSource(label: string, ownerMemberId?: string, kind?: SourceKind): Promise<Source>;
  updateSource(
    id: string,
    patch: Partial<Pick<Source, "label" | "ownerMemberId" | "kind">>,
  ): Promise<void>;
  /** Cascades to the source's transactions and batches — confirmed in UI with counts. */
  deleteSource(id: string): Promise<{ removedTransactions: number }>;

  getMonthNote(month: string): Promise<MonthNote | null>;
  saveMonthNote(month: string, body: string): Promise<MonthNote>;
}
