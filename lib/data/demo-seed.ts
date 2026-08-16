import { dedupHashOf } from "@/lib/import/parse";
import { normalizeMerchant } from "@/lib/import/normalize";
import type {
  Category,
  FixedPayment,
  ImportBatchMeta,
  IncomeEntry,
  Invite,
  Member,
  MonthCap,
  MonthNote,
  Source,
  StoredRule,
  Transaction,
} from "./types";

/** Deterministic PRNG so the demo dashboard is stable across restarts. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_TODAY = "2026-08-14";

/** Monthly savings intent (cents). Measured against actual surplus, never enforced. */
export const DEMO_SAVINGS_TARGET = 100000;

export const members: Member[] = [
  { id: "leon", displayName: "Leon", role: "owner" },
  { id: "sara", displayName: "Sara", role: "member" },
];

export const sources: Source[] = [
  {
    id: "src-amex",
    ownerMemberId: "leon",
    label: "Leon — Amex Cobalt",
    kind: "credit_card",
    columnMapping: { date: "Date", description: "Description", amount: "Amount", sign: "charges_positive" },
  },
  {
    id: "src-ws-leon",
    ownerMemberId: "leon",
    label: "Leon — Wealthsimple Visa",
    kind: "credit_card",
    columnMapping: { date: "date", description: "transaction", amount: "amount", sign: "debits_negative" },
  },
  {
    id: "src-ws-sara",
    ownerMemberId: "sara",
    label: "Sara — Wealthsimple Visa",
    kind: "credit_card",
    columnMapping: { date: "date", description: "transaction", amount: "amount", sign: "debits_negative" },
  },
];

// The 18 Sankey lines (PRD v2 §2.3), caps in cents.
export const categories: Category[] = [
  // Fixed — a paid/unpaid checklist. Recurring bills live here: they arrive on
  // a schedule, so tracking them against a cap tells you nothing new.
  { id: "rent", name: "Rent", monthlyCap: 150000, isFixed: true, isSurplus: false, sortOrder: 0 },
  { id: "debt", name: "Debt payments", monthlyCap: 48800, isFixed: true, isSurplus: false, sortOrder: 1 },
  { id: "travel", name: "Travel", monthlyCap: 66600, isFixed: true, isSurplus: false, sortOrder: 2 },
  { id: "manitoba", name: "Travel to Manitoba", monthlyCap: 16700, isFixed: true, isSurplus: false, sortOrder: 3 },
  { id: "parents", name: "Transfer to parents", monthlyCap: 15000, isFixed: true, isSurplus: false, sortOrder: 4 },
  { id: "cell", name: "Cell", monthlyCap: 12200, isFixed: true, isSurplus: false, sortOrder: 5 },
  { id: "hydro", name: "Hydro", monthlyCap: 8500, isFixed: true, isSurplus: false, sortOrder: 6 },
  { id: "wifi", name: "Wifi", monthlyCap: 6100, isFixed: true, isSurplus: false, sortOrder: 7 },

  // Variable — the lines that actually move, tracked against their caps.
  { id: "food", name: "Food", monthlyCap: 120000, isFixed: false, isSurplus: false, sortOrder: 8 },
  { id: "gym", name: "Gym & tennis", monthlyCap: 50000, isFixed: false, isSurplus: false, sortOrder: 9 },
  { id: "fun", name: "Fun activities", monthlyCap: 36900, isFixed: false, isSurplus: false, sortOrder: 10 },
  { id: "clothing", name: "Clothing", monthlyCap: 25000, isFixed: false, isSurplus: false, sortOrder: 11 },
  { id: "transit", name: "Transit", monthlyCap: 20000, isFixed: false, isSurplus: false, sortOrder: 12 },
  { id: "personal", name: "Haircut & personal", monthlyCap: 20000, isFixed: false, isSurplus: false, sortOrder: 13 },
  { id: "uber", name: "Uber", monthlyCap: 10000, isFixed: false, isSurplus: false, sortOrder: 14 },
  // Amazon Prime folded in here — it was a $8 line of its own.
  { id: "subs", name: "Subscriptions", monthlyCap: 6800, isFixed: false, isSurplus: false, sortOrder: 15 },
  { id: "streaming", name: "Streaming", monthlyCap: 5000, isFixed: false, isSurplus: false, sortOrder: 16 },

  // A round $500 goal. The $69 it used to carry moved onto Fun activities, so
  // allocated ($6,176) + surplus ($500) still equals the $6,676 baseline.
  { id: "surplus", name: "Unallocated surplus", monthlyCap: 50000, isFixed: false, isSurplus: true, sortOrder: 17 },
];

type SourceId = "src-amex" | "src-ws-leon" | "src-ws-sara";
const OWNER: Record<SourceId, string> = {
  "src-amex": "leon",
  "src-ws-leon": "leon",
  "src-ws-sara": "sara",
};

interface Recur {
  categoryId: string;
  merchant: string;
  source: SourceId;
  day: number;
  amount: number; // cents
}

/** Bills and passes that land on the same day every month. */
const recurring: Recur[] = [
  { categoryId: "transit", merchant: "STM MONTREAL QC", source: "src-amex", day: 1, amount: 10450 },
  { categoryId: "hydro", merchant: "HYDRO QUEBEC", source: "src-ws-leon", day: 3, amount: 7140 },
  { categoryId: "wifi", merchant: "VIDEOTRON LTEE", source: "src-ws-leon", day: 4, amount: 6031 },
  { categoryId: "cell", merchant: "FIZZ MOBILE", source: "src-amex", day: 6, amount: 5520 },
  { categoryId: "cell", merchant: "FIZZ MOBILE", source: "src-ws-sara", day: 6, amount: 5750 },
  { categoryId: "streaming", merchant: "NETFLIX.COM", source: "src-amex", day: 2, amount: 2099 },
  { categoryId: "streaming", merchant: "SPOTIFY", source: "src-amex", day: 5, amount: 1699 },
  { categoryId: "streaming", merchant: "CRAVE", source: "src-ws-sara", day: 7, amount: 2299 },
  { categoryId: "subs", merchant: "AMAZON PRIME MEMBER TORONTO ON", source: "src-ws-leon", day: 10, amount: 799 },
  { categoryId: "subs", merchant: "CLAUDE.AI SUBSCRIPTION", source: "src-amex", day: 8, amount: 2875 },
  { categoryId: "subs", merchant: "APPLE.COM/BILL ICLOUD", source: "src-ws-sara", day: 12, amount: 1149 },
  { categoryId: "subs", merchant: "NYTIMES DIGITAL", source: "src-ws-leon", day: 14, amount: 800 },
  { categoryId: "gym", merchant: "ECONOFITNESS", source: "src-amex", day: 2, amount: 2528 },
  { categoryId: "gym", merchant: "ECONOFITNESS", source: "src-ws-sara", day: 2, amount: 2528 },
  { categoryId: "gym", merchant: "CLUB DE TENNIS JARRY MONTREAL", source: "src-ws-leon", day: 9, amount: 8500 },
];

interface Pool {
  categoryId: string;
  merchant: string;
  source: SourceId;
  min: number; // cents
  max: number;
  /** visits per full month */
  times: number;
}

const pools: Pool[] = [
  { categoryId: "food", merchant: "IGA #8221 MONTREAL QC", source: "src-amex", min: 5200, max: 13800, times: 5 },
  { categoryId: "food", merchant: "MAXI #8763 MONTREAL QC", source: "src-amex", min: 4600, max: 11200, times: 2 },
  { categoryId: "food", merchant: "METRO ETS 384912 MONTREAL QC", source: "src-ws-sara", min: 2400, max: 8600, times: 3 },
  { categoryId: "food", merchant: "ADONIS MONTREAL QC", source: "src-ws-sara", min: 3200, max: 7400, times: 1 },
  { categoryId: "food", merchant: "TIM HORTONS #4021 MONTREAL QC", source: "src-amex", min: 635, max: 635, times: 6 },
  { categoryId: "food", merchant: "SQ *CAFE OLIMPICO MONTREAL QC", source: "src-amex", min: 525, max: 675, times: 5 },
  { categoryId: "food", merchant: "UBER EATS MONTREAL QC", source: "src-ws-sara", min: 3100, max: 5600, times: 3 },
  { categoryId: "food", merchant: "TST* LE BUTTERBLUME MONTREAL QC", source: "src-amex", min: 4400, max: 8200, times: 1 },
  { categoryId: "transit", merchant: "BIXI MONTREAL", source: "src-ws-sara", min: 950, max: 2400, times: 2 },
  { categoryId: "uber", merchant: "UBER TRIP MONTREAL QC", source: "src-amex", min: 1250, max: 3400, times: 2 },
  { categoryId: "uber", merchant: "UBER TRIP MONTREAL QC", source: "src-ws-sara", min: 1100, max: 2600, times: 1 },
  { categoryId: "fun", merchant: "CINEMA BANQUE SCOTIA MONTREAL", source: "src-ws-sara", min: 2800, max: 3600, times: 1 },
  { categoryId: "fun", merchant: "SAQ #23041 MONTREAL QC", source: "src-ws-leon", min: 2800, max: 5400, times: 1 },
  { categoryId: "fun", merchant: "STEAMGAMES.COM", source: "src-amex", min: 1400, max: 3200, times: 1 },
  { categoryId: "personal", merchant: "MAISON PRIVEE BARBIER MONTREAL", source: "src-amex", min: 3800, max: 4200, times: 1 },
  { categoryId: "personal", merchant: "AVEDA SALON MONTREAL QC", source: "src-ws-sara", min: 6200, max: 8800, times: 1 },
  { categoryId: "personal", merchant: "PHARMAPRIX #0342 MONTREAL", source: "src-ws-sara", min: 1500, max: 4200, times: 1 },
  { categoryId: "clothing", merchant: "SIMONS MONTREAL QC", source: "src-ws-sara", min: 5800, max: 13800, times: 1 },
];

function iso(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function buildSeed() {
  const rng = mulberry32(1042);
  const transactions: Transaction[] = [];
  let n = 0;

  const push = (
    t: Omit<Transaction, "id" | "merchantNormalized" | "dedupHash" | "currency" | "importBatchId">,
  ) => {
    const merchantNormalized = normalizeMerchant(t.description);
    transactions.push({
      ...t,
      id: `tx-${++n}`,
      merchantNormalized,
      currency: "CAD",
      dedupHash: dedupHashOf(t.date, t.amount, merchantNormalized),
      importBatchId:
        t.sourceId === "src-amex" ? "batch-amex-aug"
        : t.sourceId === "src-ws-leon" ? "batch-wsl-aug"
        : "batch-wss-aug",
    });
  };

  const months = ["2026-06", "2026-07", "2026-08"] as const;
  const cutoffDay: Record<string, number> = { "2026-06": 30, "2026-07": 31, "2026-08": 14 };
  // Food drifts up month over month — the story goal 4 exists to catch.
  const foodFactor: Record<string, number> = { "2026-06": 0.9, "2026-07": 1.0, "2026-08": 1.18 };

  for (const month of months) {
    const cutoff = cutoffDay[month];
    const daysInMonth = month === "2026-06" ? 30 : 31;

    for (const r of recurring) {
      if (r.day > cutoff) continue;
      push({
        sourceId: r.source,
        ownerMemberId: OWNER[r.source],
        date: iso(month, r.day),
        description: r.merchant,
        amount: r.amount,
        kind: "spend",
        isExcluded: false,
        categoryId: r.categoryId,
        isConfirmed: true,
      });
    }

    for (const p of pools) {
      const factor = p.categoryId === "food" ? foodFactor[month] : 1;
      const visits = Math.max(0, Math.round(p.times * factor * (cutoff / daysInMonth) + (rng() - 0.35)));
      for (let v = 0; v < visits; v++) {
        const day = 1 + Math.floor(rng() * cutoff);
        const amount = Math.round(p.min + rng() * (p.max - p.min));
        push({
          sourceId: p.source,
          ownerMemberId: OWNER[p.source],
          date: iso(month, day),
          description: p.merchant,
          amount,
          kind: "spend",
          isExcluded: false,
          categoryId: p.categoryId,
          isConfirmed: true,
        });
      }
    }
  }

  // Deliberate stories:
  // Two identical same-day coffees — count-aware dedup kept both (PRD §8).
  for (let i = 0; i < 2; i++) {
    push({
      sourceId: "src-amex", ownerMemberId: "leon", date: "2026-08-02",
      description: "TIM HORTONS #4021 MONTREAL QC", amount: 635,
      kind: "spend", isExcluded: false, categoryId: "food", isConfirmed: true,
    });
  }
  // A grocery refund: negative spend, stays in its category.
  push({
    sourceId: "src-amex", ownerMemberId: "leon", date: "2026-08-07",
    description: "IGA #8221 MONTREAL QC", amount: -1299,
    kind: "refund", isExcluded: false, categoryId: "food", isConfirmed: true,
  });
  // A card payment: excluded from spend by default.
  push({
    sourceId: "src-amex", ownerMemberId: "leon", date: "2026-08-05",
    description: "PAYMENT RECEIVED - THANK YOU", amount: -95000,
    kind: "payment", isExcluded: true, categoryId: null, isConfirmed: true,
  });
  // July one-off: a Porter flight on the travel line.
  push({
    sourceId: "src-amex", ownerMemberId: "leon", date: "2026-07-18",
    description: "PORTER AIRLINES TORONTO ON", amount: 28600,
    kind: "spend", isExcluded: false, categoryId: "travel", isConfirmed: true,
  });
  // One merchant Claude classified but nobody has reviewed yet.
  push({
    sourceId: "src-ws-sara", ownerMemberId: "sara", date: "2026-08-11",
    description: "LE 9E RESTO BAR MONTREAL QC", amount: 6740,
    kind: "spend", isExcluded: false, categoryId: "food", isConfirmed: false,
  });
  // Two uncategorized rows — the Sankey has no household-goods line, so these
  // sit in the Uncategorized bucket until someone decides (PRD v2 §2.5).
  push({
    sourceId: "src-amex", ownerMemberId: "leon", date: "2026-08-09",
    description: "CANADIAN TIRE #232 MONTREAL", amount: 4812,
    kind: "spend", isExcluded: false, categoryId: null, isConfirmed: false,
  });
  push({
    sourceId: "src-ws-leon", ownerMemberId: "leon", date: "2026-08-12",
    description: "AMAZON.CA*2K4XT8 TORONTO ON", amount: 3699,
    kind: "spend", isExcluded: false, categoryId: null, isConfirmed: false,
  });

  const fixedPayments: FixedPayment[] = [];
  let f = 0;
  for (const month of months) {
    for (const c of categories.filter((c) => c.isFixed)) {
      const isAugust = month === "2026-08";
      fixedPayments.push({
        id: `fp-${++f}`,
        categoryId: c.id,
        month,
        // August: rent and debt are paid, the parent transfer isn't yet.
        // August is mid-flight: the transfer and both travel lines aren't done.
        isPaid: !isAugust || !["parents", "travel", "manitoba"].includes(c.id),
        amount: c.monthlyCap,
      });
    }
  }

  const monthCaps: MonthCap[] = [];
  for (const month of months) {
    for (const c of categories) {
      monthCaps.push({ categoryId: c.id, month, cap: c.monthlyCap });
    }
  }

  const rules: StoredRule[] = [];
  const seenMerchants = new Map<string, { categoryId: string; count: number }>();
  for (const t of transactions) {
    if (!t.categoryId || t.kind === "payment") continue;
    const existing = seenMerchants.get(t.merchantNormalized);
    if (existing) existing.count += 1;
    else seenMerchants.set(t.merchantNormalized, { categoryId: t.categoryId, count: 1 });
  }
  for (const [merchant, { categoryId, count }] of seenMerchants) {
    rules.push({ merchantNormalized: merchant, categoryId, hitCount: count });
  }

  const importBatches: ImportBatchMeta[] = [
    {
      id: "batch-amex-aug", sourceId: "src-amex", filename: "amex-cobalt-aug.csv",
      rowCount: 31, autoCategorizedCount: 28, manualCount: 2,
      createdAt: "2026-08-14T13:05:00Z",
    },
    {
      id: "batch-wsl-aug", sourceId: "src-ws-leon", filename: "ws-visa-leon-aug.csv",
      rowCount: 12, autoCategorizedCount: 11, manualCount: 0,
      createdAt: "2026-08-14T13:09:00Z",
    },
    {
      id: "batch-wss-aug", sourceId: "src-ws-sara", filename: "ws-visa-sara-aug.csv",
      rowCount: 18, autoCategorizedCount: 16, manualCount: 1,
      createdAt: "2026-08-14T13:11:00Z",
    },
  ];

  const invites: Invite[] = [
    { id: "inv-1", email: "sara@example.com", role: "member", acceptedAt: "2026-06-02T10:00:00Z" },
  ];

  const monthNotes: MonthNote[] = [
    {
      month: "2026-06",
      body: "First full month of tracking. Import took about ten minutes for both cards — mostly categorizing merchants the first time. Groceries came in under; ate out less than we thought.",
      updatedAt: "2026-07-01T21:12:00Z",
    },
    {
      month: "2026-07",
      body: "Food creeping up — three Uber Eats weeks in a row while Sara was on deadline. Porter flight to Toronto went on Travel. Streaming is quietly over every month; cancel Crave?",
      updatedAt: "2026-08-02T19:40:00Z",
    },
  ];

  // Income (PRD v3). The two contribution floors are recurring; everything
  // else is recorded as it lands. August carries a tax return, which is the
  // whole point of the feature: the surplus moves without re-planning.
  const incomeEntries: IncomeEntry[] = [
    { id: "inc-1", memberId: "leon", label: "Leon — contribution floor", kind: "contribution",
      amount: 150000, isRecurring: true, month: null },
    { id: "inc-2", memberId: "sara", label: "Sara — contribution floor", kind: "contribution",
      amount: 150000, isRecurring: true, month: null },
    // Gross carries the Sankey's figures: Leon $7,576/mo, Sara $7,083/mo. The
    // gap to net is tax, payroll deductions and the money that goes straight
    // into FHSA/TFSA/RRSP before anything reaches the joint budget.
    { id: "inc-3", memberId: "leon", label: "Leon — salary above floor", kind: "salary",
      amount: 217600, grossAmount: 607600, isRecurring: true, month: null },
    { id: "inc-4", memberId: "sara", label: "Sara — salary above floor", kind: "salary",
      amount: 150000, grossAmount: 558300, isRecurring: true, month: null },
    { id: "inc-5", memberId: "leon", label: "Trading — realized gains", kind: "trading",
      amount: 42350, isRecurring: false, month: "2026-07" },
    { id: "inc-6", memberId: "sara", label: "Freelance design project", kind: "side_hustle",
      amount: 90000, isRecurring: false, month: "2026-07" },
    { id: "inc-7", memberId: null, label: "2025 tax return", kind: "tax_return",
      amount: 318000, isRecurring: false, month: "2026-08" },
    { id: "inc-8", memberId: "leon", label: "Trading — realized gains", kind: "trading",
      amount: 18800, isRecurring: false, month: "2026-08" },
  ];

  return {
    transactions, fixedPayments, monthCaps, rules, importBatches, invites,
    monthNotes, incomeEntries,
  };
}
