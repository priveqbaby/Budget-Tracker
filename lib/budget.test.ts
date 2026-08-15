import { describe, expect, it } from "vitest";
import { summarizeMonth } from "./budget";
import type { Category, IncomeEntry, MonthData, Transaction } from "./data/types";

const cat = (over: Partial<Category> & Pick<Category, "id" | "name" | "monthlyCap">): Category => ({
  isFixed: false, isSurplus: false, sortOrder: 0, ...over,
});

// A miniature plan: $2,000 allocated + $500 planned surplus = $2,500 income to balance.
const categories: Category[] = [
  cat({ id: "rent", name: "Rent", monthlyCap: 150000, isFixed: true }),
  cat({ id: "food", name: "Food", monthlyCap: 50000 }),
  cat({ id: "surplus", name: "Unallocated surplus", monthlyCap: 50000, isSurplus: true }),
];

const txn = (over: Partial<Transaction>): Transaction => ({
  id: "t1", sourceId: "s1", ownerMemberId: "leon", date: "2026-08-05",
  description: "IGA", merchantNormalized: "IGA", amount: 10000, currency: "CAD",
  kind: "spend", isExcluded: false, categoryId: "food", isConfirmed: true,
  dedupHash: "h", importBatchId: null, ...over,
});

const monthData = (transactions: Transaction[] = []): MonthData => ({
  month: "2026-08", transactions, fixedPayments: [], monthCaps: [],
});

const recurring = (amount: number, id = "i1"): IncomeEntry => ({
  id, memberId: "leon", label: "floor", kind: "contribution",
  amount, isRecurring: true, month: null,
});

const oneOff = (amount: number, month: string, id = "i2"): IncomeEntry => ({
  id, memberId: null, label: "tax return", kind: "tax_return",
  amount, isRecurring: false, month,
});

describe("income and derived surplus (PRD v3)", () => {
  it("falls back to the planned surplus when no income is recorded", () => {
    const s = summarizeMonth(monthData(), categories, "2026-08-14");
    expect(s.income.total).toBe(0);
    expect(s.income.isPlanned).toBe(true);
    expect(s.income.actualSurplus).toBe(50000); // the plan's $500, not a fake shortfall
  });

  it("derives surplus from recorded income", () => {
    const s = summarizeMonth(monthData(), categories, "2026-08-14", {
      incomeEntries: [recurring(250000)],
    });
    expect(s.income.total).toBe(250000);
    expect(s.income.allocated).toBe(200000); // rent + food, never the surplus line
    expect(s.income.actualSurplus).toBe(50000);
    expect(s.income.isPlanned).toBe(false);
  });

  it("a windfall grows the surplus without touching any cap", () => {
    const s = summarizeMonth(monthData(), categories, "2026-08-14", {
      incomeEntries: [recurring(250000), oneOff(318000, "2026-08")],
    });
    expect(s.income.actualSurplus).toBe(368000);
    expect(s.income.plannedSurplus).toBe(50000);
    expect(s.totalVariableCap).toBe(50000); // Food's cap is untouched by the windfall
  });

  it("a one-off only counts in its own month", () => {
    const entries = [recurring(250000), oneOff(318000, "2026-07")];
    const august = summarizeMonth(monthData(), categories, "2026-08-14", { incomeEntries: entries });
    expect(august.income.actualSurplus).toBe(50000);
    expect(august.income.entries).toHaveLength(1);
  });

  it("reports a shortfall honestly when income does not cover the plan", () => {
    const s = summarizeMonth(monthData(), categories, "2026-08-14", {
      incomeEntries: [recurring(150000)],
    });
    expect(s.income.actualSurplus).toBe(-50000);
    expect(s.income.isPlanned).toBe(false);
  });

  it("splits income by member and carries the savings target", () => {
    const s = summarizeMonth(monthData(), categories, "2026-08-14", {
      incomeEntries: [
        recurring(150000, "a"),
        { ...recurring(100000, "b"), memberId: "sara" },
        oneOff(318000, "2026-08"),
      ],
      savingsTarget: 100000,
    });
    expect(s.income.byMember.leon).toBe(150000);
    expect(s.income.byMember.sara).toBe(100000);
    expect(s.income.byMember.household).toBe(318000); // unattributed entries
    expect(s.income.savingsTarget).toBe(100000);
  });

  it("the surplus line never receives spend and stays out of the variable list", () => {
    const s = summarizeMonth(
      monthData([txn({ categoryId: "surplus", amount: 9999 })]),
      categories,
      "2026-08-14",
    );
    expect(s.variable.map((v) => v.category.id)).toEqual(["food"]);
    // Spend filed against the surplus line belongs to no variable category, so it
    // is neither counted in a cap nor silently dropped.
    expect(s.totalVariableSpent).toBe(0);
  });
});
