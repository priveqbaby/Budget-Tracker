import type { ColumnMapping } from "@/lib/import/types";
import type { DataStore } from "./store";
import type {
  Category, CommitRow, FixedPayment, Household, ImportBatchMeta, Invite,
  MonthCap, MonthData, Source, StoredRule, Transaction,
} from "./types";
import { buildSeed, categories as seedCategories, members, sources as seedSources } from "./demo-seed";

interface DemoDb {
  categories: Category[];
  sources: Source[];
  transactions: Transaction[];
  fixedPayments: FixedPayment[];
  monthCaps: MonthCap[];
  rules: StoredRule[];
  importBatches: ImportBatchMeta[];
  invites: Invite[];
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
      counter: 10000,
    };
  }
  return globalRef.__budgetDemoDb;
}

export class DemoStore implements DataStore {
  async getHousehold(): Promise<Household> {
    return { id: "hh-demo", name: "Leon & Sara", members };
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

  async createSource(label: string): Promise<Source> {
    const d = db();
    const source: Source = {
      id: `src-${++d.counter}`,
      ownerMemberId: members[0].id,
      label,
      columnMapping: null,
    };
    d.sources.push(source);
    return source;
  }
}
