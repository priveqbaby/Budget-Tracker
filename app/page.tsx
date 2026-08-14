import Link from "next/link";
import { getStore, isDemoMode } from "@/lib/data";
import { DEMO_TODAY } from "@/lib/data/demo-seed";
import { summarizeMonth } from "@/lib/budget";
import { formatCents, formatCentsWhole, monthLabel } from "@/lib/money";
import { CategoryRows, type CategoryRowDto } from "@/components/category-rows";
import { FixedChecklist } from "@/components/fixed-checklist";
import { HistoryChart, type HistoryPointDto } from "@/components/history-chart";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const store = await getStore();
  const todayIso = isDemoMode() ? DEMO_TODAY : new Date().toISOString().slice(0, 10);

  const [household, categories, months] = await Promise.all([
    store.getHousehold(),
    store.listCategories(),
    store.listMonths(),
  ]);

  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : (months[months.length - 1] ?? todayIso.slice(0, 7));
  const monthIndex = months.indexOf(month);
  const prev = monthIndex > 0 ? months[monthIndex - 1] : null;
  const next = monthIndex >= 0 && monthIndex < months.length - 1 ? months[monthIndex + 1] : null;

  const data = await store.getMonthData(month);
  const s = summarizeMonth(data, categories, todayIso);

  // History across every retained month (goal 4: is food drifting up?).
  const history: HistoryPointDto[] = [];
  const foodByMonth = new Map<string, number>();
  for (const hm of months) {
    const hd = hm === month ? data : await store.getMonthData(hm);
    const hs = summarizeMonth(hd, categories, todayIso);
    history.push({
      month: hm,
      spent: hs.totalVariableSpent,
      cap: hs.totalVariableCap,
      partial: hs.elapsedFraction < 1 && hs.elapsedFraction > 0,
    });
    const food = hs.variable.find((v) => v.category.name === "Food");
    if (food) foodByMonth.set(hm, food.spent);
  }

  const activeRows = s.variable.filter((v) => v.spent !== 0 || v.cap > 0);
  const rows: CategoryRowDto[] = activeRows.map((v) => ({
    id: v.category.id,
    name: v.category.name,
    spent: v.spent,
    cap: v.cap,
    status: v.status,
    paceAhead: v.paceAhead,
    byMember: v.byMember,
    unconfirmedCount: v.unconfirmedCount,
    transactions: v.transactions.map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      merchantNormalized: t.merchantNormalized,
      amount: t.amount,
      kind: t.kind,
      ownerId: t.ownerMemberId,
      isConfirmed: t.isConfirmed,
    })),
  }));

  const fixedPaid = s.fixed.filter((f) => f.isPaid).length;
  const remaining = s.totalVariableCap - s.totalVariableSpent;
  const isCurrent = s.elapsedFraction > 0 && s.elapsedFraction < 1;
  const paceDelta = s.totalVariableSpent - Math.round(s.totalVariableCap * s.elapsedFraction);

  const verdictChip =
    s.verdict.status === "ok" ? "chip chip-ok" : s.verdict.status === "watch" ? "chip chip-watch" : "chip chip-over";

  return (
    <div className="mx-auto max-w-[860px]">
      {/* Month header */}
      <header className="settle flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="overline">{household.name}</div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-display text-[34px] font-semibold leading-tight text-ink">
              {monthLabel(month)}
            </h1>
            <nav className="flex items-center gap-1" aria-label="Month">
              <MonthArrow href={prev ? `/?m=${prev}` : null} dir="prev" />
              <MonthArrow href={next ? `/?m=${next}` : null} dir="next" />
            </nav>
          </div>
        </div>
        <span className={verdictChip} style={{ fontSize: 13, padding: "5px 14px" }}>
          <VerdictIcon status={s.verdict.status} />
          {s.verdict.headline}
        </span>
      </header>

      {/* Hero */}
      <section className="card settle settle-1 mt-6 px-7 py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="min-w-[240px]">
            <div className="overline">Variable spend</div>
            <div className="font-display mt-1 text-[52px] font-semibold leading-none tracking-tight text-ink">
              {formatCents(s.totalVariableSpent)}
            </div>
            <div className="mt-2 text-[13.5px] text-ink-secondary">
              of {formatCentsWhole(s.totalVariableCap)} budgeted
              {isCurrent && (
                <>
                  {" "}· day {s.daysElapsed} of {s.daysInMonth} ·{" "}
                  <span className={paceDelta > 0 ? "font-semibold status-watch" : "font-semibold status-ok"}>
                    {paceDelta > 0
                      ? `${formatCentsWhole(paceDelta)} ahead of pace`
                      : `${formatCentsWhole(-paceDelta)} under pace`}
                  </span>
                </>
              )}
            </div>
            <div
              className="meter mt-4 max-w-[420px]"
              style={{ background: "var(--color-sunken)", border: "1px solid var(--color-hairline)" }}
            >
              <span
                className="meter-fill"
                style={{
                  width: `${Math.min(100, (s.totalVariableSpent / Math.max(1, s.totalVariableCap)) * 100)}%`,
                  background: "var(--color-ember)",
                }}
              />
              {isCurrent && (
                <span className="meter-tick" style={{ left: `calc(${s.elapsedFraction * 100}% - 1px)` }} />
              )}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-x-9 gap-y-1 text-right">
            <Stat label="Left to spend" value={formatCentsWhole(remaining)} tone={remaining < 0 ? "over" : undefined} />
            <Stat label="Fixed items" value={`${fixedPaid} of ${s.fixed.length} paid`} tone={fixedPaid === s.fixed.length ? "ok" : undefined} />
            <Stat label="To review" value={String(s.unconfirmedCount + s.uncategorized.length)} tone={s.unconfirmedCount + s.uncategorized.length > 0 ? "watch" : "ok"} />
          </dl>
        </div>
      </section>

      {/* Variable categories */}
      <section className="settle settle-2 mt-8">
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="overline">Spending against caps</h2>
          <span className="text-[12px] text-ink-muted">
            {isCurrent ? "tick marks where the month stands" : "full month"}
          </span>
        </div>
        <div className="card overflow-hidden">
          <CategoryRows
            rows={rows}
            members={household.members}
            categories={categories.filter((c) => !c.isFixed).map((c) => ({ id: c.id, name: c.name }))}
            elapsedFraction={isCurrent ? s.elapsedFraction : 1}
          />
        </div>
      </section>

      {/* Fixed + history side by side */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="settle settle-3">
          <h2 className="overline mb-2.5 px-1">Fixed items</h2>
          <div className="card overflow-hidden">
            <FixedChecklist
              month={month}
              items={s.fixed.map((f) => ({
                categoryId: f.category.id,
                name: f.category.name,
                amount: f.amount,
                isPaid: f.isPaid,
              }))}
            />
          </div>
        </section>

        <section className="settle settle-4">
          <h2 className="overline mb-2.5 px-1">Month over month</h2>
          <div className="card px-5 pb-3 pt-5">
            <HistoryChart points={history} selected={month} />
            <FoodDrift foodByMonth={foodByMonth} months={months} />
          </div>
        </section>
      </div>

      <footer className="mt-10 pb-4 text-center text-[12px] text-ink-muted">
        Refunds count against their category · card payments are excluded from spend
      </footer>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "watch" | "over" }) {
  return (
    <div className="min-w-[86px]">
      <dt className="overline !text-[10px]">{label}</dt>
      <dd className={`mt-1 text-[17px] font-semibold ${tone ? `status-${tone}` : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

function MonthArrow({ href, dir }: { href: string | null; dir: "prev" | "next" }) {
  const glyph = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden
      className={dir === "next" ? "rotate-180" : ""}>
      <path d="M9 2.5 4.5 7 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const label = dir === "prev" ? "Previous month" : "Next month";
  if (!href) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-md text-hairline-deep" aria-hidden>
        {glyph}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
    >
      {glyph}
    </Link>
  );
}

function VerdictIcon({ status }: { status: "ok" | "watch" | "over" }) {
  if (status === "ok") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
        <path d="m2.5 7 3 3 5-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 1.5v6M6.5 10.4v.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FoodDrift({ foodByMonth, months }: { foodByMonth: Map<string, number>; months: string[] }) {
  if (months.length < 2) return null;
  const series = months.map((m) => foodByMonth.get(m) ?? 0);
  const rising = series.every((v, i) => i === 0 || v >= series[i - 1]);
  if (!rising) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (last <= first || first === 0) return null;
  return (
    <p className="mt-1 border-t border-hairline px-1 pt-3 text-[12.5px] text-ink-secondary">
      <span className="font-semibold text-ink">Food is drifting up</span> — {formatCentsWhole(first)} in{" "}
      {monthLabel(months[0]).split(" ")[0]}, {formatCentsWhole(last)} so far this month.
    </p>
  );
}
