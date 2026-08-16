"use client";

import { useEffect, useRef, useState } from "react";
import { formatCents, formatCentsWhole } from "@/lib/money";
import { parseAmountToCents } from "@/lib/import/parse";
import type { MonthFlow } from "@/lib/budget";
import type { IncomeKind } from "@/lib/data/types";

const KINDS: Array<{ value: IncomeKind; label: string }> = [
  { value: "side_hustle", label: "Side hustle" },
  { value: "trading", label: "Trading" },
  { value: "tax_return", label: "Tax return" },
  { value: "gift", label: "Gift" },
  { value: "salary", label: "Salary" },
  { value: "contribution", label: "Contribution" },
  { value: "other", label: "Other" },
];

interface MemberDto {
  id: string;
  displayName: string;
}

/** The receipt for a move that just happened, shown flying off the tank. */
export interface Pulse {
  id: number;
  label: string;
  amount: number;
  tone: "out" | "in";
  note: string;
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
  members,
  chain,
  byMember,
  pulse,
  onAddIncome,
}: {
  flow: MonthFlow;
  members: MemberDto[];
  /** The four structural links above the joint account: where the money came from. */
  chain: { gross: number; takeHome: number; intoSavings: number };
  byMember: Record<string, number>;
  /** The last money move, so the tank can show where it went. */
  pulse: Pulse | null;
  onAddIncome: (input: {
    memberId: string | null;
    label: string;
    kind: IncomeKind;
    amount: number;
  }) => void;
}) {
  const shownFree = useCountUp(flow.free);
  const shownIncome = useCountUp(flow.income);
  const shownLeft = useCountUp(flow.left);

  const over = flow.free < 0;
  const past = flow.free - flow.plannedSurplus;

  return (
    <section className="settle settle-1 relative z-10 mt-6">
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
        {/* The chain, in the order the money actually travels. Only the last
            link moves during the month; the four before it are structure. */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <Link label="Combined income" value={formatCentsWhole(chain.gross)} />
          <Arrow />
          <Link label="Take-home" value={formatCentsWhole(chain.takeHome)} />
          <Arrow />
          <Link label="Into savings" value={formatCentsWhole(chain.intoSavings)} />
          <Arrow />
          <Link
            label="Joint account"
            value={formatCentsWhole(shownIncome)}
            strong
            after={<AddIncome members={members} onAdd={onAddIncome} />}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-ink-muted">
            {members.map((m) =>
              byMember[m.id] ? (
                <span key={m.id}>
                  {m.displayName} <span className="money">{formatCentsWhole(byMember[m.id])}</span>
                </span>
              ) : null,
            )}
            {byMember.household ? (
              <span>
                Joint <span className="money">{formatCentsWhole(byMember.household)}</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-start gap-7 text-right">
            <Stat label="Spent" value={formatCentsWhole(flow.spent)} />
            {/* The number that drains: every tick and every purchase moves it. */}
            <div>
              <div className="overline !text-[10px]">Still in the account</div>
              <div
                className={`money mt-1 text-[26px] font-semibold leading-none ${
                  flow.left < 0 ? "status-over" : "text-ink"
                }`}
              >
                {formatCentsWhole(shownLeft)}
              </div>
              {flow.committed > 0 && (
                <div className="mt-1 text-[11.5px] text-ink-muted">
                  {formatCentsWhole(flow.committed)} of it promised
                </div>
              )}
            </div>
            <div>
              <div className="overline !text-[10px]">Left over</div>
              <div
                className={`money mt-1 text-[26px] font-semibold leading-none ${
                  over ? "status-over" : flow.goalMet ? "status-ok" : "text-ink"
                }`}
              >
                {formatCentsWhole(shownFree)}
              </div>
              {flow.plannedSurplus > 0 && (
                <div className="mt-1 text-[11.5px] text-ink-muted">
                  {flow.goalMet
                    ? `${formatCentsWhole(past)} past the ${formatCentsWhole(flow.plannedSurplus)} goal`
                    : `${formatCentsWhole(-past)} to the ${formatCentsWhole(flow.plannedSurplus)} goal`}
                </div>
              )}
            </div>
          </div>
        </div>

        <Tank flow={flow} pulse={pulse} className="mt-9" />

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-secondary">
          <Key className="flowbar-variable" label="variable spend" />
          <Key className="flowbar-fixed" label="fixed spend" />
          {flow.committed > 0 && <Key className="flowbar-committed" label="still committed" />}
          <Key className={over ? "flowbar-short" : "flowbar-free"} label="left over" />
          {flow.plannedSurplus > 0 && (
            <Key className="flowbar-surplus" label={`${formatCentsWhole(flow.plannedSurplus)} surplus`} />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The bar is net income, cut into five: what variable spending took, what the
 * fixed bills took, what is still promised, what is free, and the surplus slice
 * the month is trying to fill. Each is a share of net, so they always add to it.
 */
function geometry(flow: MonthFlow) {
  const income = Math.max(1, flow.income);
  const pct = (n: number) => Math.max(0, Math.min(100, (n / income) * 100));
  // Clamped in order, so an over-committed month never paints past the bar.
  const variableW = pct(flow.variableSpent);
  const fixedW = Math.min(pct(flow.fixedSpent), 100 - variableW);
  const committedW = Math.min(pct(flow.committed), 100 - variableW - fixedW);
  const rest = Math.max(0, 100 - variableW - fixedW - committedW);
  const surplusW = Math.min(pct(flow.surplusHeld), rest);
  const freeW = Math.max(0, rest - surplusW);
  return { variableW, fixedW, committedW, freeW, surplusW, spentW: variableW + fixedW };
}

/**
 * The bar itself, plus the receipt that flies off the point where money moved.
 * Shared by the full card and the strip that pins to the top of the viewport,
 * so the reaction is the same wherever you happen to be looking.
 */
export function Tank({
  flow,
  pulse,
  className = "",
  slim = false,
}: {
  flow: MonthFlow;
  pulse: Pulse | null;
  className?: string;
  slim?: boolean;
}) {
  const { variableW, fixedW, committedW, freeW, surplusW, spentW } = geometry(flow);
  const over = flow.free < 0;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flowbar${slim ? " flowbar-slim" : ""}`}
        role="img"
        aria-label={`Of ${formatCentsWhole(flow.income)} net, ${formatCentsWhole(
          flow.variableSpent,
        )} variable spend, ${formatCentsWhole(flow.fixedSpent)} fixed spend, ${formatCentsWhole(
          flow.committed,
        )} still committed, ${formatCentsWhole(flow.freeAboveGoal)} free, and ${formatCentsWhole(
          flow.surplusHeld,
        )} of a ${formatCentsWhole(flow.plannedSurplus)} surplus.`}
      >
        <span className="flowbar-seg flowbar-variable" style={{ width: `${variableW}%` }} />
        <span className="flowbar-seg flowbar-fixed" style={{ width: `${fixedW}%` }} />
        <span className="flowbar-seg flowbar-committed" style={{ width: `${committedW}%` }} />
        <span
          className={`flowbar-seg ${over ? "flowbar-short" : "flowbar-free"}`}
          style={{ width: `${freeW}%` }}
        />
        <span className="flowbar-seg flowbar-surplus" style={{ width: `${surplusW}%` }} />
        {/* A fresh element per move: a CSS animation only restarts on mount, and
            keying the bar itself would kill the segment width transitions. */}
        {pulse && (
          <span key={pulse.id} className={`flowbar-sheen flowbar-sheen-${pulse.tone}`} aria-hidden />
        )}
      </div>

      {/* The receipt, launched from the exact point where the money left (or
          arrived). It is what makes ticking a bill feel like spending. */}
      {pulse && (
        <span
          key={pulse.id}
          // In the pinned strip the bar is flush with the top of the viewport,
          // so a receipt that rises would be clipped: it drops instead.
          className={`flowpill flowpill-${pulse.tone}${slim ? " flowpill-below" : ""}`}
          style={{ left: `${pulse.tone === "out" ? spentW : 100 - freeW / 2}%` }}
        >
          {pulse.tone === "out" ? "−" : "+"}
          {formatCentsWhole(pulse.amount)}
          <span className="flowpill-note">
            {pulse.label}
            {pulse.note ? ` · ${pulse.note}` : ""}
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * The tank, pinned to the top of the viewport once the card has scrolled away.
 * Without it, ticking a bill at the bottom of the page moves a bar nobody can
 * see — which is the whole point of ticking it here rather than in a spreadsheet.
 */
export function StickyTank({
  flow,
  pulse,
  on,
}: {
  flow: MonthFlow;
  pulse: Pulse | null;
  on: boolean;
}) {
  return (
    <div className={`tankbar${on ? " is-on" : ""}`} aria-hidden={!on}>
      <div className="tankbar-inner">
        <div className="tankbar-stat">
          <span className="overline !text-[9.5px]">Still in the account</span>
          <span
            className={`money text-[19px] font-semibold leading-none ${
              flow.left < 0 ? "status-over" : "text-ink"
            }`}
          >
            {formatCentsWhole(flow.left)}
          </span>
        </div>
        <Tank flow={flow} pulse={pulse} slim className="flex-1" />
        <div className="tankbar-stat text-right">
          <span className="overline !text-[9.5px]">Free</span>
          <span
            className={`money text-[19px] font-semibold leading-none ${
              flow.free < 0 ? "status-over" : flow.goalMet ? "status-ok" : "text-ink"
            }`}
          >
            {formatCentsWhole(flow.free)}
          </span>
        </div>
        <div className="tankbar-stat text-right">
          <span className="overline !text-[9.5px]">Surplus</span>
          <span className={`money text-[19px] font-semibold leading-none ${flow.goalMet ? "status-ok" : "text-ink-muted"}`}>
            {formatCentsWhole(flow.surplusHeld)}
            <span className="text-[12px] font-normal text-ink-muted">
              {" / "}{formatCentsWhole(flow.plannedSurplus)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** One link in the income chain: a caption over a figure. */
function Link({
  label,
  value,
  strong = false,
  after,
}: {
  label: string;
  value: string;
  strong?: boolean;
  after?: React.ReactNode;
}) {
  return (
    <div>
      <div className="overline !text-[9.5px]">{label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className={`money text-[19px] font-semibold leading-none ${
            strong ? "text-ink" : "text-ink-secondary"
          }`}
        >
          {value}
        </span>
        {after}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="13" height="10" viewBox="0 0 13 10" aria-hidden className="chain-arrow mb-[3px] shrink-0 text-hairline-deep">
      <path d="M1 5h10M8 1.5 11.5 5 8 8.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
function AddIncome({
  members,
  onAdd,
}: {
  members: MemberDto[];
  onAdd: (input: {
    memberId: string | null;
    label: string;
    kind: IncomeKind;
    amount: number;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<IncomeKind>("side_hustle");
  const [memberId, setMemberId] = useState("");
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
    if (!valid) return;
    onAdd({ memberId: memberId || null, label: label.trim(), kind, amount: cents });
    setLabel("");
    setAmount("");
    setOpen(false);
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
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">counts in this month only</span>
            <button
              type="button"
              onClick={submit}
              disabled={!valid}
              className="btn btn-primary !px-3 !py-1 !text-[12.5px]"
            >
              Add
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
