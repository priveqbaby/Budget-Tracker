import type { ColumnMapping, TransactionKind } from "@/lib/import/types";

export interface Member {
  id: string;
  displayName: string;
  role: "owner" | "member";
}

export interface Household {
  id: string;
  name: string;
  members: Member[];
  /** Monthly savings intent, cents. Measured against actual surplus, never enforced. */
  savingsTarget: number;
}

export type IncomeKind =
  | "contribution"
  | "salary"
  | "trading"
  | "side_hustle"
  | "tax_return"
  | "gift"
  | "other";

export interface IncomeEntry {
  id: string;
  memberId: string | null;
  label: string;
  kind: IncomeKind;
  amount: number; // cents, positive
  /** Recurring entries apply to every month and carry no month of their own. */
  isRecurring: boolean;
  month: string | null; // YYYY-MM for one-offs
}

export interface Category {
  id: string;
  name: string;
  monthlyCap: number; // cents
  isFixed: boolean;
  /** The unallocated-surplus line: no meter, no transactions, excluded from totals. */
  isSurplus: boolean;
  sortOrder: number;
}

export type SourceKind = "credit_card" | "debit" | "chequing" | "cash" | "other";

export interface MonthNote {
  month: string; // YYYY-MM
  body: string;
  updatedAt: string; // ISO timestamp
}

export interface MonthCap {
  categoryId: string;
  month: string; // YYYY-MM
  cap: number; // cents
}

export interface Source {
  id: string;
  ownerMemberId: string;
  label: string;
  kind: SourceKind;
  columnMapping: ColumnMapping | null;
}

export interface Transaction {
  id: string;
  sourceId: string;
  ownerMemberId: string;
  date: string; // ISO
  description: string;
  merchantNormalized: string;
  amount: number; // cents, spend positive
  currency: string;
  kind: TransactionKind;
  isExcluded: boolean;
  categoryId: string | null;
  isConfirmed: boolean;
  dedupHash: string;
  importBatchId: string | null;
}

export interface FixedPayment {
  id: string;
  categoryId: string;
  month: string;
  isPaid: boolean;
  amount: number; // cents
}

export interface Invite {
  id: string;
  email: string;
  role: "owner" | "member";
  acceptedAt: string | null;
}

export interface StoredRule {
  merchantNormalized: string;
  categoryId: string;
  hitCount: number;
}

export interface ImportBatchMeta {
  id: string;
  sourceId: string;
  filename: string;
  rowCount: number;
  autoCategorizedCount: number;
  manualCount: number;
  createdAt: string;
}

export interface CommitRow {
  date: string;
  description: string;
  merchantNormalized: string;
  amount: number;
  currency: string;
  kind: TransactionKind;
  isExcluded: boolean;
  categoryId: string | null;
  isConfirmed: boolean;
  dedupHash: string;
}

export interface MonthData {
  month: string;
  transactions: Transaction[];
  fixedPayments: FixedPayment[];
  monthCaps: MonthCap[];
}
