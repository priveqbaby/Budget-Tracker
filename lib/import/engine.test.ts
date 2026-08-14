import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildImportPreview, guessMapping } from "./engine";
import { normalizeMerchant } from "./normalize";
import { parseAmountToCents, parseDateToIso, parseStatement } from "./parse";
import { dedupeCountAware } from "./dedup";
import { heuristicAssignments } from "./categorize";
import type { ColumnMapping } from "./types";

const fixture = (name: string) =>
  readFileSync(path.join(__dirname, "fixtures", name), "utf8");

const amexMapping: ColumnMapping = {
  date: "Date",
  description: "Description",
  amount: "Amount",
  sign: "charges_positive",
};

const wsMapping: ColumnMapping = {
  date: "date",
  description: "transaction",
  amount: "amount",
  sign: "debits_negative",
};

describe("merchant normalization", () => {
  it("strips store numbers, cities, provinces", () => {
    expect(normalizeMerchant("IGA #8221 MONTREAL QC")).toBe("IGA");
    expect(normalizeMerchant("TIM HORTONS #4021 MONTREAL QC")).toBe("TIM HORTONS");
  });
  it("strips payment processor prefixes", () => {
    expect(normalizeMerchant("SQ *CAFE OLIMPICO MONTREAL QC")).toBe("CAFE OLIMPICO");
    expect(normalizeMerchant("TST* LE BUTTERBLUME MONTREAL QC")).toBe("LE BUTTERBLUME");
  });
  it("strips long digit runs", () => {
    expect(normalizeMerchant("METRO ETS 123456789 MONTREAL QC")).toBe("METRO ETS");
  });
  it("is stable: same merchant, different store", () => {
    expect(normalizeMerchant("TIM HORTONS #4021 MONTREAL QC")).toBe(
      normalizeMerchant("TIM HORTONS #883 LAVAL QC"),
    );
  });
});

describe("amount parsing", () => {
  it("handles currency symbols, commas, parentheses", () => {
    expect(parseAmountToCents("$1,234.56")).toBe(123456);
    expect(parseAmountToCents("(45.00)")).toBe(-4500);
    expect(parseAmountToCents("-45.00")).toBe(-4500);
    expect(parseAmountToCents("6.35")).toBe(635);
  });
  it("rejects garbage", () => {
    expect(parseAmountToCents("n/a")).toBeNaN();
  });
});

describe("date parsing", () => {
  it("accepts ISO, US slashes, and Amex 'DD MMM YYYY'", () => {
    expect(parseDateToIso("2026-08-03")).toBe("2026-08-03");
    expect(parseDateToIso("8/3/2026")).toBe("2026-08-03");
    expect(parseDateToIso("03 Aug 2026")).toBe("2026-08-03");
  });
});

describe("sign convention and payment exclusion", () => {
  it("canonicalizes debits_negative sources to spend-positive", () => {
    const { rows } = parseStatement(fixture("wealthsimple.csv"), wsMapping);
    const stm = rows.find((r) => r.merchantNormalized.includes("STM"));
    expect(stm?.amount).toBe(10450);
    expect(stm?.kind).toBe("spend");
  });
  it("treats credits as refunds (negative spend), not exclusions", () => {
    const { rows } = parseStatement(fixture("amex-cobalt.csv"), amexMapping);
    const refund = rows.find((r) => r.amount === -1299);
    expect(refund?.kind).toBe("refund");
    expect(refund?.isExcluded).toBe(false);
  });
  it("flags card payments for exclusion by default", () => {
    const { rows } = parseStatement(fixture("amex-cobalt.csv"), amexMapping);
    const payment = rows.find((r) => r.kind === "payment");
    expect(payment).toBeDefined();
    expect(payment?.isExcluded).toBe(true);
    expect(payment?.amount).toBe(-95000);
  });
});

describe("count-aware dedup (PRD §8 amended)", () => {
  it("keeps legitimate same-day duplicates on first import", () => {
    const preview = buildImportPreview(fixture("amex-cobalt.csv"), amexMapping, new Map(), []);
    const coffees = preview.rows.filter(
      (r) => r.merchantNormalized === "TIM HORTONS" && r.amount === 635,
    );
    expect(coffees).toHaveLength(2);
    expect(preview.skippedAsDuplicates).toBe(0);
  });

  it("re-uploading the identical file inserts nothing", () => {
    const first = buildImportPreview(fixture("amex-cobalt.csv"), amexMapping, new Map(), []);
    const counts = new Map<string, number>();
    for (const r of first.rows) counts.set(r.dedupHash, (counts.get(r.dedupHash) ?? 0) + 1);

    const second = buildImportPreview(fixture("amex-cobalt.csv"), amexMapping, counts, []);
    expect(second.rows).toHaveLength(0);
    expect(second.skippedAsDuplicates).toBe(10);
  });

  it("overlapping statement inserts only the new rows", () => {
    const first = buildImportPreview(fixture("amex-cobalt.csv"), amexMapping, new Map(), []);
    const counts = new Map<string, number>();
    for (const r of first.rows) counts.set(r.dedupHash, (counts.get(r.dedupHash) ?? 0) + 1);

    const overlap = buildImportPreview(
      fixture("amex-cobalt-overlap.csv"), amexMapping, counts, [],
    );
    // METRO and LE BUTTERBLUME rows overlap; IGA (new date) and a third
    // TIM HORTONS coffee (Aug 11, no stored occurrence) are new.
    expect(overlap.skippedAsDuplicates).toBe(2);
    expect(overlap.rows).toHaveLength(2);
    expect(overlap.rows.map((r) => r.merchantNormalized).sort()).toEqual([
      "IGA",
      "TIM HORTONS",
    ]);
  });

  it("a third same-day duplicate beyond stored count still inserts", () => {
    const existing = new Map([["2026-08-02|635|TIM HORTONS", 2]]);
    const { rows } = parseStatement(fixture("amex-cobalt.csv"), amexMapping);
    const { toInsert, skipped } = dedupeCountAware(rows, existing);
    const coffees = toInsert.filter((r) => r.dedupHash === "2026-08-02|635|TIM HORTONS");
    expect(coffees).toHaveLength(0);
    expect(skipped).toBe(2);
  });
});

describe("merchant rules", () => {
  it("exact match on normalized string, payments never categorized", () => {
    const preview = buildImportPreview(fixture("amex-cobalt.csv"), amexMapping, new Map(), [
      { merchantNormalized: "IGA", categoryId: "cat-food" },
      { merchantNormalized: "TIM HORTONS", categoryId: "cat-restaurants" },
    ]);
    const iga = preview.rows.filter((r) => r.merchantNormalized === "IGA");
    expect(iga.every((r) => r.categoryId === "cat-food" && r.categorySource === "rule")).toBe(true);

    const payment = preview.rows.find((r) => r.kind === "payment");
    expect(payment?.categoryId).toBeNull();

    expect(preview.unknownMerchants).not.toContain("IGA");
    expect(preview.unknownMerchants).toContain("CAFE OLIMPICO");
    expect(preview.autoCategorizedCount).toBe(4); // 2 IGA rows (one a refund) + 2 coffees
  });
});

describe("heuristic fallback (demo mode / no API key)", () => {
  it("classifies obvious Montreal merchants", () => {
    const categories = [
      { id: "g", name: "Groceries" },
      { id: "r", name: "Restaurants" },
      { id: "t", name: "Transit" },
    ];
    const out = heuristicAssignments(["IGA", "CAFE OLIMPICO", "STM", "MYSTERY SHOP"], categories);
    expect(out["IGA"]).toBe("g");
    expect(out["CAFE OLIMPICO"]).toBe("r");
    expect(out["STM"]).toBe("t");
    expect(out["MYSTERY SHOP"]).toBeNull();
  });
});

describe("column mapping guess", () => {
  it("guesses Amex and Wealthsimple headers", () => {
    expect(guessMapping(["Date", "Description", "Amount"])).toMatchObject({
      date: "Date", description: "Description", amount: "Amount",
    });
    expect(guessMapping(["date", "transaction", "amount"])).toMatchObject({
      date: "date", description: "transaction", amount: "amount",
    });
  });
});
