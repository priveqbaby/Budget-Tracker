import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ColumnMapping } from "@/lib/import/types";
import type { DataStore } from "./store";
import type {
  Category, CommitRow, FixedPayment, Household, ImportBatchMeta, Invite,
  MonthCap, MonthData, MonthNote, Source, SourceKind, StoredRule, Transaction,
} from "./types";
import { dedupHashOf } from "@/lib/import/parse";
import { normalizeMerchant } from "@/lib/import/normalize";

export class NotSignedInError extends Error {}
export class NoHouseholdError extends Error {}

/* eslint-disable @typescript-eslint/no-explicit-any */
const txnFromRow = (r: any): Transaction => ({
  id: r.id, sourceId: r.source_id, ownerMemberId: r.owner_member_id, date: r.date,
  description: r.description, merchantNormalized: r.merchant_normalized,
  amount: r.amount, currency: r.currency, kind: r.kind, isExcluded: r.is_excluded,
  categoryId: r.category_id, isConfirmed: r.is_confirmed, dedupHash: r.dedup_hash,
  importBatchId: r.import_batch_id,
});

export class SupabaseStore implements DataStore {
  constructor(
    private supabase: SupabaseClient,
    private householdId: string,
  ) {}

  private hh() {
    return { household_id: this.householdId };
  }

  async getHousehold(): Promise<Household> {
    const { data: hh, error } = await this.supabase
      .from("households").select("id, name").eq("id", this.householdId).single();
    if (error) throw error;
    const { data: members } = await this.supabase
      .from("household_members").select("user_id, display_name, role")
      .eq("household_id", this.householdId);
    return {
      id: hh.id,
      name: hh.name,
      members: (members ?? []).map((m) => ({
        id: m.user_id, displayName: m.display_name, role: m.role,
      })),
    };
  }

  async listCategories(): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from("categories").select("*").eq("household_id", this.householdId)
      .order("sort_order");
    if (error) throw error;
    return data.map((c) => ({
      id: c.id, name: c.name, monthlyCap: c.monthly_cap,
      isFixed: c.is_fixed, isSurplus: c.is_surplus ?? false, sortOrder: c.sort_order,
    }));
  }

  async listSources(): Promise<Source[]> {
    const { data, error } = await this.supabase
      .from("sources").select("*").eq("household_id", this.householdId);
    if (error) throw error;
    return data.map((s) => ({
      id: s.id, ownerMemberId: s.owner_member_id, label: s.label,
      kind: (s.kind ?? "credit_card") as SourceKind,
      columnMapping: s.column_mapping as ColumnMapping | null,
    }));
  }

  async listMonths(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("transactions").select("date").eq("household_id", this.householdId);
    if (error) throw error;
    return [...new Set(data.map((r) => String(r.date).slice(0, 7)))].sort();
  }

  async getMonthData(month: string): Promise<MonthData> {
    const from = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const to = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    const [txns, fixed, caps] = await Promise.all([
      this.supabase.from("transactions").select("*")
        .eq("household_id", this.householdId).gte("date", from).lt("date", to)
        .order("date", { ascending: false }),
      this.supabase.from("fixed_payments").select("*")
        .eq("household_id", this.householdId).eq("month", month),
      this.supabase.from("month_caps").select("*")
        .eq("household_id", this.householdId).eq("month", month),
    ]);
    if (txns.error) throw txns.error;
    return {
      month,
      transactions: txns.data.map(txnFromRow),
      fixedPayments: (fixed.data ?? []).map((f): FixedPayment => ({
        id: f.id, categoryId: f.category_id, month: f.month,
        isPaid: f.is_paid, amount: f.amount,
      })),
      monthCaps: (caps.data ?? []).map((c): MonthCap => ({
        categoryId: c.category_id, month: c.month, cap: c.cap,
      })),
    };
  }

  async getDedupCounts(sourceId: string): Promise<Map<string, number>> {
    const { data, error } = await this.supabase
      .from("transactions").select("dedup_hash").eq("source_id", sourceId);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const r of data) counts.set(r.dedup_hash, (counts.get(r.dedup_hash) ?? 0) + 1);
    return counts;
  }

  async listRules(): Promise<StoredRule[]> {
    const { data, error } = await this.supabase
      .from("merchant_rules").select("*").eq("household_id", this.householdId);
    if (error) throw error;
    return data.map((r) => ({
      merchantNormalized: r.merchant_normalized, categoryId: r.category_id,
      hitCount: r.hit_count,
    }));
  }

  async listImportBatches(): Promise<ImportBatchMeta[]> {
    const { data, error } = await this.supabase
      .from("import_batches").select("*").eq("household_id", this.householdId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((b) => ({
      id: b.id, sourceId: b.source_id, filename: b.filename, rowCount: b.row_count,
      autoCategorizedCount: b.auto_categorized_count, manualCount: b.manual_count,
      createdAt: b.created_at,
    }));
  }

  async listInvites(): Promise<Invite[]> {
    const { data, error } = await this.supabase
      .from("invites").select("*").eq("household_id", this.householdId);
    if (error) throw error;
    return data.map((i) => ({
      id: i.id, email: i.email, role: i.role, acceptedAt: i.accepted_at,
    }));
  }

  async commitImport(input: {
    sourceId: string;
    filename: string;
    rows: CommitRow[];
    newRules: Record<string, string>;
    autoCategorizedCount: number;
    manualCount: number;
  }): Promise<{ batchId: string; inserted: number }> {
    const { data: source, error: srcError } = await this.supabase
      .from("sources").select("owner_member_id").eq("id", input.sourceId).single();
    if (srcError) throw srcError;

    const { data: batch, error: batchError } = await this.supabase
      .from("import_batches")
      .insert({
        ...this.hh(), source_id: input.sourceId, filename: input.filename,
        row_count: input.rows.length,
        auto_categorized_count: input.autoCategorizedCount,
        manual_count: input.manualCount,
      })
      .select("id").single();
    if (batchError) throw batchError;

    if (input.rows.length > 0) {
      const { error } = await this.supabase.from("transactions").insert(
        input.rows.map((r) => ({
          ...this.hh(), source_id: input.sourceId, owner_member_id: source.owner_member_id,
          date: r.date, description: r.description,
          merchant_normalized: r.merchantNormalized, amount: r.amount,
          currency: r.currency, kind: r.kind, is_excluded: r.isExcluded,
          category_id: r.categoryId, is_confirmed: r.isConfirmed,
          dedup_hash: r.dedupHash, import_batch_id: batch.id,
        })),
      );
      if (error) throw error;
    }

    for (const [merchant, categoryId] of Object.entries(input.newRules)) {
      await this.supabase.from("merchant_rules").upsert(
        { ...this.hh(), merchant_normalized: merchant, category_id: categoryId, hit_count: 1 },
        { onConflict: "household_id,merchant_normalized" },
      );
    }

    return { batchId: batch.id, inserted: input.rows.length };
  }

  async saveSourceMapping(sourceId: string, mapping: ColumnMapping): Promise<void> {
    const { error } = await this.supabase
      .from("sources").update({ column_mapping: mapping }).eq("id", sourceId);
    if (error) throw error;
  }

  async setFixedPaid(categoryId: string, month: string, isPaid: boolean): Promise<void> {
    const { data: cat } = await this.supabase
      .from("categories").select("monthly_cap").eq("id", categoryId).single();
    const { error } = await this.supabase.from("fixed_payments").upsert(
      {
        ...this.hh(), category_id: categoryId, month,
        is_paid: isPaid, amount: cat?.monthly_cap ?? 0,
      },
      { onConflict: "category_id,month" },
    );
    if (error) throw error;
  }

  async updateCategory(
    id: string,
    patch: Partial<Pick<Category, "name" | "monthlyCap" | "isFixed">>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("categories")
      .update({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.monthlyCap !== undefined && { monthly_cap: patch.monthlyCap }),
        ...(patch.isFixed !== undefined && { is_fixed: patch.isFixed }),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async setTransactionCategory(id: string, categoryId: string): Promise<Transaction> {
    const { data, error } = await this.supabase
      .from("transactions")
      .update({ category_id: categoryId, is_confirmed: true })
      .eq("id", id).select("*").single();
    if (error) throw error;
    await this.supabase.from("merchant_rules").upsert(
      {
        ...this.hh(), merchant_normalized: data.merchant_normalized,
        category_id: categoryId, hit_count: 1,
      },
      { onConflict: "household_id,merchant_normalized" },
    );
    return txnFromRow(data);
  }

  async createInvite(email: string): Promise<Invite> {
    const { data: user } = await this.supabase.auth.getUser();
    // Denormalized so the invitee — not yet a member, so blind to households
    // under RLS — can still see whom they're joining on /welcome.
    const { data: hh } = await this.supabase
      .from("households").select("name").eq("id", this.householdId).single();
    const { data, error } = await this.supabase
      .from("invites")
      .insert({
        ...this.hh(), email, invited_by: user.user?.id,
        household_name: hh?.name ?? "",
      })
      .select("*").single();
    if (error) throw error;
    return { id: data.id, email: data.email, role: data.role, acceptedAt: data.accepted_at };
  }

  async createSource(label: string, ownerMemberId?: string, kind?: SourceKind): Promise<Source> {
    const { data: auth } = await this.supabase.auth.getUser();
    if (!auth.user) throw new NotSignedInError();
    const { data, error } = await this.supabase
      .from("sources")
      .insert({
        ...this.hh(),
        owner_member_id: ownerMemberId ?? auth.user.id,
        label,
        kind: kind ?? "credit_card",
      })
      .select("*").single();
    if (error) throw error;
    return {
      id: data.id, ownerMemberId: data.owner_member_id, label: data.label,
      kind: data.kind, columnMapping: data.column_mapping,
    };
  }

  async setTransactionExcluded(id: string, isExcluded: boolean): Promise<void> {
    const { error } = await this.supabase
      .from("transactions").update({ is_excluded: isExcluded }).eq("id", id);
    if (error) throw error;
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.supabase.from("transactions").delete().eq("id", id);
    if (error) throw error;
  }

  async deleteBatch(batchId: string): Promise<{ removed: number }> {
    const { count, error } = await this.supabase
      .from("transactions").delete({ count: "exact" }).eq("import_batch_id", batchId);
    if (error) throw error;
    const { error: batchError } = await this.supabase
      .from("import_batches").delete().eq("id", batchId);
    if (batchError) throw batchError;
    return { removed: count ?? 0 };
  }

  async addManualTransaction(input: {
    sourceId: string;
    date: string;
    description: string;
    amount: number;
    categoryId: string | null;
  }): Promise<Transaction> {
    const { data: source, error: srcError } = await this.supabase
      .from("sources").select("owner_member_id").eq("id", input.sourceId).single();
    if (srcError) throw srcError;
    const merchantNormalized = normalizeMerchant(input.description);
    const { data, error } = await this.supabase
      .from("transactions")
      .insert({
        ...this.hh(),
        source_id: input.sourceId,
        owner_member_id: source.owner_member_id,
        date: input.date,
        description: input.description,
        merchant_normalized: merchantNormalized,
        amount: input.amount,
        currency: "CAD",
        kind: input.amount < 0 ? "refund" : "spend",
        is_excluded: false,
        category_id: input.categoryId,
        is_confirmed: input.categoryId !== null,
        dedup_hash: dedupHashOf(input.date, input.amount, merchantNormalized),
      })
      .select("*").single();
    if (error) throw error;
    return txnFromRow(data);
  }

  async updateSource(
    id: string,
    patch: Partial<Pick<Source, "label" | "ownerMemberId" | "kind">>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("sources")
      .update({
        ...(patch.label !== undefined && { label: patch.label }),
        ...(patch.ownerMemberId !== undefined && { owner_member_id: patch.ownerMemberId }),
        ...(patch.kind !== undefined && { kind: patch.kind }),
      })
      .eq("id", id);
    if (error) throw error;
    if (patch.ownerMemberId) {
      const { error: txnError } = await this.supabase
        .from("transactions")
        .update({ owner_member_id: patch.ownerMemberId })
        .eq("source_id", id);
      if (txnError) throw txnError;
    }
  }

  async deleteSource(id: string): Promise<{ removedTransactions: number }> {
    const { count } = await this.supabase
      .from("transactions").select("id", { count: "exact", head: true }).eq("source_id", id);
    // Cascades in the schema remove transactions and batches with the source.
    const { error } = await this.supabase.from("sources").delete().eq("id", id);
    if (error) throw error;
    return { removedTransactions: count ?? 0 };
  }

  async getMonthNote(month: string): Promise<MonthNote | null> {
    const { data, error } = await this.supabase
      .from("month_notes").select("*")
      .eq("household_id", this.householdId).eq("month", month).maybeSingle();
    if (error) throw error;
    return data ? { month: data.month, body: data.body, updatedAt: data.updated_at } : null;
  }

  async saveMonthNote(month: string, body: string): Promise<MonthNote> {
    const updatedAt = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("month_notes")
      .upsert(
        { ...this.hh(), month, body, updated_at: updatedAt },
        { onConflict: "household_id,month" },
      )
      .select("*").single();
    if (error) throw error;
    return { month: data.month, body: data.body, updatedAt: data.updated_at };
  }
}

/** Resolves the signed-in user's household; throws typed errors if not ready. */
export async function getSupabaseStore(): Promise<DataStore> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new NotSignedInError();
  const { data: membership, error } = await supabase
    .from("household_members").select("household_id")
    .eq("user_id", auth.user.id).limit(1).maybeSingle();
  // A failed query is not "no household" — don't misroute members to onboarding.
  if (error) throw error;
  if (!membership) throw new NoHouseholdError();
  return new SupabaseStore(supabase, membership.household_id);
}
