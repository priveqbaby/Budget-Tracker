"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { addManualTransaction, addIncomeEntry, toggleFixedPaid } from "@/app/actions";
import { flowFrom } from "@/lib/budget";

import { CategoryRows, type CategoryRowDto, type MemberDto, type TxnDto } from "./category-rows";
import { FixedChecklist, type FixedItemDto } from "./fixed-checklist";
import { MonthFlowCard, StickyTank, type Pulse } from "./month-flow";
import { UncategorizedRow } from "./uncategorized-row";
import type { SourceOption } from "./quick-add";
import type { IncomeKind } from "@/lib/data/types";

/** Everything a move can change. The tank is derived from this, never stored. */
interface Board {
  income: number;
  byMember: Record<string, number>;
  rows: CategoryRowDto[];
  fixed: FixedItemDto[];
  uncategorizedSpent: number;
}

type Move =
  | { kind: "fixed"; categoryId: string; isPaid: boolean }
  | { kind: "spend"; categoryId: string | null; amount: number }
  | { kind: "income"; memberId: string | null; amount: number };

function apply(b: Board, m: Move): Board {
  switch (m.kind) {
    case "fixed":
      return {
        ...b,
        fixed: b.fixed.map((f) =>
          f.categoryId === m.categoryId ? { ...f, isPaid: m.isPaid } : f,
        ),
      };
    case "spend":
      if (m.categoryId === null) {
        return { ...b, uncategorizedSpent: b.uncategorizedSpent + m.amount };
      }
      return {
        ...b,
        rows: b.rows.map((r) =>
          r.id === m.categoryId ? { ...r, spent: r.spent + m.amount } : r,
        ),
        fixed: b.fixed.map((f) =>
          f.categoryId === m.categoryId ? { ...f, spent: f.spent + m.amount } : f,
        ),
      };
    case "income": {
      const key = m.memberId ?? "household";
      return {
        ...b,
        income: b.income + m.amount,
        byMember: { ...b.byMember, [key]: (b.byMember[key] ?? 0) + m.amount },
      };
    }
  }
}

/**
 * The interactive half of the dashboard.
 *
 * Every money move — ticking a fixed bill, filing a purchase, recording income
 * — lands on this board first and only then goes to the server. The tank, the
 * meters and the checklist all read from the same optimistic state, so the bar
 * moves under your finger instead of a beat later, and a pill flies off the
 * point where the money left.
 */
export function MonthBoard({
  base,
  month,
  members,
  categories,
  sources,
  quickAddDate,
  elapsedFraction,
  daysElapsed,
  daysInMonth,
  isPlanned,
  plannedSurplus,
  monthIsOver,
  chain,
  uncategorized,
  historySlot,
}: {
  base: Board;
  month: string;
  members: MemberDto[];
  categories: { id: string; name: string }[];
  sources: SourceOption[];
  quickAddDate: string;
  elapsedFraction: number;
  daysElapsed: number;
  daysInMonth: number;
  isPlanned: boolean;
  plannedSurplus: number;
  monthIsOver: boolean;
  /** The structural links above the joint account, for the header's chain. */
  chain: { gross: number; takeHome: number; intoSavings: number };
  uncategorized: TxnDto[];
  historySlot: ReactNode;
}) {
  const [board, move] = useOptimistic(base, apply);
  const [, startTransition] = useTransition();
  // Presentational only, and deliberately outside the optimistic state: the
  // pill has to survive the server round trip that resets `board`.
  const [pulse, setPulse] = useState<Pulse | null>(null);
  // The card is 1,000px above the checklist. Once it scrolls away a slim copy
  // pins to the top, so a tick at the bottom of the page still visibly moves
  // money. Watching a sentinel beats guessing at scroll offsets.
  const sentinel = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const announce = (p: Omit<Pulse, "id">) => {
    const id = Date.now();
    setPulse({ ...p, id });
    setTimeout(() => setPulse((cur) => (cur?.id === id ? null : cur)), 1500);
  };

  const flow = flowFrom({
    income: board.income,
    isPlanned,
    plannedSurplus,
    monthIsOver,
    variable: board.rows.map((r) => ({ cap: r.cap, spent: r.spent })),
    uncategorizedSpent: board.uncategorizedSpent,
    fixed: board.fixed.map((f) => ({ amount: f.amount, isPaid: f.isPaid, spent: f.spent })),
  });

  const onToggleFixed = (categoryId: string, isPaid: boolean) => {
    const item = board.fixed.find((f) => f.categoryId === categoryId);
    // What ticking actually moves: the part of the bill the card has not
    // already covered. A bill whose charge already landed moves nothing.
    const delta = item ? Math.max(0, item.amount - Math.max(0, item.spent)) : 0;
    if (delta > 0) {
      announce({
        label: item?.name ?? "",
        amount: delta,
        tone: isPaid ? "out" : "in",
        note: isPaid ? "paid" : "unpaid",
      });
    }
    startTransition(async () => {
      move({ kind: "fixed", categoryId, isPaid });
      await toggleFixedPaid(categoryId, month, isPaid);
    });
  };

  const onSpend = (input: {
    sourceId: string;
    date: string;
    description: string;
    amountCents: number;
    categoryId: string;
  }) => {
    const name =
      board.rows.find((r) => r.id === input.categoryId)?.name ??
      board.fixed.find((f) => f.categoryId === input.categoryId)?.name ??
      "";
    announce({
      label: name,
      amount: Math.abs(input.amountCents),
      tone: input.amountCents >= 0 ? "out" : "in",
      note: input.amountCents >= 0 ? input.description : "refund",
    });
    startTransition(async () => {
      move({ kind: "spend", categoryId: input.categoryId, amount: input.amountCents });
      await addManualTransaction(input);
    });
  };

  const onAddIncome = (input: {
    memberId: string | null;
    label: string;
    kind: IncomeKind;
    amount: number;
  }) => {
    announce({ label: input.label, amount: input.amount, tone: "in", note: "income" });
    startTransition(async () => {
      move({ kind: "income", memberId: input.memberId, amount: input.amount });
      await addIncomeEntry({ ...input, isRecurring: false, month });
    });
  };

  const totalVariableSpent =
    board.rows.reduce((s, r) => s + r.spent, 0) + board.uncategorizedSpent;
  const totalVariableCap = board.rows.reduce((s, r) => s + r.cap, 0);
  const fixedPaid = board.fixed.filter((f) => f.isPaid).length;
  const remaining = totalVariableCap - totalVariableSpent;
  const isCurrent = elapsedFraction > 0 && elapsedFraction < 1;
  const paceDelta = totalVariableSpent - Math.round(totalVariableCap * elapsedFraction);
  // Fixed lines carry statement rows too, so their unreviewed ones count as
  // much as a variable line's.
  const toReview =
    board.rows.reduce((s, r) => s + r.unconfirmedCount, 0) +
    board.fixed.reduce((s, f) => s + f.unconfirmedCount, 0) +
    uncategorized.length;

  return (
    <>
      <StickyTank flow={flow} pulse={pulse} on={pinned} />

      <MonthFlowCard
        flow={flow}
        members={members}
        chain={chain}
        byMember={board.byMember}
        stats={{
          variableCap: totalVariableCap,
          leftToSpend: remaining,
          fixedPlanned: board.fixed.reduce((sum, f) => sum + f.amount, 0),
          fixedPaid,
          fixedCount: board.fixed.length,
          toReview,
          paceDelta,
          isCurrent,
        }}
        pulse={pulse}
        onAddIncome={onAddIncome}
      />
      <div ref={sentinel} aria-hidden />

      {/* Variable categories. relative z-10: the quick-add panels are absolute
          inside the card, and without this the next section paints over them. */}
      <section className="settle settle-3 relative z-10 mt-8">
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="overline">Spending against caps</h2>
          <span className="text-[12px] text-ink-muted">
            {isCurrent ? "tick marks where the month stands" : "full month"}
          </span>
        </div>
        {/* No overflow-hidden: the per-transaction action menu overflows the card. */}
        <div className="card">
          <CategoryRows
            rows={board.rows}
            members={members}
            categories={categories}
            sources={sources}
            defaultDate={quickAddDate}
            elapsedFraction={isCurrent ? elapsedFraction : 1}
            onSpend={onSpend}
          />
          <UncategorizedRow transactions={uncategorized} categories={categories} />
        </div>
      </section>

      {/* Fixed + history side by side */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="settle settle-4 relative z-10">
          <h2 className="overline mb-2.5 px-1">Fixed items</h2>
          {/* No overflow-hidden: the quick-add panel overflows the card. */}
          <div className="card">
            <FixedChecklist
              items={board.fixed}
              sources={sources}
              defaultDate={quickAddDate}
              onToggle={onToggleFixed}
              onSpend={onSpend}
            />
          </div>
        </section>
        {historySlot}
      </div>
    </>
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
