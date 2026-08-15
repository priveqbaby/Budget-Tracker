# PRD v2 review

**Reviewing:** `docs/PRD-v2.md` draft
**Verdict:** Approve with three amendments, all folded into v2.1. Nothing blocks the build.

## What holds up

- Batch undo is safe by construction: dedup counts are derived from stored rows, so
  removing a batch automatically restores importability of the same statement. No
  bookkeeping table needed — verified against the v1 engine design.
- Surplus as a display, not an automation, is consistent with v1's resolved question 3
  and costs one flag on `categories`.
- Category renames on stable ids don't disturb `month_caps` snapshots or merchant
  rules. There is no live household yet, so no data migration is owed — the new lines
  ship as the seed and onboarding default.

## Amendments required

1. **A `cash` source kind is dead weight without manual entry.** Cash produces no CSV.
   Either drop the kind or add a minimal manual transaction form (date, description,
   amount, category, source). The form is ~40 lines and users correcting data will
   want to add a missed row anyway — **amendment: v2 includes minimal manual entry**,
   surfaced on the Import page as "Add one by hand".
2. **Deleting a transaction un-dedups it.** Dedup counts drop with the row, so
   re-importing the same statement resurrects a deleted transaction. That's coherent
   ("delete = this row was wrong") but must be said in the confirm copy — **amendment:
   decision table row added; UI copy states it.** Same applies to batch undo.
3. **`month_notes.updated_at` has no trigger** — the app must set it on save, or the
   "last edited" display lies. **Amendment: app-side set, noted in the data model.**

## Noted, no change

- Undoing a batch also removes any later recategorizations of its rows — acceptable;
  the confirm states the row count it will remove.
- Amazon Prime at $8/month implies monthly billing; if the real charge is annual the
  line will read over/empty most months. Seed bills it monthly; revisit with real data.
- The 18-line list totals $6,616 including surplus — consistent with the Sankey.
