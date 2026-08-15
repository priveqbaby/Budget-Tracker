import { dedupHashOf } from "@/lib/import/parse";
import { normalizeMerchant } from "@/lib/import/normalize";
import type { ColumnMapping } from "@/lib/import/types";
import type { DataStore } from "./store";
import type {
  Category, CommitRow, FixedPayment, Household, ImportBatchMeta, Invite,
  IncomeEntry, MonthCap, MonthData, MonthNote, Source, SourceKind, StoredRule, Transaction,
} from "./types";
import {
  buildSeed, categories as seedCategories, members, sources as seedSources,
  DEMO_SAVINGS_TARGET,
} from "./demo-seed";

interface DemoDb {
  categories: Category[];
  sources: Source[];
  transactions: Transaction[];
  fixedPayments: FixedPayment[];
  monthCaps: MonthCap[];
  rules: StoredRule[];
  importBatches: ImportBatchMeta[];
  invites: Invite[];
  monthNotes: MonthNote[];
  incomeEntries: IncomeEntry[];
  savingsTarget: number;
  counter: number;
}

// Survives HMR / route-module reloads within one server process.
const globalRef = globalThis as unknown as { __budgetDemoDb?: DemoDb };

function db(): DemoDb {
  if (!globalRef.__budgetDemoDb) {
    const seed = buildSeed();
    globalRef.__budgetDemoDb = {
      categories: structuredClone(seedCategories),
      sources: structuredClone(seedSources),
      ...seed,
      savingsTarget: DEMO_SAVINGS_TARGET,
      counter: 10000,
    };
  }
  return globalRef.__budgetDemoDb;
}

export class DemoStore implements DataStore {
  async getHousehold(): Promise<Household> {
    return { id: "hh-demo", name: "Leon & Sara", members, savingsTarget: db().savingsTarget };
  }

  async listCategories(): Promise<Category[]> {
    return [...db().categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listSources(): Promise<Source[]> {
    return db().sources;
  }

  async listMonths(): Promise<string[]> {
    const months = new Set(db().transactions.map((t) => t.date.slice(0, 7)));
    return [...months].sort();
  }

  async getMonthData(month: string): Promise<MonthData> {
    const d = db();
    return {
      month,
      transactions: d.transactions
        .filter((t) => t.date.startsWith(month))
        .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount),
      fixedPayments: d.fixedPayments.filter((f) => f.month === month),
      monthCaps: d.monthCaps.filter((c) => c.month === month),
    };
  }

  async getDedupCounts(sourceId: string): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const t of db().transactions) {
      if (t.sourceId !== sourceId) continue;
      counts.set(t.dedupHash, (counts.get(t.dedupHash) ?? 0) + 1);
    }
    return counts;
  }

  async listRules(): Promise<StoredRule[]> {
    return db().rules;
  }

  async listImportBatches(): Promise<ImportBatchMeta[]> {
    return [...db().importBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listInvites(): Promise<Invite[]> {
    return db().invites;
  }

  async commitImport(input: {
    sourceId: string;
    filename: string;
    rows: CommitRow[];
    newRules: Record<string, string>;
    autoCategorizedCount: number;
    manualCount: number;
  }): Promise<{ batchId: string; inserted: number }> {
    const d = db();
    const source = d.sources.find((s) => s.id === input.sourceId);
    if (!source) throw new Error(`Unknown source ${input.sourceId}`);

    const batchId = `batch-${++d.counter}`;
    d.importBatches.push({
      id: batchId,
      sourceId: input.sourceId,
      filename: input.filename,
      rowCount: input.rows.length,
      autoCategorizedCount: input.autoCategorizedCount,
      manualCount: input.manualCount,
      createdAt: new Date().toISOString(),
    });

    for (const row of input.rows) {
      d.transactions.push({
        ...row,
        id: `tx-${++d.counter}`,
        sourceId: input.sourceId,
        ownerMemberId: source.ownerMemberId,
        importBatchId: batchId,
      });
      // Mirror of the Postgres trigger: snapshot caps when a month first sees data.
      const month = row.date.slice(0, 7);
      if (!d.monthCaps.some((c) => c.month === month)) {
        for (const c of d.categories) {
          d.monthCaps.push({ categoryId: c.id, month, cap: c.monthlyCap });
        }
      }
    }

    for (const [merchant, categoryId] of Object.entries(input.newRules)) {
      const existing = d.rules.find((r) => r.merchantNormalized === merchant);
      if (existing) {
        existing.categoryId = categoryId;
        existing.hitCount += 1;
      } else {
        d.rules.push({ merchantNormalized: merchant, categoryId, hitCount: 1 });
      }
    }

    return { batchId, inserted: input.rows.length };
  }

  async saveSourceMapping(sourceId: string, mapping: ColumnMapping): Promise<void> {
    const source = db().sources.find((s) => s.id === sourceId);
    if (source) source.columnMapping = mapping;
  }

  async setFixedPaid(categoryId: string, month: string, isPaid: boolean): Promise<void> {
    const d = db();
    const fp = d.fixedPayments.find((f) => f.categoryId === categoryId && f.month === month);
    if (fp) {
      fp.isPaid = isPaid;
    } else {
      const cat = d.categories.find((c) => c.id === categoryId);
      d.fixedPayments.push({
        id: `fp-${++d.counter}`, categoryId, month, isPaid, amount: cat?.monthlyCap ?? 0,
      });
    }
  }

  async updateCategory(
    id: string,
    patch: Partial<Pick<Category, "name" | "monthlyCap" | "isFixed">>,
  ): Promise<void> {
    const cat = db().categories.find((c) => c.id === id);
    if (cat) Object.assign(cat, patch);
  }

  async setTransactionCategory(id: string, categoryId: string): Promise<Transaction> {
    const d = db();
    const t = d.transactions.find((t) => t.id === id);
    if (!t) throw new Error(`Unknown transaction ${id}`);
    t.categoryId = categoryId;
    t.isConfirmed = true;
    const rule = d.rules.find((r) => r.merchantNormalized === t.merchantNormalized);
    if (rule) {
      rule.categoryId = categoryId;
      rule.hitCount += 1;
    } else {
      d.rules.push({ merchantNormalized: t.merchantNormalized, categoryId, hitCount: 1 });
    }
    return t;
  }

  async createInvite(email: string): Promise<Invite> {
    const d = db();
    const invite: Invite = { id: `inv-${++d.counter}`, email, role: "member", acceptedAt: null };
    d.invites.push(invite);
    return invite;
  }

  async getSourceTransactionCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const t of db().transactions) {
      counts.set(t.sourceId, (counts.get(t.sourceId) ?? 0) + 1);
    }
    return counts;
  }

  async createSource(label: string, ownerMemberId?: string, kind?: SourceKind): Promise<Source> {
    const d = db();
    const source: Source = {
      id: `src-${++d.counter}`,
      ownerMemberId: ownerMemberId ?? members[0].id,
      label,
      kind: kind ?? "credit_card",
      columnMapping: null,
    };
    d.sources.push(source);
    return source;
  }

  async setTransactionExcluded(id: string, isExcluded: boolean): Promise<void> {
    const t = db().transactions.find((t) => t.id === id);
    if (t) t.isExcluded = isExcluded;
  }

  async deleteTransaction(id: string): Promise<void> {
    const d = db();
    d.transactions = d.transactions.filter((t) => t.id !== id);
  }

  async deleteBatch(batchId: string): Promise<{ removed: number }> {
    const d = db();
    const before = d.transactions.length;
    d.transactions = d.transactions.filter((t) => t.importBatchId !== batchId);
    d.importBatches = d.importBatches.filter((b) => b.id !== batchId);
    return { removed: before - d.transactions.length };
  }

  async addManualTransaction(input: {
    sourceId: string;
    date: string;
    description: string;
    amount: number;
    categoryId: string | null;
  }): Promise<Transaction> {
    const d = db();
    const source = d.sources.find((s) => s.id === input.sourceId);
    if (!source) throw new Error(`Unknown source ${input.sourceId}`);
    const merchantNormalized = normalizeMerchant(input.description);
    const txn: Transaction = {
      id: `tx-${++d.counter}`,
      sourceId: input.sourceId,
      ownerMemberId: source.ownerMemberId,
      date: input.date,
      description: input.description,
      merchantNormalized,
      amount: input.amount,
      currency: "CAD",
      kind: input.amount < 0 ? "refund" : "spend",
      isExcluded: false,
      categoryId: input.categoryId,
      isConfirmed: input.categoryId !== null,
      dedupHash: dedupHashOf(input.date, input.amount, merchantNormalized),
      importBatchId: null,
    };
    d.transactions.push(txn);
    return txn;
  }

  async updateSource(
    id: string,
    patch: Partial<Pick<Source, "label" | "ownerMemberId" | "kind">>,
  ): Promise<void> {
    const source = db().sources.find((s) => s.id === id);
    if (source) Object.assign(source, patch);
    // Transactions carry their owner; a source owner change applies forward
    // and to existing rows so the split stays truthful.
    if (patch.ownerMemberId) {
      for (const t of db().transactions) {
        if (t.sourceId === id) t.ownerMemberId = patch.ownerMemberId;
      }
    }
  }

  async deleteSource(id: string): Promise<{ removedTransactions: number }> {
    const d = db();
    const before = d.transactions.length;
    d.transactions = d.transactions.filter((t) => t.sourceId !== id);
    d.importBatches = d.importBatches.filter((b) => b.sourceId !== id);
    d.sources = d.sources.filter((s) => s.id !== id);
    return { removedTransactions: before - d.transactions.length };
  }

  async getMonthNote(month: string): Promise<MonthNote | null> {
    return db().monthNotes.find((n) => n.month === month) ?? null;
  }

  async listIncomeEntries(): Promise<IncomeEntry[]> {
    return db().incomeEntries;
  }

  async addIncomeEntry(input: Omit<IncomeEntry, "id">): Promise<IncomeEntry> {
    const d = db();
    const entry: IncomeEntry = { ...input, id: `inc-${++d.counter}` };
    d.incomeEntries.push(entry);
    return entry;
  }

  async updateIncomeEntry(id: string, patch: Partial<Omit<IncomeEntry, "id">>): Promise<void> {
    const entry = db().incomeEntries.find((e) => e.id === id);
    if (entry) Object.assign(entry, patch);
  }

  async deleteIncomeEntry(id: string): Promise<void> {
    const d = db();
    d.incomeEntries = d.incomeEntries.filter((e) => e.id !== id);
  }

  async setSavingsTarget(cents: number): Promise<void> {
    db().savingsTarget = cents;
  }

  async saveMonthNote(month: string, body: string): Promise<MonthNote> {
    const d = db();
    const existing = d.monthNotes.find((n) => n.month === month);
    const updatedAt = new Date().toISOString();
    if (existing) {
      existing.body = body;
      existing.updatedAt = updatedAt;
      return existing;
    }
    const note: MonthNote = { month, body, updatedAt };
    d.monthNotes.push(note);
    return note;
  }
}
