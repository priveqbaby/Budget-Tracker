import { formatCentsWhole } from "@/lib/money";

/**
 * The unallocated-surplus line. Not a spending category: it shows what the plan
 * set aside and how much current overages would draw from it. Drawing is always
 * a manual decision (PRD v1 open question 3, resolved) — this only makes the
 * decision visible.
 */
export function SurplusStrip({
  name,
  cap,
  drawn,
  left,
  isDerived,
  planned,
}: {
  name: string;
  cap: number;
  drawn: number;
  left: number;
  /** True when `cap` came from recorded income rather than the plan (PRD v3). */
  isDerived: boolean;
  planned: number;
}) {
  // A derived surplus can be negative (income didn't cover the plan). Treat
  // that as fully drawn rather than an empty bar, and say so in the copy.
  const noSurplus = cap <= 0;
  const pct = noSurplus ? 100 : Math.min(100, (drawn / cap) * 100);
  const exhausted = left < 0;

  return (
    <section className="settle settle-3 mt-8">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="overline">{name}</h2>
        <span className="text-[12px] text-ink-muted">
          {isDerived ? "against this month\u2019s actual surplus" : "covering overages is your call"}
        </span>
      </div>
      <div className="card px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <div className="text-[13px] text-ink-secondary">
              {noSurplus ? (
                <>
                  <strong className="text-danger">There is no surplus this month.</strong>{" "}
                  Recorded income doesn’t cover what the plan allocates
                  {drawn > 0 && <>, and overages add {formatCentsWhole(drawn)} on top</>}.
                </>
              ) : drawn === 0 ? (
                <>Nothing drawn — every category is inside its cap.</>
              ) : (
                <>
                  Overages this month total{" "}
                  <strong className={exhausted ? "text-danger" : "text-ink"}>
                    {formatCentsWhole(drawn)}
                  </strong>
                  {exhausted ? " — more than the surplus covers." : " if you cover them from here."}
                </>
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-6">
            <div className="text-right">
              <div className="overline !text-[10px]">{isDerived ? "Available" : "Budgeted"}</div>
              <div className="money mt-0.5 text-[15px] text-ink-secondary">
                {formatCentsWhole(cap)}
              </div>
              {isDerived && cap !== planned && (
                <div className="mt-0.5 text-[11px] text-ink-muted">plan said {formatCentsWhole(planned)}</div>
              )}
            </div>
            <div className="text-right">
              <div className="overline !text-[10px]">Left</div>
              <div
                className={`money mt-0.5 text-[17px] font-semibold ${
                  exhausted ? "text-danger" : "text-ink"
                }`}
              >
                {formatCentsWhole(left)}
              </div>
            </div>
          </div>
        </div>
        <div
          className="meter mt-3.5"
          style={{ background: "var(--color-sunken)", border: "1px solid var(--color-hairline)" }}
        >
          <span
            className="meter-fill"
            style={{
              width: `${pct}%`,
              background: exhausted ? "var(--color-danger)" : "var(--color-ember)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
