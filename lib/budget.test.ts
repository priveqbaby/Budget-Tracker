import { describe, expect, it } from "vitest";
import { monthFlow, summarizeMonth } from "./budget";
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

describe("the income chain the header reads out", () => {
  const salary = (over: Partial<IncomeEntry>): IncomeEntry => ({
    id: "s1", memberId: "leon", label: "salary", kind: "salary",
    amount: 337300, grossAmount: 757600, savingsAmount: 182600,
    isRecurring: true, month: null, ...over,
  });

  it("gross → take-home → into savings → joint account, in that order", () => {
    const s = summarizeMonth(monthData(), categories, "2026-08-14", {
      incomeEntries: [
        salary({}),
        salary({ id: "s2", memberId: "sara", amount: 324300, grossAmount: 708300, savingsAmount: 173900 }),
      ],
    });
    expect(s.income.gross).toBe(1465900);       // $14,659 combined
    expect(s.income.takeHome).toBe(1018100);    // $10,181 after tax
    expect(s.income.intoSavings).toBe(356500);  // $3,565 into FHSA/TFSA/RRSP
    expect(s.income.total).toBe(661600);        // $6,616 reaching the budget
    // The links close: take-home less savings is what the budget runs on.
    expect(s.income.takeHome - s.income.intoSavings).toBe(s.income.total);
  });

  it("an entry with nothing withheld reports itself at every link", () => {
    const s = summarizeMonth(monthData(), categories, "2026-08-14", {
      incomeEntries: [oneOff(318000, "2026-08")],
    });
    expect(s.income.gross).toBe(318000);
    expect(s.income.takeHome).toBe(318000);
    expect(s.income.intoSavings).toBe(0);
    expect(s.income.total).toBe(318000);
  });

  it("gross is never smaller than what actually arrived", () => {
    // A bad gross figure must not make the chain read backwards.
    const s = summarizeMonth(monthData(), categories, "2026-08-14", {
      incomeEntries: [salary({ grossAmount: 1000 })],
    });
    expect(s.income.gross).toBe(s.income.takeHome);
  });
});

describe("month flow — the tank the dashboard draws", () => {
  const flowOf = (
    data: MonthData,
    entries: IncomeEntry[] = [recurring(250000)],
  ) => monthFlow(summarizeMonth(data, categories, "2026-08-14", { incomeEntries: entries }));

  it("the three parts always add up to income", () => {
    const f = flowOf(monthData([txn({ amount: 12345 })]));
    expect(f.spent + f.committed + f.free).toBe(f.income);
  });

  it("nothing spent: everything is committed and free is the planned surplus", () => {
    const f = flowOf(monthData());
    expect(f.spent).toBe(0);
    expect(f.committed).toBe(200000); // rent $1,500 unpaid + food's whole $500 cap
    expect(f.free).toBe(50000);
    expect(f.goalMet).toBe(true);
  });

  it("spending inside a cap moves money from committed to spent, leaving free alone", () => {
    const f = flowOf(monthData([txn({ amount: 30000 })]));
    expect(f.spent).toBe(30000);
    expect(f.committed).toBe(170000);
    expect(f.free).toBe(50000); // the plan is being honoured, so the surplus holds
  });

  it("spending past a cap eats free and misses the goal", () => {
    const f = flowOf(monthData([txn({ amount: 90000 })])); // $900 against a $500 cap
    expect(f.spent).toBe(90000);
    expect(f.committed).toBe(150000); // food has no room left; only rent is still promised
    expect(f.free).toBe(10000);
    expect(f.goalMet).toBe(false);
  });

  it("extra income lifts free without touching a cap", () => {
    const before = flowOf(monthData([txn({ amount: 90000 })]));
    const after = flowOf(monthData([txn({ amount: 90000 })]), [
      recurring(250000),
      oneOff(100000, "2026-08"),
    ]);
    expect(after.income - before.income).toBe(100000);
    expect(after.free - before.free).toBe(100000);
    expect(after.committed).toBe(before.committed);
    expect(after.goalMet).toBe(true);
  });

  it("a fixed line ticked paid counts once, not twice, when its charge also landed", () => {
    const data: MonthData = {
      month: "2026-08",
      transactions: [txn({ categoryId: "rent", amount: 149000 })],
      fixedPayments: [{ id: "fp1", categoryId: "rent", month: "2026-08", amount: 150000, isPaid: true }],
      monthCaps: [],
    };
    const f = monthFlow(
      summarizeMonth(data, categories, "2026-08-14", { incomeEntries: [recurring(250000)] }),
    );
    // The larger of the two, never the sum: $1,500, not $2,990.
    expect(f.fixedSpent).toBe(150000);
    expect(f.spent).toBe(150000);
    expect(f.committed).toBe(50000); // food's cap only
    expect(f.free).toBe(50000);
  });

  it("an unpaid fixed line whose charge already landed is spent, not committed", () => {
    const data: MonthData = {
      month: "2026-08",
      transactions: [txn({ categoryId: "rent", amount: 150000 })],
      fixedPayments: [{ id: "fp1", categoryId: "rent", month: "2026-08", amount: 150000, isPaid: false }],
      monthCaps: [],
    };
    const f = monthFlow(
      summarizeMonth(data, categories, "2026-08-14", { incomeEntries: [recurring(250000)] }),
    );
    expect(f.fixedSpent).toBe(150000);
    expect(f.committed).toBe(50000);
  });

  it("unfiled spend draws straight from free, and filing it gives free back", () => {
    const unfiled = flowOf(monthData([txn({ categoryId: null, amount: 20000 })]));
    expect(unfiled.free).toBe(30000); // $500 surplus less the $200 nobody has filed

    const filed = flowOf(monthData([txn({ categoryId: "food", amount: 20000 })]));
    expect(filed.free).toBe(50000); // absorbed by Food's cap, which had room
  });

  it("a finished month keeps its unspent caps as free, not as committed", () => {
    // Same spend, read from September: June is over, so the $200 Food never
    // used and the rent that was never paid are money the household still has.
    const data: MonthData = { month: "2026-06", transactions: [txn({ date: "2026-06-05", amount: 30000 })], fixedPayments: [], monthCaps: [] };
    const f = monthFlow(
      summarizeMonth(data, categories, "2026-09-02", { incomeEntries: [recurring(250000)] }),
    );
    expect(f.committed).toBe(0);
    expect(f.spent).toBe(30000);
    expect(f.free).toBe(220000);
  });

  it("falls back to the plan's income when nothing is recorded", () => {
    const f = monthFlow(summarizeMonth(monthData(), categories, "2026-08-14"));
    expect(f.isPlanned).toBe(true);
    expect(f.income).toBe(250000); // $2,000 allocated + $500 planned surplus
    expect(f.free).toBe(50000);
  });

  it("income that does not cover the plan drives free negative", () => {
    const f = flowOf(monthData(), [recurring(150000)]);
    expect(f.free).toBe(-50000);
    expect(f.goalMet).toBe(false);
  });
});
