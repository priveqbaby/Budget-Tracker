import type { ColumnMapping } from "@/lib/import/types";
import type {
  Category,
  CommitRow,
  FixedPayment,
  Household,
  ImportBatchMeta,
  Invite,
  MonthData,
  Source,
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
  createSource(label: string): Promise<Source>;
}
