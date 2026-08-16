"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addIncomeEntry } from "@/app/actions";
import { formatCents, formatCentsWhole } from "@/lib/money";
import { parseAmountToCents } from "@/lib/import/parse";
import type { MonthFlow } from "@/lib/budget";
import type { IncomeEntry, IncomeKind } from "@/lib/data/types";

const KINDS: Array<{ value: IncomeKind; label: string }> = [
  { value: "side_hustle", label: "Side hustle" },
  { value: "trading", label: "Trading" },
  { value: "tax_return", label: "Tax return" },
  { value: "gift", label: "Gift" },
  { value: "salary", label: "Salary" },
  { value: "contribution", label: "Contribution" },
  { value: "other", label: "Other" },
];

const KIND_LABEL: Record<string, string> = {
  contribution: "contribution",
  salary: "salary",
  trading: "trading",
  side_hustle: "side hustle",
  tax_return: "tax return",
  gift: "gift",
  other: "other",
};

interface MemberDto {
  id: string;
  displayName: string;
}

/**
 * The month as one tank of money.
 *
 * Track = everything that came in. It reads left to right: what has already
 * gone, what is still promised to the plan, and what is genuinely free. Adding
 * income widens the tank and the free end grows; spending anything moves money
 * leftward out of free. The mark near the right is the plan's surplus — the
 * number this month is trying to clear.
 */
export function MonthFlowCard({
  flow,
  month,
  members,
  byMember,
  entries,
  savingsTarget,
  drawn,
}: {
  flow: MonthFlow;
  month: string;
  members: MemberDto[];
  byMember: Record<string, number>;
  entries: IncomeEntry[];
  savingsTarget: number;
  /** Overages across variable lines — the part of `free` they have eaten. */
  drawn: number;
}) {
  const income = Math.max(1, flow.income);
  const pct = (n: number) => Math.max(0, Math.min(100, (n / income) * 100));

  // Segments are clamped so an over-committed month never paints past the tank.
  const spentW = pct(flow.spent);
  const committedW = Math.min(pct(flow.committed), 100 - spentW);
  const freeW = Math.max(0, 100 - spentW - committedW);
  const markW = flow.plannedSurplus > 0 ? pct(income - flow.plannedSurplus) : null;

  const shownFree = useCountUp(flow.free);
  const shownIncome = useCountUp(flow.income);
  const over = flow.free < 0;
  const past = flow.free - flow.plannedSurplus;
  const oneOffs = entries.filter((e) => !e.isRecurring);

  return (
    <section className="settle settle-1 mt-6">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="overline">Money this month</h2>
        <span className="text-[12px] text-ink-muted">
          {flow.isPlanned
            ? "no income recorded — showing the plan"
            : flow.committed === 0
              ? "the month as it finished"
              : "income in, spending out"}
        </span>
      </div>

      <div className="card px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="min-w-[250px]">
            <div className="overline !text-[10px]">Came in</div>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="money font-display text-[38px] font-semibold leading-none tracking-tight text-ink">
                {formatCents(shownIncome)}
              </span>
              <AddIncome month={month} members={members} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-ink-secondary">
              {members.map((m) =>
                byMember[m.id] ? (
                  <span key={m.id}>
                    {m.displayName}{" "}
                    <span className="money font-medium text-ink">
                      {formatCentsWhole(byMember[m.id])}
                    </span>
                  </span>
                ) : null,
              )}
              {byMember.household ? (
                <span>
                  Joint{" "}
                  <span className="money font-medium text-ink">
                    {formatCentsWhole(byMember.household)}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-7 text-right">
            <Stat label="Spent" value={formatCentsWhole(flow.spent)} />
            {/* A finished month has nothing outstanding; "$0 committed" is noise. */}
            {flow.committed > 0 && (
              <Stat label="Still committed" value={formatCentsWhole(flow.committed)} />
            )}
            <div>
              <div className="overline !text-[10px]">Free</div>
              <div
                className={`money mt-1 text-[30px] font-semibold leading-none ${
                  over ? "status-over" : flow.goalMet ? "status-ok" : "text-ink"
                }`}
              >
                {formatCentsWhole(shownFree)}
              </div>
              {flow.plannedSurplus > 0 && (
                <div className="mt-1.5 flex justify-end">
                  <span
                    className={`chip ${flow.goalMet ? "chip-ok" : "chip-watch"}`}
                    style={{ fontSize: 11.5, padding: "3px 10px" }}
                  >
                    <span aria-hidden>{flow.goalMet ? "🎯" : "🐷"}</span>
                    {flow.goalMet
                      ? past > 0
                        ? `${formatCentsWhole(past)} past goal`
                        : "goal met exactly"
                      : `${formatCentsWhole(-past)} to goal`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* The tank. Widths are percentages of income, so the three always fill it. */}
        <div
          className="flowbar mt-5"
          role="img"
          aria-label={`Of ${formatCentsWhole(flow.income)} in, ${formatCentsWhole(
            flow.spent,
          )} spent, ${formatCentsWhole(flow.committed)} still committed, ${formatCentsWhole(
            flow.free,
          )} free against a ${formatCentsWhole(flow.plannedSurplus)} goal.`}
        >
          <span className="flowbar-seg flowbar-spent" style={{ width: `${spentW}%` }} />
          <span className="flowbar-seg flowbar-committed" style={{ width: `${committedW}%` }} />
          <span
            className={`flowbar-seg ${over ? "flowbar-short" : "flowbar-free"}`}
            style={{ width: `${freeW}%` }}
          />
          {markW !== null && (
            <span className="flowbar-mark" style={{ left: `${markW}%` }} aria-hidden />
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-secondary">
          <Key className="flowbar-spent" label="spent" />
          {flow.committed > 0 && (
            <Key className="flowbar-committed" label="still committed to the plan" />
          )}
          <Key className={over ? "flowbar-short" : "flowbar-free"} label="free" />
          {markW !== null && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[11px] w-[2px] rounded-[1px] bg-ink" />
              the plan&rsquo;s {formatCentsWhole(flow.plannedSurplus)} surplus
            </span>
          )}
        </div>

        {flow.committed > 0 && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
            Spending inside a cap just slides money from committed to spent. Free
            moves when you go past a cap, spend something unbudgeted, add income, or
            finish the month with room to spare.
          </p>
        )}

        {(over || oneOffs.length > 0 || savingsTarget > 0 || drawn > 0) && (
          <p className="mt-3.5 border-t border-hairline pt-3 text-[12.5px] leading-relaxed text-ink-secondary">
            {over && (
              <span className="font-semibold status-over">
                {formatCentsWhole(-flow.free)} more is committed than came in.{" "}
              </span>
            )}
            {oneOffs.length > 0 && (
              <>
                Lifted by{" "}
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
            {drawn > 0 && (
              <>
                Overages total <span className="money font-medium text-ink">{formatCentsWhole(drawn)}</span>,
                already out of free.{" "}
              </>
            )}
            {savingsTarget > 0 && (
              <span className={flow.free >= savingsTarget ? "status-ok" : "status-watch"}>
                {flow.free >= savingsTarget
                  ? `Clears your ${formatCentsWhole(savingsTarget)} savings target by ${formatCentsWhole(flow.free - savingsTarget)}.`
                  : `Short of your ${formatCentsWhole(savingsTarget)} savings target by ${formatCentsWhole(savingsTarget - flow.free)}.`}
              </span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[74px]">
      <div className="overline !text-[10px]">{label}</div>
      <div className="money mt-1 text-[17px] font-semibold text-ink-secondary">{value}</div>
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-[10px] w-[10px] rounded-[3px] ${className}`} />
      {label}
    </span>
  );
}

/** Extra money that landed this month — the one thing that makes the tank wider. */
function AddIncome({ month, members }: { month: string; members: MemberDto[] }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<IncomeKind>("side_hustle");
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cents = parseAmountToCents(amount);
  const valid = Boolean(label.trim()) && !Number.isNaN(cents) && cents > 0;

  const submit = () => {
    if (!valid || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await addIncomeEntry({
          memberId: memberId || null,
          label: label.trim(),
          kind,
          amount: cents,
          isRecurring: false,
          month,
        });
        setLabel("");
        setAmount("");
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add that");
      }
    });
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label="Add income to this month"
        aria-expanded={open}
        title="Add income"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-accent-wash hover:text-accent-deep"
      >
        <svg width="12" height="12" viewBox="0 0 13 13" aria-hidden>
          <path d="M6.5 1.8v9.4M1.8 6.5h9.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        add
      </button>

      {open && (
        <div className="rise-in absolute left-0 top-9 z-40 w-[280px] rounded-[12px] border border-hairline bg-white p-2.5 shadow-pop">
          <div className="px-0.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Income that landed this month
          </div>
          <input
            ref={first}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Freelance invoice"
            aria-label="What was it"
            className="field !py-1.5 text-[13px]"
          />
          <div className="mt-1.5 flex gap-1.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="450.00"
              inputMode="decimal"
              aria-label="Amount"
              className="field money !w-[100px] !py-1.5 text-right text-[13px]"
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as IncomeKind)}
              aria-label="Kind"
              className="field !py-1.5 text-[13px]"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            aria-label="Whose income"
            className="field mt-1.5 !py-1.5 text-[13px]"
          >
            <option value="">Joint</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
          {error && <p className="mt-2 text-[11.5px] status-over">{error}</p>}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">counts in this month only</span>
            <button
              type="button"
              onClick={submit}
              disabled={!valid || pending}
              className="btn btn-primary !px-3 !py-1 !text-[12.5px]"
            >
              {pending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Counts a money figure to its new value. The number it lands on is always the real one. */
function useCountUp(value: number, ms = 620) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from.current === value) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
