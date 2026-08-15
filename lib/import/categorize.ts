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

/**
 * Merchant → category guesses, aimed at the Sankey line names (PRD v2 §2.3).
 * Order matters: the most specific pattern wins, so "AMAZON PRIME MEMBER" is
 * caught before the generic Amazon rule (both land on Subscriptions now), and
 * "UBER EATS" before "UBER TRIP".
 * A merchant that matches nothing stays uncategorized rather than guessing —
 * the dashboard's Uncategorized row exists for exactly that.
 */
const HEURISTICS: Array<{ pattern: RegExp; category: RegExp }> = [
  // Groceries, cafés, restaurants and delivery all land on the single Food line.
  { pattern: /IGA|METRO|PROVIGO|MAXI|COSTCO WHOLESALE|SUPER C|ADONIS|PA NATURE|MARCHE|BOULANGERIE|PATISSERIE|FROMAGERIE|BOUCHERIE|POISSONNERIE|DEPANNEUR/i, category: /^food$/i },
  { pattern: /RESTAURANT|CAFE|COFFEE|TIM HORTONS|STARBUCKS|MCDONALD|SUSHI|PIZZ|BURGER|BISTRO|BRASSERIE|POULET|RESTO|UBER\s*EATS|DOORDASH|SKIP\s*THE/i, category: /^food$/i },

  { pattern: /AMAZON\s*PRIME|PRIME\s*MEMBER/i, category: /subscription/i },
  { pattern: /NETFLIX|SPOTIFY|DISNEY|CRAVE|YOUTUBE\s*PREMIUM|HBO|PARAMOUNT|APPLE\s*TV/i, category: /stream/i },
  { pattern: /CLAUDE\.AI|ANTHROPIC|OPENAI|CHATGPT|ICLOUD|APPLE\.COM|GOOGLE\s*ONE|DROPBOX|NOTION|FIGMA|GITHUB|NYTIMES|SUBSTACK|PATREON|ADOBE|MICROSOFT\s*365/i, category: /subscription/i },

  { pattern: /FIZZ|VIRGIN PLUS|KOODO|ROGERS|TELUS|BELL MOBIL|PUBLIC MOBILE|CHATR/i, category: /^cell$/i },
  { pattern: /VIDEOTRON|BELL CANADA|EBOX|TEKSAVVY|OXIO|COLBA/i, category: /wifi|internet/i },
  { pattern: /HYDRO|ENERGIR/i, category: /^hydro$/i },

  { pattern: /UBER\s*TRIP|UBER\s*\*|LYFT|TAXI|TEO TAXI|EVA TAXI/i, category: /^uber$/i },
  { pattern: /STM|EXO|BIXI|VIA RAIL|COMMUNAUTO|OPUS|AMT\b/i, category: /transit/i },

  { pattern: /GYM|ECONOFITNESS|NAUTILUS|YMCA|CLIMBING|BLOC|TENNIS|SQUASH|PISCINE|CROSSFIT/i, category: /gym|tennis/i },
  { pattern: /BARBIER|BARBER|SALON|COIFFURE|AVEDA|SPA\b|PHARMAPRIX|JEAN COUTU|UNIPRIX|PHARMACIE/i, category: /haircut|personal/i },
  { pattern: /SIMONS|WINNERS|UNIQLO|ZARA|H&M|ARITZIA|FRANK\s*\+?\s*OAK|SPORTS EXPERTS/i, category: /cloth/i },

  { pattern: /SAQ|LCBO|CINEMA|CINEPLEX|THEATRE|SPECTACLE|STEAMGAMES|NINTENDO|PLAYSTATION|MUSEE|BILLETTERIE|EVENTBRITE/i, category: /fun activities/i },

  { pattern: /MANITOBA|WINNIPEG/i, category: /manitoba/i },
  { pattern: /AIR CANADA|PORTER|WESTJET|AIRBNB|HOTEL|EXPEDIA|FLAIR|BOOKING\.COM|VIA RAIL CANADA/i, category: /^travel$/i },
];

export function heuristicAssignments(
  merchants: string[],
  categories: CategoryOption[],
): MerchantAssignments {
  const out: MerchantAssignments = {};
  for (const merchant of merchants) {
    let assigned: string | null = null;
    for (const h of HEURISTICS) {
      if (!h.pattern.test(merchant)) continue;
      const category = categories.find((c) => h.category.test(c.name));
      // No category matches this rule's target in the household's plan — keep
      // looking; a later, broader rule may fit.
      if (category) {
        assigned = category.id;
        break;
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
