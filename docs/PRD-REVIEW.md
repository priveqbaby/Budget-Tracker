# PRD review: Household budget tracker

**Reviewer:** Claude Code
**Reviewing:** `docs/PRD.md`, draft dated August 14, 2026
**Verdict:** Approve with changes. The product thinking is sound and the scope is honest. Four issues should be resolved before Phase 0 writes the schema, because they are cheap to fix in a migration file and expensive to fix after real data exists. One open question gates Phase 1 and needs a real CSV export, not more discussion.

---

## What is right and should not be reopened

- The problem statement is specific and real: rewards-driven card splitting breaks every single-provider dashboard. This is the correct reason to build rather than buy.
- Statement import over per-purchase logging is the right adherence bet, and "still in use after 3 months" is the correct success metric to rank first.
- CSV-first with Plaid behind an interface is the right sequencing. The 30-day Wealthsimple re-auth point neutralizes most of Plaid's phase-1 value on its own.
- Fixed items as a checklist instead of matched transactions avoids a whole class of reconciliation work for zero user value.
- RLS at the database rather than application-level tenancy checks, and `household_id` denormalized onto every table, is the right multi-tenant shape.
- Sending merchant strings but not amounts to the Anthropic API is the right privacy line.

## Issues to resolve before the schema migration

### 1. The dedup hash silently drops legitimate duplicate purchases

Hash of (date, amount, normalized description) per source collides on real behavior: two identical coffees at the same café on the same day produce the same hash, and the second one disappears. Small-ticket repeat purchases are exactly the food-category spend this app exists to track.

Fix: make dedup count-aware. For each hash key, compare the occurrence count in the incoming file against the count already stored for that source and month, and insert the difference. Alternatively, if the Amex export carries a reference number per row, include it in the hash and fall back to count-aware only for sources without one. Either way this is a Phase 1 test fixture: a CSV containing a genuine same-day duplicate must import as two transactions, and re-uploading the same file must not.

### 2. Card payments and refunds are not addressed anywhere

A real Amex export contains rows that are not spend: "PAYMENT RECEIVED - THANK YOU", statement credits, refunds. Sign conventions also differ by issuer — Amex exports typically show charges as positive, while bank account exports typically show debits as negative. As written, a card payment imports as a large negative food-adjacent transaction and the dashboard math is wrong in the app's second-largest category.

Fix: define a canonical sign convention at import (spend positive, credits negative), store a per-source sign flag in `sources.column_mapping`, and add an import step that flags payment/credit rows for exclusion by default with a manual override. Refunds should stay, as negative spend in their category — a returned grocery purchase legitimately reduces the food line.

### 3. `monthly_cap` on `categories` rewrites history

Caps live as a single mutable column. Change the food cap from $1,200 to $1,300 in October, and the June-vs-July-vs-August comparison — goal 4, explicitly requested — now renders past months against a cap that did not exist then.

Fix: either an effective-dated `category_caps (category_id, month_from, cap)` table, or a cheaper v1 compromise: snapshot each category's cap into a `month_caps (category_id, month, cap)` row the first time a month receives data. The second option is one insert trigger and keeps history honest. Deciding "we accept rewritten history in v1" is also a valid outcome, but it should be a written decision, not an accident of the schema.

### 4. The invite flow has no data model

`household_members.user_id` presumes an auth user exists, but flow 6.1 invites Sara by email before she has ever signed in. There is no `invites` table, so there is nowhere to persist "this email, when it first authenticates, joins this household with this role."

Fix: add `invites (id, household_id, email, role, invited_by, accepted_at)` and an on-first-login hook that consumes a pending invite. Alternatively use Supabase's `inviteUserByEmail` admin API, which creates the auth user up front — but then the joining logic still needs somewhere to store the household mapping, so the table is needed either way.

## Implementation notes, not blockers

- **RLS recursion.** The standard membership policy — "user can see rows where they are a member of the household" — expressed naively on `household_members` queries `household_members` inside its own policy and Postgres rejects it with infinite recursion. This is the single most common Supabase multi-tenant pitfall. Use a `security definer` function (`is_household_member(household_id)`) and call it from every policy. Worth writing into `CLAUDE.md` in Phase 0 so the agent does not rediscover it.
- **Month attribution.** Pick one date field (transaction date, not posting date) and calendar-month bucketing, and state it. A statement exported mid-month must be re-uploadable next month with the overlap deduplicated — this already falls out of issue 1's fix, but only if months are bucketed consistently.
- **`merchant_pattern` semantics are undefined.** Recommend: normalization strips store numbers, city suffixes, and payment-processor prefixes (`SQ *`, `TST*`), and a rule is an exact match on the normalized string. Substring or regex patterns invite one bad rule swallowing a whole statement. The normalization function is the real IP here and deserves its own fixture tests.
- **Batch the Claude calls.** One request per import with all unknown merchants and the category list, constrained output, not one request per merchant. Keep `is_confirmed = false` on model-assigned categories until the user reviews — the schema already supports this; the flow in 6.2 step 4 should say explicitly that Claude's assignments arrive unconfirmed.
- **Split transactions.** One Costco receipt spanning groceries and household goods is one CSV row. V1 should assign whole transactions to one category and say so in scope decisions; per-line splitting is a v2 feature that touches the data model (child transactions), so deciding it now costs a sentence and deciding it later costs a migration.
- **Currency.** Amex Cobalt spend can include foreign-currency transactions that the export shows in CAD, so v1 can likely ignore currency — but add a `currency` column defaulted to `CAD` now, because adding it later touches every dedup hash.
- **Instrument the success metric.** "Under 10% manual by month 3" is measurable for free if `import_batches` gains `auto_categorized_count` and `manual_count`. Two columns now, or a data archaeology project in November.

## Open questions: answers and recommendations

1. **Stable merchant field in the exports?** Partially answerable without an export: Amex Canada's basic CSV is date / description / amount, and the description embeds merchant, store number, and city in one string — expect real normalization work, there is no separate clean merchant field. Wealthsimple's export format varies by account type and is less documented. The recommendation stands: obtain one real export from each source before Phase 1 starts, because the column mapping UI, normalization, and dedup design all depend on it. This is the only open question that gates the build.
2. **Shared card: split or assign?** Recommend assign to cardholder, unchanged. The settled scope decision already keys person-attribution to whose upload the file was; splitting individual transactions contradicts that and reintroduces the manual bookkeeping the import flow exists to avoid. A per-transaction "reassign owner" affordance covers the exceptions.
3. **Auto-draw from surplus?** Recommend manual. Automatic drawdown hides drift, and goal 4 is explicitly about seeing drift. It also fits the settled "informative, not punitive" tone: show the over-budget category and show the surplus, let the humans decide. No schema impact either way, so this can stay open without blocking.
4. **Travel double-counting Manitoba?** Not answerable from this repository — it needs the Sankey numbers. Flag: this only affects seeded values, which are editable per flow 6.1, so it does not block the build; it blocks trusting the first month's dashboard.

## Suggested pre-build checklist

1. Obtain one real Amex Cobalt CSV and one real Wealthsimple CSV; commit sanitized versions as fixtures. (Gates Phase 1.)
2. Amend the data model per issues 1–4: count-aware dedup, sign convention + payment-row exclusion, cap history, invites table, plus `currency` and the two instrumentation columns.
3. Write the scope sentence for split transactions (whole-transaction assignment in v1).
4. Resolve open question 4 against the Sankey figures before seeding categories.
5. Then approve to build.
