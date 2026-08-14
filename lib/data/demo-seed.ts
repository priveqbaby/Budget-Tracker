import { dedupHashOf } from "@/lib/import/parse";
import { normalizeMerchant } from "@/lib/import/normalize";
import type {
  Category,
  FixedPayment,
  ImportBatchMeta,
  Invite,
  Member,
  MonthCap,
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

export const members: Member[] = [
  { id: "leon", displayName: "Leon", role: "owner" },
  { id: "sara", displayName: "Sara", role: "member" },
];

export const sources: Source[] = [
  {
    id: "src-amex",
    ownerMemberId: "leon",
    label: "Leon — Amex Cobalt",
    columnMapping: { date: "Date", description: "Description", amount: "Amount", sign: "charges_positive" },
  },
  {
    id: "src-ws",
    ownerMemberId: "sara",
    label: "Sara — Wealthsimple Visa",
    columnMapping: { date: "date", description: "transaction", amount: "amount", sign: "debits_negative" },
  },
];

// The 17 budget lines from the Sankey, caps in cents.
export const categories: Category[] = [
  { id: "rent", name: "Rent", monthlyCap: 185000, isFixed: true, sortOrder: 0 },
  { id: "debt", name: "Debt repayment", monthlyCap: 45000, isFixed: true, sortOrder: 1 },
  { id: "parents", name: "Parent transfer", monthlyCap: 30000, isFixed: true, sortOrder: 2 },
  { id: "food", name: "Food", monthlyCap: 120000, isFixed: false, sortOrder: 3 },
  { id: "transit", name: "Transit", monthlyCap: 24000, isFixed: false, sortOrder: 4 },
  { id: "cartaxi", name: "Car share & taxis", monthlyCap: 12000, isFixed: false, sortOrder: 5 },
  { id: "hydro", name: "Hydro & utilities", monthlyCap: 9500, isFixed: false, sortOrder: 6 },
  { id: "internet", name: "Internet & phone", monthlyCap: 14000, isFixed: false, sortOrder: 7 },
  { id: "subs", name: "Subscriptions", monthlyCap: 8500, isFixed: false, sortOrder: 8 },
  { id: "health", name: "Health & pharmacy", monthlyCap: 15000, isFixed: false, sortOrder: 9 },
  { id: "fitness", name: "Fitness", monthlyCap: 11000, isFixed: false, sortOrder: 10 },
  { id: "clothing", name: "Clothing", monthlyCap: 15000, isFixed: false, sortOrder: 11 },
  { id: "household", name: "Household goods", monthlyCap: 20000, isFixed: false, sortOrder: 12 },
  { id: "pers-leon", name: "Personal — Leon", monthlyCap: 15000, isFixed: false, sortOrder: 13 },
  { id: "pers-sara", name: "Personal — Sara", monthlyCap: 15000, isFixed: false, sortOrder: 14 },
  { id: "travel", name: "Travel — general", monthlyCap: 66600, isFixed: false, sortOrder: 15 },
  { id: "manitoba", name: "Travel — Manitoba", monthlyCap: 16700, isFixed: false, sortOrder: 16 },
];

interface Recur {
  categoryId: string;
  merchant: string;
  source: "src-amex" | "src-ws";
  day: number;
  amount: number; // cents
}

/** Bills and passes that land on the same day every month. */
const recurring: Recur[] = [
  { categoryId: "transit", merchant: "STM MONTREAL QC", source: "src-amex", day: 1, amount: 10450 },
  { categoryId: "transit", merchant: "STM MONTREAL QC", source: "src-ws", day: 1, amount: 10450 },
  { categoryId: "hydro", merchant: "HYDRO QUEBEC", source: "src-ws", day: 3, amount: 5820 },
  { categoryId: "internet", merchant: "VIDEOTRON LTEE", source: "src-ws", day: 4, amount: 7245 },
  { categoryId: "internet", merchant: "FIZZ MOBILE", source: "src-amex", day: 6, amount: 3105 },
  { categoryId: "internet", merchant: "FIZZ MOBILE", source: "src-ws", day: 6, amount: 3105 },
  { categoryId: "subs", merchant: "NETFLIX.COM", source: "src-amex", day: 2, amount: 2099 },
  { categoryId: "subs", merchant: "SPOTIFY", source: "src-amex", day: 5, amount: 1699 },
  { categoryId: "subs", merchant: "CRAVE", source: "src-ws", day: 7, amount: 2299 },
  { categoryId: "subs", merchant: "CLAUDE.AI SUBSCRIPTION", source: "src-amex", day: 8, amount: 2875 },
  { categoryId: "subs", merchant: "APPLE.COM/BILL", source: "src-ws", day: 10, amount: 399 },
  { categoryId: "fitness", merchant: "ECONOFITNESS", source: "src-amex", day: 2, amount: 2528 },
  { categoryId: "fitness", merchant: "ECONOFITNESS", source: "src-ws", day: 2, amount: 2528 },
];

interface Pool {
  categoryId: string;
  merchant: string;
  source: "src-amex" | "src-ws";
  min: number; // cents
  max: number;
  /** visits per full month */
  times: number;
}

const pools: Pool[] = [
  { categoryId: "food", merchant: "IGA #8221 MONTREAL QC", source: "src-amex", min: 5200, max: 13800, times: 5 },
  { categoryId: "food", merchant: "MAXI #8763 MONTREAL QC", source: "src-amex", min: 4600, max: 11200, times: 2 },
  { categoryId: "food", merchant: "METRO ETS 384912 MONTREAL QC", source: "src-ws", min: 2400, max: 8600, times: 3 },
  { categoryId: "food", merchant: "ADONIS MONTREAL QC", source: "src-ws", min: 3200, max: 7400, times: 1 },
  { categoryId: "food", merchant: "TIM HORTONS #4021 MONTREAL QC", source: "src-amex", min: 635, max: 635, times: 6 },
  { categoryId: "food", merchant: "SQ *CAFE OLIMPICO MONTREAL QC", source: "src-amex", min: 525, max: 675, times: 5 },
  { categoryId: "food", merchant: "UBER EATS MONTREAL QC", source: "src-ws", min: 3100, max: 5600, times: 3 },
  { categoryId: "food", merchant: "TST* LE BUTTERBLUME MONTREAL QC", source: "src-amex", min: 4400, max: 8200, times: 1 },
  { categoryId: "transit", merchant: "BIXI MONTREAL", source: "src-amex", min: 950, max: 2400, times: 1 },
  { categoryId: "cartaxi", merchant: "COMMUNAUTO MONTREAL QC", source: "src-ws", min: 2200, max: 5800, times: 2 },
  { categoryId: "cartaxi", merchant: "UBER TRIP MONTREAL QC", source: "src-amex", min: 1250, max: 3400, times: 1 },
  { categoryId: "health", merchant: "PHARMAPRIX #0342 MONTREAL", source: "src-ws", min: 1500, max: 5800, times: 2 },
  { categoryId: "health", merchant: "JEAN COUTU #112 MONTREAL QC", source: "src-amex", min: 900, max: 3600, times: 1 },
  { categoryId: "clothing", merchant: "SIMONS MONTREAL QC", source: "src-ws", min: 5800, max: 13800, times: 1 },
  { categoryId: "household", merchant: "CANADIAN TIRE #232 MONTREAL", source: "src-amex", min: 2200, max: 7800, times: 1 },
  { categoryId: "household", merchant: "DOLLARAMA #482 MONTREAL QC", source: "src-ws", min: 850, max: 2600, times: 2 },
  { categoryId: "household", merchant: "AMAZON.CA*2K4XT8 TORONTO ON", source: "src-amex", min: 1600, max: 6200, times: 2 },
  { categoryId: "pers-leon", merchant: "MAISON PRIVEE BARBIER MONTREAL", source: "src-amex", min: 3800, max: 4200, times: 1 },
  { categoryId: "pers-leon", merchant: "STEAMGAMES.COM", source: "src-amex", min: 1400, max: 5200, times: 1 },
  { categoryId: "pers-sara", merchant: "AVEDA SALON MONTREAL QC", source: "src-ws", min: 6200, max: 8800, times: 1 },
  { categoryId: "pers-sara", merchant: "INDIGO #829 MONTREAL QC", source: "src-ws", min: 1800, max: 4600, times: 1 },
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
      importBatchId: t.sourceId === "src-amex" ? "batch-amex-aug" : "batch-ws-aug",
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
        ownerMemberId: r.source === "src-amex" ? "leon" : "sara",
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
          ownerMemberId: p.source === "src-amex" ? "leon" : "sara",
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
  // July one-offs: a Porter flight on the travel line, a dental cleaning.
  push({
    sourceId: "src-amex", ownerMemberId: "leon", date: "2026-07-18",
    description: "PORTER AIRLINES TORONTO ON", amount: 28600,
    kind: "spend", isExcluded: false, categoryId: "travel", isConfirmed: true,
  });
  push({
    sourceId: "src-ws", ownerMemberId: "sara", date: "2026-07-09",
    description: "CLINIQUE DENTAIRE MILE END MONTREAL", amount: 9800,
    kind: "spend", isExcluded: false, categoryId: "health", isConfirmed: true,
  });
  // Two August merchants Claude classified but nobody has reviewed yet.
  push({
    sourceId: "src-ws", ownerMemberId: "sara", date: "2026-08-11",
    description: "LE 9E RESTO BAR MONTREAL QC", amount: 6740,
    kind: "spend", isExcluded: false, categoryId: "food", isConfirmed: false,
  });
  push({
    sourceId: "src-amex", ownerMemberId: "leon", date: "2026-08-12",
    description: "SQ *ATELIER CERAMIQUE MTL MONTREAL", amount: 5175,
    kind: "spend", isExcluded: false, categoryId: "pers-leon", isConfirmed: false,
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
        isPaid: !isAugust || c.id !== "parents",
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
      rowCount: 34, autoCategorizedCount: 31, manualCount: 2,
      createdAt: "2026-08-14T13:05:00Z",
    },
    {
      id: "batch-ws-aug", sourceId: "src-ws", filename: "wealthsimple-aug.csv",
      rowCount: 21, autoCategorizedCount: 19, manualCount: 1,
      createdAt: "2026-08-14T13:11:00Z",
    },
  ];

  const invites: Invite[] = [
    { id: "inv-1", email: "sara@example.com", role: "member", acceptedAt: "2026-06-02T10:00:00Z" },
  ];

  return { transactions, fixedPayments, monthCaps, rules, importBatches, invites };
}
