import Papa from "papaparse";
import type { ColumnMapping, ParseResult, ParsedRow, TransactionKind } from "./types";
import { normalizeMerchant } from "./normalize";

/** Rows matching these are card payments, not spend. Excluded by default, manual override in review. */
const PAYMENT_PATTERNS = [
  /PAYMENT\s+RECEIVED/i,
  /PAYMENT\s*-\s*THANK\s*YOU/i,
  /PAIEMENT\s*-\s*MERCI/i,
  /PREAUTHORIZED\s+PAYMENT/i,
  /AUTOPAY\s+PAYMENT/i,
  /ONLINE\s+PAYMENT.*THANK/i,
];

export function isPaymentRow(description: string): boolean {
  return PAYMENT_PATTERNS.some((p) => p.test(description));
}

/** Parse "$1,234.56", "(45.00)", "-45.00", "45,00" → integer cents; NaN when unparseable. */
export function parseAmountToCents(raw: string): number {
  let s = raw.trim();
  if (s === "") return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$\s]/g, "");
  if (s.startsWith("-")) {
    negative = !negative ? true : negative;
    s = s.slice(1);
  }
  // European-style "1.234,56" or bare "45,00"
  if (/,\d{2}$/.test(s) && !/\.\d{2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return NaN;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** Accepts ISO, MM/DD/YYYY, DD MMM YYYY / DD MMM. YYYY (Amex). Returns ISO or null. */
export function parseDateToIso(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\.?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].toUpperCase()];
    if (month) return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function dedupHashOf(date: string, amount: number, merchantNormalized: string): string {
  return `${date}|${amount}|${merchantNormalized}`;
}

/**
 * Parse CSV text through a column mapping into canonical rows.
 * Canonical sign convention: spend positive, credits negative.
 */
export function parseStatement(csvText: string, mapping: ColumnMapping): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const rows: ParsedRow[] = [];
  const issues = parsed.errors
    .filter((e) => e.row !== undefined)
    .map((e) => ({ rowIndex: e.row ?? -1, message: e.message }));

  parsed.data.forEach((record, i) => {
    const rawDate = record[mapping.date];
    const rawDescription = record[mapping.description];
    const rawAmount = record[mapping.amount];

    if (rawDate === undefined || rawDescription === undefined || rawAmount === undefined) {
      issues.push({ rowIndex: i, message: "Row is missing a mapped column" });
      return;
    }

    const date = parseDateToIso(rawDate);
    if (!date) {
      issues.push({ rowIndex: i, message: `Unparseable date "${rawDate}"` });
      return;
    }

    let amount = parseAmountToCents(rawAmount);
    if (Number.isNaN(amount)) {
      issues.push({ rowIndex: i, message: `Unparseable amount "${rawAmount}"` });
      return;
    }

    // Canonicalize: with debits_negative sources, a -$62.10 debit is $62.10 of spend.
    if (mapping.sign === "debits_negative") amount = -amount;

    const description = rawDescription.trim();
    const payment = isPaymentRow(description);
    const kind: TransactionKind = payment ? "payment" : amount < 0 ? "refund" : "spend";
    const merchantNormalized = normalizeMerchant(description);

    rows.push({
      date,
      description,
      merchantNormalized,
      amount,
      currency: "CAD",
      kind,
      isExcluded: payment,
      dedupHash: dedupHashOf(date, amount, merchantNormalized),
    });
  });

  return { rows, issues };
}
