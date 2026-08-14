/**
 * First-pass categorization of merchants with no rule.
 *
 * One batched Anthropic API call per import (never per merchant), server-side
 * only. Only merchant strings leave our infrastructure — no amounts (PRD §10).
 * Assignments come back unconfirmed; the review step flips is_confirmed and
 * writes a merchant rule.
 *
 * Without an ANTHROPIC_API_KEY (demo mode, tests) a local heuristic
 * dictionary answers instead, so the flow works end to end offline.
 */

export interface CategoryOption {
  id: string;
  name: string;
}

export type MerchantAssignments = Record<string, string | null>; // merchant -> categoryId

const HEURISTICS: Array<{ pattern: RegExp; category: RegExp }> = [
  { pattern: /IGA|METRO|PROVIGO|MAXI|COSTCO WHOLESALE|SUPER C|ADONIS|PA NATURE|MARCHE/i, category: /grocer|food/i },
  { pattern: /RESTAURANT|CAFE|COFFEE|TIM HORTONS|STARBUCKS|MCDONALD|SUSHI|PIZZ|BURGER|BISTRO|BAR\b|BRASSERIE|POULET|UBER\s*EATS|DOORDASH|SKIP/i, category: /restaurant|dining|eating|food/i },
  { pattern: /STM|EXO|BIXI|UBER(?!\s*EATS)|LYFT|TAXI|VIA RAIL|COMMUNAUTO/i, category: /transit|transport/i },
  { pattern: /PETRO|ESSO|SHELL|ULTRAMAR|COUCHE-?TARD/i, category: /gas|car|transport/i },
  { pattern: /HYDRO|ENERGIR|BELL|VIDEOTRON|ROGERS|TELUS|FIZZ|VIRGIN PLUS|KOODO/i, category: /utilit|internet|phone/i },
  { pattern: /NETFLIX|SPOTIFY|DISNEY|CRAVE|APPLE\.COM|YOUTUBE|PRIME|CLAUDE\.AI|ANTHROPIC/i, category: /subscript|entertain/i },
  { pattern: /PHARMAPRIX|JEAN COUTU|UNIPRIX|PHARMACIE|CLINIQUE|DENTAIRE/i, category: /health|pharma/i },
  { pattern: /AIR CANADA|PORTER|WESTJET|AIRBNB|HOTEL|EXPEDIA|FLAIR/i, category: /travel/i },
  { pattern: /SAQ|LCBO|DEPANNEUR/i, category: /alcohol|grocer|food/i },
  { pattern: /AMAZON|AMZN|WALMART|CANADIAN TIRE|IKEA|DOLLARAMA|HOME DEPOT|RONA|BUREAU EN GROS/i, category: /household|home|shopping/i },
  { pattern: /SIMONS|WINNERS|UNIQLO|ZARA|H&M|SPORT/i, category: /cloth|shopping|personal/i },
  { pattern: /GYM|ECONOFITNESS|NAUTILUS|YMCA|CLIMBING|BLOC/i, category: /fitness|health|personal/i },
];

export function heuristicAssignments(
  merchants: string[],
  categories: CategoryOption[],
): MerchantAssignments {
  const out: MerchantAssignments = {};
  for (const merchant of merchants) {
    let assigned: string | null = null;
    for (const h of HEURISTICS) {
      if (h.pattern.test(merchant)) {
        const category = categories.find((c) => h.category.test(c.name));
        if (category) {
          assigned = category.id;
          break;
        }
      }
    }
    out[merchant] = assigned;
  }
  return out;
}

export async function classifyMerchants(
  merchants: string[],
  categories: CategoryOption[],
): Promise<MerchantAssignments> {
  if (merchants.length === 0) return {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return heuristicAssignments(merchants, categories);

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const categoryList = categories.map((c) => `- ${c.name}`).join("\n");
  const merchantList = merchants.map((m) => `- ${m}`).join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Classify each merchant into exactly one budget category, or "unknown" if genuinely unclear. These are Canadian (Montreal) merchants.

Categories:
${categoryList}

Merchants:
${merchantList}

Reply with JSON only: {"MERCHANT": "Category name", ...} using the exact merchant and category strings above.`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const out: MerchantAssignments = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const mapping: Record<string, string> = match ? JSON.parse(match[0]) : {};
    for (const merchant of merchants) {
      const name = mapping[merchant];
      const category = name ? categories.find((c) => c.name === name) : undefined;
      out[merchant] = category?.id ?? null;
    }
  } catch {
    for (const merchant of merchants) out[merchant] = null;
  }
  return out;
}
