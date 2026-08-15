# PRD v3: Income becomes real, surplus becomes derived

**Owner:** Leon
**Status:** Approved to build
**Builds on:** [PRD v2.1](PRD-v2.md) · relates to [the v3 scored recommendation](V3-RECOMMENDATION.md)
**Last updated:** August 15, 2026

---

## 1. Why

The plan has always assumed a constant month. It isn't one. Tax returns, trading
income and side hustles land irregularly, and when they do, the intent is that the
extra gets saved — which means the surplus line moves. Today `Unallocated surplus` is
a hard-coded $519 cap, so a $3,180 tax return is invisible to the app and the couple
has to do the arithmetic in their heads, which is the exact failure the app exists to
remove.

The [v3 recommendation](V3-RECOMMENDATION.md) argued the highest-value next move was
to give the surplus a job. This is the stronger version of that: before the surplus
can have a job, it has to be a real number rather than a planning constant.

## 2. Scope

### 2.1 Income entries

Income is recorded, not assumed. Each entry is `member · label · kind · amount`,
either **recurring** (applies to every month) or **one-off** (belongs to one month).

| Kind | Example |
|---|---|
| `contribution` | Leon's $1,500/mo into the joint pot — the floor |
| `salary` | pay above the contribution floor |
| `trading` | realized trading income |
| `side_hustle` | freelance, consulting |
| `tax_return` | the April windfall |
| `gift`, `other` | everything else |

**The contribution floor.** Leon and Sara each commit a minimum of $1,500/month to the
household. That floor is seeded as a recurring `contribution` entry per person and is
the thing the plan is guaranteed to be able to lean on. Everything above it is
recorded as it arrives.

### 2.2 Surplus becomes derived

- **Planned surplus** stays what the Sankey says: the `Unallocated surplus` line's cap
  ($519). It is the intent.
- **Actual surplus** = `total income − allocated` (fixed caps + variable caps), computed
  per month from recorded income.
- The dashboard shows both, and the difference is the point: *"planned $519, actual
  $3,699 — the tax return landed."*
- When a month has no recorded income, the app falls back to the planned figure and
  says so rather than showing a misleading zero.

### 2.3 Savings intent

One household-level `savings_target` per month. The surplus strip reports actual
surplus against it: cleared, short by $X, or over by $X. It is a measurement, not an
instruction — nothing moves money (unchanged non-goal from v1).

### 2.4 Subscriptions category

A `Subscriptions` line, alongside the existing `Streaming` and `Amazon Prime` lines
rather than replacing them — for everything that isn't those two (software, cloud
storage, memberships). Seeded at $60/month, editable like any other line. Merchant
heuristics learn it.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Extra income destination | Grows surplus; never auto-raises category caps | Caps are the plan; a windfall shouldn't quietly license more spending |
| Recurring vs one-off | One flag on the entry, not two tables | A contribution floor and a tax return differ only in whether they repeat |
| Negative surplus | Shown honestly, in red, with the shortfall named | A plan that outruns recorded income is exactly what the user needs told |
| No income recorded | Falls back to planned surplus, labelled "planned" | Better than reporting a $6,097 shortfall on an empty month |
| Income vs transactions | Separate table, never imported from CSV | Statement imports are spend; conflating them would corrupt every category total |
| Savings target scope | One household number | Two-person household, one plan (consistent with the shared journal) |

## 4. Data model

```
income_entries  id, household_id, member_id, month (null when recurring),
                label, kind, amount, is_recurring, created_at
households     + savings_target integer default 0
categories      Subscriptions line added to the seed and to onboarding defaults
```

Income for month *M* = Σ recurring entries + Σ one-off entries dated *M*.
RLS on `income_entries` is the standard membership policy.

## 5. Build plan

- **Phase 0** — this document. Migration `0003_v3.sql`.
- **Phase 1** — data layer: income CRUD on the store interface, both implementations,
  savings target, `Subscriptions` category, seed with the contribution floors and an
  April tax-return story.
- **Phase 2** — `summarizeMonth` gains income and derived surplus; income strip on the
  dashboard; income manager in Settings.
- **Phase 3** — tests for the surplus math (no income, normal month, windfall month,
  shortfall), build, browser walkthrough.
- **Phase 4** — adversarial review, fixes, push, artifact.

## 6. Out of scope

- Moving money, opening accounts, or recommending instruments — unchanged from v1.
- Forecasting next month's income from history.
- Per-person savings targets.
- The Yoko Space design-system port — tracked separately; it needs the Figma
  connector, which this environment cannot reach.
