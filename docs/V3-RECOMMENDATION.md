# Iteration 3: scored recommendation

**Date:** August 15, 2026
**Interactive version:** published artifact "The $519 Question"

Four candidates for the next iteration, scored on a 10-point weighted scale through two
lenses. Burden, risk and cost are scored so higher is always better.

## Verdict

**Build "Where it went" — give the surplus a job.** At month end, ask one question: the
plan set aside $519, the variable lines came in over or under, so where did the
difference actually go (debt, savings, investment, or back into spending)? Record the
answer; after three months the app can say whether the household saved what it planned.
Ship **recurring-commitment detection** alongside as a cheap rider. **Hold the rewards
optimizer.**

## The arithmetic

| Figure | Amount / year | Note |
|---|---|---|
| Unallocated surplus | **$6,228** | Principal, by design, with no assigned destination |
| Interest avoided if redirected to debt | $435–1,245 | At 7%–20%; *on top of* the $6,228 |
| Points left on the table (rewards optimizer) | $115–288 | Realistic; requires behaviour change at every checkout |
| One forgotten subscription cancelled | $276 | Captured permanently by a single action |

## Scores

| Candidate | Advisor | Operator | Combined | Call |
|---|---:|---:|---:|---|
| A · Close the surplus loop | 8.5 | 7.2 | **7.9** | Build now |
| B · Recurring detection | 8.0 | 5.5 | 6.8 | Ship as a rider |
| D · Plaid auto-sync | 5.5 | 5.2 | 5.3 | Retention trigger |
| C · Rewards optimizer | 4.4 | 6.3 | 5.3 | Hold for v4 |

**Advisor weights:** dollar impact 30%, certainty of capture 25%, behaviour burden 20%,
bad-advice risk 15%, compounding durability 10%.
**Operator weights:** defensibility 25%, retention 25%, build + maintenance cost 20%,
monetization 15%, trust & regulatory risk 15%.

## Where the lenses split

The rewards optimizer is the widest gap (4.4 vs 6.3) and the gap is the strategic
question. As a household tool the advisor wins: points are a rounding error next to an
unassigned $6,228. As a product the operator has the stronger hand, because the rewards
optimizer is the only candidate with revenue attached — and that revenue is card
referrals, which is the fastest way to destroy an app whose entire value is telling you
the truth about your money. If Hearth becomes a business, that conflict must be resolved
in the architecture before the feature ships.

## Arguments against this recommendation

1. **$6,228 is a plan number, not an observed one.** If the variable lines routinely
   overspend, no surplus survives to month end and the feature reports zero forever.
   First build step is a query against three months of real data, not UI.
2. **The stated success metric is retention, not dollars.** On "still in use after three
   months" alone, Plaid wins and this recommendation is unproven.
3. **A prompt people ignore is worse than no prompt.** Kill it after two unanswered
   months.
4. **This recommends against the only monetizable feature.** Correct for a household
   tool; a real call for a company.

## What would change it

- No surplus survives month end in real data → build recurring detection first.
- A skipped monthly import → Plaid moves to the top regardless of score.
- Intent to make this a product → operator lens takes over; rewards optimizer needs a
  trust architecture designed up front.
- Debt rate above ~15% → the surplus recommendation gets stronger and should arguably
  become prescriptive.
