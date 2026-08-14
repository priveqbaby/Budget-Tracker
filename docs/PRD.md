# PRD: Household budget tracker

**Owner:** Leon
**Status:** Draft for review, not approved to build
**Last updated:** August 14, 2026

---

## 1. Problem

We built a Sankey model of where our money goes each month. It is a plan, not a record. Nothing tells us whether we actually stayed inside it.

The obvious answer is Wealthsimple Spend Insights, which categorizes transactions automatically and has a household view. It fails for us on one specific point: food goes on the Amex Cobalt for 5x points, and Wealthsimple only sees transactions on Wealthsimple accounts. Food is our second-largest budget line at $1,200 a month and it would be invisible.

So spend is deliberately split across cards for rewards, and no single provider dashboard can see all of it. That is the actual problem this app solves.

## 2. Who this is for

Primary: Leon and Sara, tracking a shared Montreal household budget across separate cards and accounts.

Secondary: anyone with the same shape of problem, which is a couple or individual optimizing spend across multiple cards for rewards and losing visibility as a result. The app is built multi-tenant from day one so it can be shared without a rewrite.

## 3. Goals

1. Answer "are we on track this month" in under five seconds of looking at the screen.
2. Capture spend from every card, regardless of issuer.
3. Support adjusting on the fly, which means mid-month visibility, not a month-end report.
4. Keep month over month history so we can see whether food is drifting up.

### Non-goals

- Net worth tracking, investment performance, or portfolio views. Wealthsimple and IBKR already do this well.
- Bill payment, money movement, or anything that touches funds.
- Forecasting or projections. This records against a fixed plan.
- Mobile native apps. Responsive web only.

## 4. Success criteria

| Metric | Target |
|---|---|
| Time from opening app to knowing status | Under 5 seconds |
| Statement import to categorized dashboard | Under 3 minutes |
| Merchants requiring manual categorization by month 3 | Under 10% of transactions |
| Still in use after 3 months | Yes, both of us |

The last one is the real test. Most budget tracking dies in week three.

## 5. Scope decisions

Settled during requirements interview:

| Decision | Choice | Why |
|---|---|---|
| Data entry | Statement import, not per-purchase logging | Manual entry is what kills adherence |
| File structure | Two uploads, Leon's and Sara's, kept separate | Enables per-person split inside a category |
| Fixed vs variable | Rent, debt, parent transfer treated as a paid/unpaid checklist | They are not itemized purchases, matching them is wasted effort |
| History | Retained indefinitely, month selector | Explicitly requested, June vs July vs August |
| Tone | Informative, not punitive | Awareness to enable adjustment, not guilt |

## 6. User flows

### 6.1 First-time setup

1. Sign in
2. Create household, invite Sara by email
3. Budget categories seeded from our 17 lines with existing caps, all editable
4. Mark which categories are fixed (rent, debt, parent transfer)

### 6.2 Monthly import

1. Export CSV from Amex and Wealthsimple
2. Drag file in, tag it as Leon's or Sara's
3. Confirm column mapping (date, description, amount). Remembered per source after first time.
4. Review categorization. Known merchants pre-filled. Unknown merchants prompt once, then are remembered.
5. Confirm fixed items paid
6. Dashboard updates

### 6.3 Mid-month check

1. Open app
2. Category bars for current month, spent against cap, color shifted by proximity to limit
3. Expand any category for transaction list and Leon vs Sara split
4. Month selector for history

## 7. Architecture

Chosen for functional and fastest to working, per the brief.

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | Server components handle CSV parsing server-side, one deploy target |
| Hosting | Vercel | Zero-config for Next.js, free tier covers two users |
| Database | Supabase (Postgres) | Managed Postgres, auth and row-level security included, generous free tier |
| Auth | Supabase Auth, magic link | No password handling anywhere in our code |
| Multi-tenancy | Postgres row-level security on `household_id` | Enforced at the database, not application logic |
| CSV parsing | PapaParse | Handles the malformed exports banks actually produce |
| Categorization | Anthropic API (Claude Haiku) for first-pass merchant classification | Cheap, fast, and better than regex at knowing IGA is groceries |
| Charts | Recharts | Same visual language as the Sankey work |

### Why not Plaid at launch

Plaid does support Canada, covers American Express, and covers Wealthsimple. It would remove the CSV step entirely. Three reasons it is phase 2 and not phase 1:

1. Wealthsimple connections through Plaid currently require re-authentication every 30 days, which is roughly the same friction as a monthly CSV upload.
2. Plaid production access requires an application and has per-item cost. Not worth it before the app has proven it gets used.
3. It adds a hard external dependency to the riskiest part of the product before we know the rest works.

The import layer will be built behind an interface so Plaid can be added as a second source without touching the categorization or dashboard code.

### MCP usage

MCP is for the build loop, not the shipped product. Connecting the Supabase MCP server to Claude Code lets the agent inspect the live schema, write migrations, and verify queries against the real database instead of guessing at table shapes. Anthropic's guidance is to run `claude mcp add` with the server name and URL.

The shipped app talks to Supabase and Anthropic over normal HTTPS APIs. No MCP at runtime.

## 8. Data model

```
households        id, name, created_at
household_members household_id, user_id, display_name, role
categories        id, household_id, name, monthly_cap, is_fixed, sort_order
sources           id, household_id, owner_member_id, label, column_mapping (jsonb)
transactions      id, household_id, source_id, owner_member_id, date,
                  description, merchant_normalized, amount, category_id,
                  is_confirmed, import_batch_id
merchant_rules    id, household_id, merchant_pattern, category_id, hit_count
fixed_payments    id, household_id, category_id, month, is_paid, amount
import_batches    id, household_id, source_id, filename, row_count, created_at
```

`merchant_rules` is what makes month three faster than month one. Every manual categorization writes a rule; every future import checks rules before asking.

Deduplication: hash of date, amount, and normalized description per source. Re-uploading an overlapping statement should not double-count.

## 9. Build plan

Following Anthropic's documented workflow for agentic coding. The four phases are explore, plan, implement, commit, and the guidance is explicit that separating research and planning from implementation avoids solving the wrong problem.

### Phase 0: Setup

- `CLAUDE.md` at repo root with stack decisions, commands, and conventions. Anthropic's guidance is to keep it short and prune it, since bloated files cause Claude to ignore the actual instructions.
- Supabase project, schema migration, RLS policies
- Vercel project connected to the repo

### Phase 1: Import and categorize

- CSV upload with column mapping
- Merchant normalization and rule matching
- Claude fallback for unmatched merchants
- Deduplication

Verification: fixture CSVs from real Amex and Wealthsimple exports, with an expected-output test. Anthropic's guidance is that Claude should be given a check it can run, because without one, "looks done" is the only available signal.

### Phase 2: Dashboard

- Category bars, current month
- Category detail with transaction list and per-person split
- Month selector

Verification: screenshot comparison against the design.

### Phase 3: Household and fixed items

- Invite flow, second member
- Fixed payment checklist
- RLS verified by attempting cross-household reads

### Phase 4: Harden

- Adversarial review in a fresh subagent context, checking the diff against this document
- RLS penetration check
- Deploy

Each phase commits at a logical checkpoint. Anthropic's guidance is to run `/clear` between unrelated tasks, since context degradation is the primary failure mode.

## 10. Security

This holds real transaction data for two people, and eventually other people.

- No bank credentials stored, ever. CSV upload sidesteps this entirely at launch. Plaid tokens, if added, are stored server-side only.
- RLS on every table, keyed to `household_id`. No API route trusts a client-supplied household ID.
- Anthropic API key server-side only, never in the browser bundle.
- Merchant strings sent to Claude for categorization are the only data leaving our infrastructure. Amounts are not sent, since the merchant name alone is enough to classify.

## 11. Open questions

1. Do the Amex Cobalt and Wealthsimple CSV exports include a stable merchant field, or does the description need heavy normalization? Needs an actual export to answer.
2. When a card is shared, do we split the transaction or assign it to the cardholder?
3. Should over-budget in one category be allowed to draw from the $519 surplus automatically, or stay a manual decision?
4. Is the $666 general travel line double-counting the $167 Manitoba line? This affects the seeded budget.

## 12. Out of scope for v1, tracked for later

- Plaid auto-sync
- Receipt photo capture
- Recurring subscription detection
- Export back to CSV
- Points optimization, meaning "you would have earned more putting this on the Cobalt"

That last one is the interesting product idea buried in this whole problem, and it is worth noting that it only becomes possible once every card's data lives in one place.
