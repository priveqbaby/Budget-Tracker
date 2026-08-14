export type SignConvention = "charges_positive" | "debits_negative";

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  sign: SignConvention;
}

export type TransactionKind = "spend" | "refund" | "payment";

/** A statement row after parsing and canonicalization. Money is integer cents, spend positive. */
export interface ParsedRow {
  date: string; // ISO YYYY-MM-DD
  description: string;
  merchantNormalized: string;
  amount: number; // cents, canonical: spend positive, credits negative
  currency: string;
  kind: TransactionKind;
  isExcluded: boolean;
  dedupHash: string;
}

export interface ParseIssue {
  rowIndex: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  issues: ParseIssue[];
}

export interface MerchantRule {
  merchantNormalized: string;
  categoryId: string;
}

export interface CategorizedRow extends ParsedRow {
  categoryId: string | null;
  /** How the category was assigned; Claude assignments stay unconfirmed until reviewed. */
  categorySource: "rule" | "claude" | "manual" | null;
}
