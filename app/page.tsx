import Link from "next/link";
import { getStore, isDemoMode } from "@/lib/data";
import { DEMO_TODAY } from "@/lib/data/demo-seed";
import { monthFlow, summarizeMonth } from "@/lib/budget";
import { formatCentsWhole, monthLabel } from "@/lib/money";
import { type CategoryRowDto, type TxnDto } from "@/components/category-rows";
import { HistoryChart, type HistoryPointDto } from "@/components/history-chart";
import { MonthBoard } from "@/components/month-board";
import { MonthJournal } from "@/components/month-journal";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const store = await getStore();
  const todayIso = isDemoMode() ? DEMO_TODAY : new Date().toISOString().slice(0, 10);

  const [household, categories, months, incomeEntries, sources] = await Promise.all([
    store.getHousehold(),
    store.listCategories(),
    store.listMonths(),
    store.listIncomeEntries(),
    store.listSources(),
  ]);
  const sourceOptions = sources.map((s) => ({ id: s.id, label: s.label }));

  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : (months[months.length - 1] ?? todayIso.slice(0, 7));
  const monthIndex = months.indexOf(month);
  const prev = monthIndex > 0 ? months[monthIndex - 1] : null;
  const next = monthIndex >= 0 && monthIndex < months.length - 1 ? months[monthIndex + 1] : null;

  const data = await store.getMonthData(month);
  const s = summarizeMonth(data, categories, todayIso, {
    incomeEntries,
    savingsTarget: household.savingsTarget,
  });
  const flow = monthFlow(s);
  const note = await store.getMonthNote(month);

  // History across every retained month (goal 4: is food drifting up?).
  const history: HistoryPointDto[] = [];
  const foodByMonth = new Map<string, number>();
  for (const hm of months) {
    const hd = hm === month ? data : await store.getMonthData(hm);
    const hs = summarizeMonth(hd, categories, todayIso, {
      incomeEntries,
      savingsTarget: household.savingsTarget,
    });
    history.push({
      month: hm,
      spent: hs.totalVariableSpent,
      cap: hs.totalVariableCap,
      partial: hs.elapsedFraction < 1 && hs.elapsedFraction > 0,
    });
    const food = hs.variable.find((v) => v.category.name === "Food");
    if (food) foodByMonth.set(hm, food.spent);
  }

  const toDto = (t: (typeof data.transactions)[number]): TxnDto => ({
    id: t.id,
    date: t.date,
    description: t.description,
    merchantNormalized: t.merchantNormalized,
    amount: t.amount,
    kind: t.kind,
    ownerId: t.ownerMemberId,
    isConfirmed: t.isConfirmed,
    isExcluded: t.isExcluded,
    categoryId: t.categoryId,
  });

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
    transactions: v.transactions.map(toDto),
  }));
  const categoryOptions = categories
    .filter((c) => !c.isSurplus)
    .map((c) => ({ id: c.id, name: c.name }));

  // A quick-add while browsing March must land in March, not today.
  const lastDayOfMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const quickAddDate =
    month === todayIso.slice(0, 7)
      ? todayIso
      : `${month}-${String(lastDayOfMonth).padStart(2, "0")}`;

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
          {s.verdict.headline}
        </span>
      </header>

      {/* One client board owns every money move, so ticking a bill or filing a
          purchase moves the tank in the same beat instead of a round trip later. */}
      <MonthBoard
        base={{
          income: flow.income,
          byMember: s.income.byMember,
          rows,
          fixed: s.fixed.map((f) => ({
            categoryId: f.category.id,
            name: f.category.name,
            amount: f.amount,
            isPaid: f.isPaid,
            spent: f.spent,
          })),
          uncategorizedSpent: s.uncategorized.reduce((sum, t) => sum + t.amount, 0),
        }}
        month={month}
        members={household.members.map((m) => ({ id: m.id, displayName: m.displayName }))}
        categories={categoryOptions}
        sources={sourceOptions}
        quickAddDate={quickAddDate}
        elapsedFraction={s.elapsedFraction}
        daysElapsed={s.daysElapsed}
        daysInMonth={s.daysInMonth}
        isPlanned={s.income.isPlanned}
        plannedSurplus={s.income.plannedSurplus}
        monthIsOver={s.elapsedFraction >= 1}
        grossIncome={s.income.gross}
        uncategorized={s.uncategorized.map(toDto)}
        historySlot={
          <section key="history" className="settle settle-4">
            <h2 className="overline mb-2.5 px-1">Month over month</h2>
            <div className="card px-5 pb-3 pt-5">
              <HistoryChart points={history} selected={month} />
              <FoodDrift foodByMonth={foodByMonth} months={months} />
            </div>
          </section>
        }
      />

      <MonthJournal
        month={month}
        initialBody={note?.body ?? ""}
        initialUpdatedAt={note?.updatedAt ?? null}
      />

      <footer className="mt-10 pb-4 text-center text-[12px] text-ink-muted">
        Refunds count against their category · card payments are excluded from spend
      </footer>
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
