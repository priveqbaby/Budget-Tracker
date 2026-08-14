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
}

export interface Category {
  id: string;
  name: string;
  monthlyCap: number; // cents
  isFixed: boolean;
  sortOrder: number;
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
