import type { Category, MonthData, Transaction } from "@/lib/data/types";

export type BudgetStatus = "ok" | "watch" | "over";

export interface CategorySummary {
  category: Category;
  cap: number; // month_caps snapshot when present, else current cap
  spent: number; // cents; refunds subtract, payments never counted
  /** Color follows proximity to the cap (PRD §6.3): over ≥100%, watch ≥80%. */
  status: BudgetStatus;
  /** Text-only pace flag; needs ≥3 transactions so early single bills stay quiet. */
  paceAhead: boolean;
  transactions: Transaction[];
  byMember: Record<string, number>;
  unconfirmedCount: number;
}

export interface MonthSummary {
  month: string;
  elapsedFraction: number; // 0..1 of the month that has passed
  daysElapsed: number;
  daysInMonth: number;
  variable: CategorySummary[];
  fixed: Array<{
    category: Category;
    amount: number;
    isPaid: boolean;
  }>;
  totalVariableSpent: number;
  totalVariableCap: number;
  /** The unallocated-surplus line, if the plan has one (PRD v2 §2.3). */
  surplus: { cap: number; drawn: number; left: number } | null;
  uncategorized: Transaction[];
  unconfirmedCount: number;
  overCount: number;
  watchCount: number;
  verdict: { status: BudgetStatus; headline: string };
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function summarizeMonth(
  data: MonthData,
  categories: Category[],
  todayIso: string,
): MonthSummary {
  const days = daysInMonth(data.month);
  const today = todayIso.slice(0, 7);
  let daysElapsed: number;
  if (data.month < today) daysElapsed = days;
  else if (data.month > today) daysElapsed = 0;
  else daysElapsed = Number(todayIso.slice(8, 10));
  const elapsed = days === 0 ? 1 : daysElapsed / days;

  const capOf = (c: Category) =>
    data.monthCaps.find((mc) => mc.categoryId === c.id)?.cap ?? c.monthlyCap;

  const countable = data.transactions.filter((t) => !t.isExcluded && t.kind !== "payment");

  const variable = categories
    .filter((c) => !c.isFixed && !c.isSurplus)
    .map<CategorySummary>((category) => {
      const txns = countable.filter((t) => t.categoryId === category.id);
      const spent = txns.reduce((sum, t) => sum + t.amount, 0);
      const cap = capOf(category);
      const ratio = cap > 0 ? spent / cap : 0;
      let status: BudgetStatus = "ok";
      if (ratio >= 1) {
        status = "over";
      } else if (ratio >= 0.8 && txns.length >= 3) {
        // "Near cap" is a warning about spending that is still happening. A
        // line whose whole month is one or two bills (Wifi, Cell, Prime) sits
        // at ~99% by design — flagging it every month is crying wolf.
        status = "watch";
      }
      const paceAhead =
        status === "ok" &&
        elapsed > 0 && elapsed < 1 &&
        txns.length >= 3 &&
        spent / elapsed > cap * 1.15;
      const byMember: Record<string, number> = {};
      for (const t of txns) byMember[t.ownerMemberId] = (byMember[t.ownerMemberId] ?? 0) + t.amount;
      return {
        category, cap, spent, status, paceAhead,
        transactions: txns,
        byMember,
        unconfirmedCount: txns.filter((t) => !t.isConfirmed).length,
      };
    });

  const fixed = categories
    .filter((c) => c.isFixed)
    .map((category) => {
      const fp = data.fixedPayments.find((f) => f.categoryId === category.id);
      return {
        category,
        amount: fp?.amount ?? capOf(category),
        isPaid: fp?.isPaid ?? false,
      };
    });

  const uncategorized = countable.filter((t) => t.categoryId === null);

  // Uncategorized money is still money spent, so it belongs in the headline —
  // otherwise filing a transaction into a category would make the total jump.
  const totalVariableSpent =
    variable.reduce((s, v) => s + v.spent, 0) +
    uncategorized.reduce((s, t) => s + t.amount, 0);
  const totalVariableCap = variable.reduce((s, v) => s + v.cap, 0);

  // Surplus is a display of the manual-draw decision, never an automation:
  // drawn = the sum of current overages across variable categories.
  const surplusCategory = categories.find((c) => c.isSurplus);
  const surplusCap = surplusCategory ? capOf(surplusCategory) : 0;
  const drawn = variable.reduce((s, v) => s + Math.max(0, v.spent - v.cap), 0);
  const surplus = surplusCategory
    ? { cap: surplusCap, drawn, left: surplusCap - drawn }
    : null;

  const unconfirmedCount = countable.filter((t) => !t.isConfirmed).length;

  const overCount = variable.filter((v) => v.status === "over").length;
  const watchCount = variable.filter((v) => v.status === "watch").length;

  let verdict: MonthSummary["verdict"];
  const watchNames = variable
    .filter((v) => v.status === "watch" || v.paceAhead)
    .map((v) => v.category.name);
  if (overCount > 0) {
    verdict = {
      status: "over",
      headline: overCount === 1 ? "Over in 1 category" : `Over in ${overCount} categories`,
    };
  } else if (watchNames.length > 0) {
    verdict = {
      status: "watch",
      headline:
        watchNames.length === 1
          ? `Watch ${watchNames[0].toLowerCase()}`
          : `Watch ${watchNames.length} categories`,
    };
  } else {
    verdict = { status: "ok", headline: "On track" };
  }

  return {
    month: data.month,
    elapsedFraction: elapsed,
    daysElapsed,
    daysInMonth: days,
    variable,
    fixed,
    totalVariableSpent,
    totalVariableCap,
    surplus,
    uncategorized,
    unconfirmedCount,
    overCount,
    watchCount,
    verdict,
  };
}
