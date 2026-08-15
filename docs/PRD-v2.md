# PRD v2: Hearth iteration 2 — corrections, real budget, journal

**Owner:** Leon
**Status:** v2.1 — Approved to build, amended per [review](PRD-v2-REVIEW.md)
**Builds on:** [PRD v1.1](PRD.md) — v1 decisions stay settled; this document only adds.
**Last updated:** August 15, 2026

---

## 1. Why iterate

Three weeks of real use surfaced three frictions and one missing habit:

1. **Imports are write-once.** A wrong file, a wrong column mapping, or a fat-fingered
   category can't be corrected or cleared. Not being able to clear incorrect data is
   the fastest way to stop trusting the dashboard.
2. **Sources are too rigid.** The v1 seed hard-wired "Wealthsimple = Sara", but Leon
   also has a Wealthsimple credit card, and spend arrives through more avenues than
   credit cards (debit, chequing, cash withdrawals).
3. **Categories don't match the Sankey.** The seeded lines were placeholders; the
   dashboard should speak the exact language of the plan it records against.
4. **No narrative memory.** A month is more than its numbers — "hosted Sara's parents
   twice" explains a food spike better than any bar. A small monthly journal keeps the
   context the numbers lose.

## 2. Scope

### 2.1 Editable data (fix the trust problem)

- **Undo an import.** Every import batch in history gets an undo that removes exactly
  the transactions it inserted. Count-aware dedup makes this safe: dedup counts are
  computed from stored rows, so removing a batch automatically makes re-importing the
  same statement work again.
- **Edit any transaction.** Every transaction (not just unreviewed ones) can be
  recategorized, excluded from spend, or deleted, inline from the category detail.
  Recategorizing writes/updates the merchant rule, same as review.
- **Delete a source.** Removing a source removes its transactions and batches, behind
  an explicit confirmation that states the blast radius.

### 2.2 Sources as they actually are

- A source is `label + owner + kind`, where kind ∈ credit card, debit, chequing,
  cash, other. Any member can own any number of sources.
- Sources are managed in Settings: create, relabel, change owner, change kind, delete.
- Seed reflects reality: Leon — Amex Cobalt, **Leon — Wealthsimple Visa**, and
  Sara — Wealthsimple Visa.

### 2.3 Categories aligned to the Sankey

The 18 lines, verbatim, caps in dollars monthly:

| Line | Cap | Type |
|---|---|---|
| Rent | 1,500 | fixed |
| Food | 1,200 | variable |
| Travel | 666 | variable |
| Gym & tennis | 500 | variable |
| Debt payments | 488 | fixed |
| Fun activities | 300 | variable |
| Clothing | 250 | variable |
| Transit | 200 | variable |
| Transfer to parents | 200 | fixed |
| Haircut & personal | 200 | variable |
| Travel to Manitoba | 167 | variable |
| Cell | 122 | variable |
| Uber | 100 | variable |
| Hydro | 85 | variable |
| Wifi | 61 | variable |
| Streaming | 50 | variable |
| Amazon Prime | 8 | variable |
| Unallocated surplus | 519 | **surplus** |

**Surplus is not a spending category.** It never gets a meter, never receives
transactions, and is excluded from the variable total. It renders as its own strip:
budgeted amount, how much current overages have drawn from it, and what's left —
making v1's resolved question 3 ("draw from surplus is a manual decision") visible
instead of implicit. Amended: the surplus strip is the *display* of that decision,
not an automation of it.

This also closes v1 open question 4: the $666 travel line and the $167 Manitoba line
are confirmed as separate, both kept.

### 2.4 Monthly journal

- One shared note per month per household, edited inline on the dashboard,
  autosaved, with last-edited time shown. Plain text, no ceremony — a field, not a
  feature. History keeps each month's note alongside its numbers.

### 2.5 Uncategorized made visible

Transactions with no category currently vanish from the category list while still
counting toward "to review". They get their own row — count, total, and inline
category pickers — so no spend can hide.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Batch undo granularity | Whole batch only | Partial undo = per-transaction delete, which exists |
| Source deletion | Cascades to its transactions, confirmed with counts | "Clear the data" is the point; orphan transactions would lie |
| Category rename vs history | Renames apply to all history (ids stable, caps snapshotted) | A rename is a correction, not a new line; month_caps still guard the numbers |
| Journal authorship | One shared note per month, no per-person notes | Two-person household, one conversation |
| Surplus overage math | Drawn = Σ max(0, spent − cap) over variable categories | Matches how the couple actually reasons about it |
| Transaction edit surface | Single action menu per row: move to category / exclude / delete | One control, no mode switches |
| Delete vs dedup | Deleting a row (or undoing a batch) lowers its dedup count, so re-importing the same statement brings it back | Coherent with count-aware dedup; the confirm copy says so |
| Manual entry | Minimal "add one by hand" form (date, description, amount, category, source) on the Import page | Cash has no CSV; corrections sometimes mean adding a missed row (per review) |

## 4. Data model changes

```
categories   + is_surplus boolean default false
sources      + kind text default 'credit_card'
               (credit_card | debit | chequing | cash | other)
month_notes  id, household_id, month, body, updated_at   (new; unique per month)
```

Deletes ride existing cascades: `transactions.source_id → on delete cascade`,
batches likewise. Batch undo deletes by `import_batch_id` app-side. The household
bootstrap RPC learns `isSurplus`. RLS on `month_notes` is the standard membership
policy.

## 5. Build plan (same SDLC as v1)

- **Phase 0** — this PRD, review, amendments. Migration `0002_v2.sql`.
- **Phase 1** — data layer: store interface additions (batch undo, transaction
  edit/delete, source CRUD, month notes), demo + Supabase implementations, seed
  rebuilt on the real 18 lines, heuristic dictionary re-aimed at the new names.
- **Phase 2** — UI: transaction action menu, batch undo in import history, source
  manager in Settings, surplus strip, uncategorized row, journal card.
- **Phase 3** — verify: engine tests still green, build clean, browser walkthrough
  of every new flow, screenshots.
- **Phase 4** — adversarial review of the diff against this document; fix findings;
  push; republish the interactive artifact.

## 6. Out of scope for v2, tracked for later

- Merchant-rules manager UI (view, edit, delete learned rules) — first candidate for v3
- Per-source dashboard filter ("just show the Amex")
- Export back to CSV
- Recurring-subscription detection; cap rollover between months
- Plaid auto-sync; points optimization (unchanged from v1)
- Real Amex/Wealthsimple fixture exports still owed from v1 open question 1

---

## Appendix: what came next

The scored evaluation of iteration 3 candidates lives in
[`docs/V3-RECOMMENDATION.md`](V3-RECOMMENDATION.md) — four candidates weighed through a
financial-advisor lens and an operator lens. Headline: close the surplus loop
(advisor 8.5, operator 7.2), ship recurring-commitment detection as a rider, hold the
rewards optimizer despite it being the differentiated idea, and treat Plaid as a
retention trigger rather than a feature decision.
