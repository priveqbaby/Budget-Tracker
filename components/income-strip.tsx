import { formatCents, formatCentsWhole } from "@/lib/money";
import type { IncomeEntry } from "@/lib/data/types";

const KIND_LABEL: Record<string, string> = {
  contribution: "contribution",
  salary: "salary",
  trading: "trading",
  side_hustle: "side hustle",
  tax_return: "tax return",
  gift: "gift",
  other: "other",
};

/**
 * Income and the surplus it implies. The planned figure is what the Sankey says;
 * the actual figure moves with what actually landed (PRD v3 §2.2).
 */
export function IncomeStrip({
  income,
  members,
  surplusName,
}: {
  income: {
    total: number;
    byMember: Record<string, number>;
    entries: IncomeEntry[];
    allocated: number;
    plannedSurplus: number;
    actualSurplus: number;
    isPlanned: boolean;
    savingsTarget: number;
  };
  members: { id: string; displayName: string }[];
  surplusName: string;
}) {
  const { actualSurplus, plannedSurplus, isPlanned, savingsTarget } = income;
  const short = actualSurplus < 0;
  const windfall = !isPlanned && actualSurplus > plannedSurplus;
  const oneOffs = income.entries.filter((e) => !e.isRecurring);

  const targetState =
    savingsTarget <= 0
      ? null
      : actualSurplus >= savingsTarget
        ? { tone: "ok" as const, text: `clears your ${formatCentsWhole(savingsTarget)} savings target by ${formatCentsWhole(actualSurplus - savingsTarget)}` }
        : { tone: "watch" as const, text: `short of your ${formatCentsWhole(savingsTarget)} savings target by ${formatCentsWhole(savingsTarget - actualSurplus)}` };

  return (
    <section className="settle settle-3 mt-8">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="overline">Income &amp; {surplusName.toLowerCase()}</h2>
        <span className="text-[12px] text-ink-muted">
          {isPlanned ? "no income recorded — showing the plan" : "surplus follows what actually landed"}
        </span>
      </div>

      <div className="card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-[260px]">
            <div className="overline !text-[10px]">Income this month</div>
            <div className="money mt-1 text-[27px] font-semibold leading-none text-ink">
              {isPlanned ? "—" : formatCents(income.total)}
            </div>
            {!isPlanned && (
              <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-ink-secondary">
                {members.map((m) =>
                  income.byMember[m.id] ? (
                    <span key={m.id}>
                      {m.displayName}{" "}
                      <span className="money font-medium text-ink">
                        {formatCentsWhole(income.byMember[m.id])}
                      </span>
                    </span>
                  ) : null,
                )}
                {income.byMember.household ? (
                  <span>
                    Joint{" "}
                    <span className="money font-medium text-ink">
                      {formatCentsWhole(income.byMember.household)}
                    </span>
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex items-start gap-8 text-right">
            <div>
              <div className="overline !text-[10px]">Allocated</div>
              <div className="money mt-1 text-[15px] text-ink-secondary">
                {formatCentsWhole(income.allocated)}
              </div>
            </div>
            <div>
              <div className="overline !text-[10px]">
                {isPlanned ? "Planned surplus" : "Surplus"}
              </div>
              <div
                className={`money mt-1 text-[22px] font-semibold ${
                  short ? "text-danger" : windfall ? "text-ok" : "text-ink"
                }`}
              >
                {formatCentsWhole(actualSurplus)}
              </div>
              {!isPlanned && actualSurplus !== plannedSurplus && (
                <div className="mt-0.5 text-[11.5px] text-ink-muted">
                  plan said {formatCentsWhole(plannedSurplus)}
                </div>
              )}
            </div>
          </div>
        </div>

        {(oneOffs.length > 0 || targetState || short) && (
          <div className="mt-3.5 border-t border-hairline pt-3 text-[12.5px] leading-relaxed text-ink-secondary">
            {short && (
              <span className="font-semibold text-danger">
                Recorded income doesn’t cover the plan.{" "}
              </span>
            )}
            {oneOffs.length > 0 && (
              <>
                {windfall ? "Lifted by " : "Includes "}
                {oneOffs.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && (i === oneOffs.length - 1 ? " and " : ", ")}
                    <span className="font-medium text-ink">{e.label}</span>{" "}
                    <span className="money">{formatCentsWhole(e.amount)}</span>
                    <span className="text-ink-muted"> ({KIND_LABEL[e.kind] ?? e.kind})</span>
                  </span>
                ))}
                {". "}
              </>
            )}
            {targetState && (
              <span className={targetState.tone === "ok" ? "text-ok" : "text-warn"}>
                {targetState.text}.
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
