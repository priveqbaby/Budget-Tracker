import type { Category, IncomeEntry, MonthData, Transaction } from "@/lib/data/types";
import { incomeForMonth } from "@/lib/data/store";

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
    /** Statement spend filed against this line, so nothing disappears when a
        recurring bill moves onto the checklist. */
    spent: number;
    transactions: Transaction[];
  }>;
  totalVariableSpent: number;
  totalVariableCap: number;
  /**
   * The unallocated-surplus line (PRD v2 §2.3). `cap` is what is actually
   * available this month — derived from recorded income when there is any,
   * otherwise the plan's figure (PRD v3 §2.2).
   */
  surplus: {
    cap: number;
    drawn: number;
    left: number;
    isDerived: boolean;
    planned: number;
  } | null;
  /**
   * Recorded income and the surplus it implies (PRD v3). `isPlanned` means no
   * income was recorded for this month, so `surplus` fell back to the plan's
   * figure rather than reporting a misleading shortfall.
   */
  income: {
    total: number;
    byMember: Record<string, number>;
    entries: IncomeEntry[];
    allocated: number;
    plannedSurplus: number;
    actualSurplus: number;
    isPlanned: boolean;
    savingsTarget: number;
  };
  uncategorized: Transaction[];
  unconfirmedCount: number;
  overCount: number;
  watchCount: number;
  verdict: { status: BudgetStatus; headline: string };
}

/**
 * The month as one tank of money: what came in, what has left, what is still
 * promised, and what is genuinely yours at the end of it.
 *
 * The three parts always sum to income, so the bar the dashboard draws from
 * this can never lie about the total.
 */
export interface MonthFlow {
  /** Everything recorded this month — or the plan's implied income when nothing is. */
  income: number;
  /** True when no income was recorded and `income` is the plan's figure. */
  isPlanned: boolean;
  /** Money already gone: variable spend, unfiled spend, and fixed lines paid or charged. */
  spent: number;
  variableSpent: number;
  fixedSpent: number;
  /** Still promised: unpaid fixed lines and the unspent room left in every cap. */
  committed: number;
  /** income − spent. What is still in the account right now. */
  left: number;
  /** income − spent − committed. Yours once this month's plan is honoured. */
  free: number;
  /** The plan's surplus — the mark `free` is trying to clear. */
  plannedSurplus: number;
  goalMet: boolean;
}

/**
 * A fixed line's money is out when it is ticked paid or when a statement row
 * lands on it, whichever is larger — never both, or every bill on a card would
 * be counted twice.
 */
function fixedOutflow(f: { amount: number; isPaid: boolean; spent: number }): number {
  return Math.max(f.isPaid ? f.amount : 0, f.spent, 0);
}

/** The parts of a month the tank is computed from — nothing else is needed. */
export interface FlowParts {
  income: number;
  isPlanned: boolean;
  plannedSurplus: number;
  /** A finished month has nothing left to promise. */
  monthIsOver: boolean;
  variable: Array<{ cap: number; spent: number }>;
  /** Spend filed against no category: no cap to come out of, so it draws from free. */
  uncategorizedSpent: number;
  fixed: Array<{ amount: number; isPaid: boolean; spent: number }>;
}

/**
 * The one place the tank's arithmetic lives. The dashboard calls this on the
 * server for the truth and again on the client for every optimistic tick, so a
 * checkbox moves the bar before the round trip — same function, no drift.
 */
export function flowFrom(p: FlowParts): MonthFlow {
  const fixedSpent = p.fixed.reduce((sum, f) => sum + fixedOutflow(f), 0);
  const fixedCommitted = p.fixed.reduce(
    (sum, f) => sum + Math.max(0, f.amount - fixedOutflow(f)),
    0,
  );
  const variableSpent =
    p.variable.reduce((sum, v) => sum + v.spent, 0) + p.uncategorizedSpent;
  const variableCommitted = p.variable.reduce(
    (sum, v) => sum + Math.max(0, v.cap - v.spent),
    0,
  );

  const spent = variableSpent + fixedSpent;
  // Room the caps never used was money kept, so once the month is over it is
  // free, not committed. Without this, browsing July would still claim a third
  // of its income was spoken for.
  const committed = p.monthIsOver ? 0 : fixedCommitted + variableCommitted;
  const left = p.income - spent;
  const free = left - committed;

  return {
    income: p.income,
    isPlanned: p.isPlanned,
    spent,
    variableSpent,
    fixedSpent,
    committed,
    left,
    free,
    plannedSurplus: p.plannedSurplus,
    goalMet: free >= p.plannedSurplus,
  };
}

export function monthFlow(s: MonthSummary): MonthFlow {
  return flowFrom({
    // With nothing recorded, a $0 tank would be useless and would read as a
    // catastrophe; fall back to the income the plan implies and say so.
    income: s.income.isPlanned
      ? s.income.allocated + s.income.plannedSurplus
      : s.income.total,
    isPlanned: s.income.isPlanned,
    plannedSurplus: s.income.plannedSurplus,
    monthIsOver: s.elapsedFraction >= 1,
    variable: s.variable.map((v) => ({ cap: v.cap, spent: v.spent })),
    uncategorizedSpent: s.uncategorized.reduce((sum, t) => sum + t.amount, 0),
    fixed: s.fixed.map((f) => ({ amount: f.amount, isPaid: f.isPaid, spent: f.spent })),
  });
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function summarizeMonth(
  data: MonthData,
  categories: Category[],
  todayIso: string,
  options: { incomeEntries?: IncomeEntry[]; savingsTarget?: number } = {},
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
      const txns = countable.filter((t) => t.categoryId === category.id);
      return {
        category,
        amount: fp?.amount ?? capOf(category),
        isPaid: fp?.isPaid ?? false,
        spent: txns.reduce((sum, t) => sum + t.amount, 0),
        transactions: txns,
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
  // Only capped lines can be "over" — a zero-cap line reads as ok everywhere
  // else, so counting it here would drain the surplus invisibly.
  const drawn = variable.reduce(
    (s, v) => s + (v.cap > 0 ? Math.max(0, v.spent - v.cap) : 0),
    0,
  );
  // Income and the surplus it implies — derived once and shared by both the
  // income strip and the overage strip, which must always agree (PRD v3 §2.2).
  const monthIncome = incomeForMonth(options.incomeEntries ?? [], data.month);
  const incomeTotal = monthIncome.reduce((s, e) => s + e.amount, 0);
  const hasIncome = monthIncome.length > 0;

  // Allocated must match what the dashboard shows: fixed lines report the
  // amount on their fixed_payments row when one exists (that is what the
  // checklist displays), everything else reports its cap.
  const allocated = categories
    .filter((c) => !c.isSurplus)
    .reduce((sum, c) => {
      if (c.isFixed) {
        const fp = data.fixedPayments.find((f) => f.categoryId === c.id);
        return sum + (fp?.amount ?? capOf(c));
      }
      return sum + capOf(c);
    }, 0);

  // Overages draw against whatever surplus actually exists this month, not the
  // planning constant — so a tax-return month can genuinely absorb more.
  const availableSurplus = hasIncome ? incomeTotal - allocated : surplusCap;
  const surplus = surplusCategory
    ? {
        cap: availableSurplus,
        drawn,
        left: availableSurplus - drawn,
        isDerived: hasIncome,
        planned: surplusCap,
      }
    : null;

  // --- Income (PRD v3) ----------------------------------------------------
  const incomeByMember: Record<string, number> = {};
  for (const e of monthIncome) {
    const key = e.memberId ?? "household";
    incomeByMember[key] = (incomeByMember[key] ?? 0) + e.amount;
  }
  const income = {
    total: incomeTotal,
    byMember: incomeByMember,
    entries: monthIncome,
    allocated,
    plannedSurplus: surplusCap,
    // With nothing recorded, reporting income − allocated would show a huge
    // fake shortfall; fall back to the plan and label it.
    actualSurplus: availableSurplus,
    isPlanned: !hasIncome,
    savingsTarget: options.savingsTarget ?? 0,
  };

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
    income,
    uncategorized,
    unconfirmedCount,
    overCount,
    watchCount,
    verdict,
  };
}
