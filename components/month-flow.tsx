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
  stats,
  pulse,
  onAddIncome,
}: {
  flow: MonthFlow;
  members: MemberDto[];
  /** The four structural links above the joint account: where the money came from. */
  chain: { gross: number; takeHome: number; intoSavings: number };
  byMember: Record<string, number>;
  /** The readings the merged card carries below the bar. */
  stats: {
    variableCap: number;
    leftToSpend: number;
    fixedPlanned: number;
    fixedPaid: number;
    fixedCount: number;
    toReview: number;
    paceDelta: number;
    isCurrent: boolean;
  };
  /** The last money move, so the tank can show where it went. */
  pulse: Pulse | null;
  onAddIncome: (input: {
    memberId: string | null;
    label: string;
    kind: IncomeKind;
    amount: number;
  }) => void;
}) {
  const shownIncome = useCountUp(flow.income);
  const shownLeft = useCountUp(flow.left);

  const over = flow.left < 0;

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
        {/* Where the money comes from, in the order it travels. Four links on
            one grid so the labels and figures line up down the card. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <ChainLink label="Combined income" value={chain.gross} />
          <ChainLink label="Take-home" value={chain.takeHome} />
          <ChainLink label="Into savings" value={chain.intoSavings} />
          <ChainLink label="Joint account" value={shownIncome} strong>
            <AddIncome members={members} onAdd={onAddIncome} />
          </ChainLink>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
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

        <Tank flow={flow} pulse={pulse} className="mt-7" />

        {/* The legend is the figures. Same contract in each column — swatch and
            label, value, one note — so the three read as one row. */}
        <div className="mt-4 grid grid-cols-3 gap-x-4">
          <Share
            swatch="flowbar-variable"
            label="Variable spend"
            value={flow.variableSpent}
            note={
              <>
                of {formatCentsWhole(stats.variableCap)} budgeted
                {stats.isCurrent && (
                  <>
                    {" · "}
                    <span className={stats.paceDelta > 0 ? "status-watch" : "status-ok"}>
                      {stats.paceDelta > 0
                        ? `${formatCentsWhole(stats.paceDelta)} ahead of pace`
                        : `${formatCentsWhole(-stats.paceDelta)} under pace`}
                    </span>
                  </>
                )}
              </>
            }
          />
          <Share
            swatch="flowbar-fixed"
            label="Fixed spend"
            value={flow.fixedSpent}
            align="center"
            note={<>of {formatCentsWhole(stats.fixedPlanned)} planned</>}
          />
          <Share
            swatch={over ? "flowbar-short" : "flowbar-surplus"}
            label="Surplus"
            value={shownLeft}
            align="right"
            over={over}
            note={
              flow.committed > 0 ? (
                <>{formatCentsWhole(flow.committed)} of bills still to pay</>
              ) : null
            }
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-x-4 border-t border-hairline pt-4">
          <Mini label="Left to spend" value={formatCentsWhole(stats.leftToSpend)} tone={stats.leftToSpend < 0 ? "over" : undefined} />
          <Mini
            label="Fixed items"
            value={`${stats.fixedPaid} of ${stats.fixedCount} paid`}
            align="center"
            tone={stats.fixedPaid === stats.fixedCount ? "ok" : undefined}
          />
          <Mini
            label="To review"
            value={String(stats.toReview)}
            align="right"
            tone={stats.toReview > 0 ? "watch" : "ok"}
          />
        </div>
      </div>
    </section>
  );
}

/** One link in the income chain: a caption over a figure. */
function ChainLink({
  label,
  value,
  strong = false,
  children,
}: {
  label: string;
  value: number;
  strong?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="overline !text-[9.5px]">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {/* Proportional figures: tabular widths make a standalone number look
            loose at this size (dataviz: figures). */}
        <span
          className={`text-[21px] font-semibold leading-none tracking-tight ${
            strong ? "text-ink" : "text-ink-secondary"
          }`}
        >
          {formatCentsWhole(value)}
        </span>
        {children}
      </div>
    </div>
  );
}

/** One share of the joint account: swatch and label, figure, note. */
function Share({
  swatch,
  label,
  value,
  note,
  align = "left",
  over = false,
}: {
  swatch: string;
  label: string;
  value: number;
  note?: React.ReactNode;
  align?: "left" | "center" | "right";
  over?: boolean;
}) {
  const box = align === "right" ? "text-right" : align === "center" ? "text-center" : "";
  const row = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "";
  return (
    <div className={box}>
      <div className={`flex items-center gap-2 ${row}`}>
        <span className={`inline-block h-[10px] w-[10px] shrink-0 rounded-[3px] ${swatch}`} />
        <span className="text-[12px] font-semibold text-ink-secondary">{label}</span>
      </div>
      <div
        className={`mt-2 text-[26px] font-semibold leading-none tracking-tight ${
          over ? "status-over" : "text-ink"
        }`}
      >
        {formatCentsWhole(value)}
      </div>
      {note && <div className="mt-1.5 text-[11.5px] leading-snug text-ink-muted">{note}</div>}
    </div>
  );
}

/** The smaller readings under the rule: same contract, quieter. */
function Mini({
  label,
  value,
  align = "left",
  tone,
}: {
  label: string;
  value: string;
  align?: "left" | "center" | "right";
  tone?: "ok" | "watch" | "over";
}) {
  const box = align === "right" ? "text-right" : align === "center" ? "text-center" : "";
  return (
    <div className={box}>
      <div className="overline !text-[9.5px]">{label}</div>
      <div className={`mt-1.5 text-[16px] font-semibold ${tone ? `status-${tone}` : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * The bar is the joint account, cut into three: what variable spending took,
 * what the fixed bills took, and the surplus — simply whatever is left. The
 * three always add to the account, so the bar cannot misstate it.
 */
function geometry(flow: MonthFlow) {
  const income = Math.max(1, flow.income);
  const pct = (n: number) => Math.max(0, Math.min(100, (n / income) * 100));
  // Clamped in order, so an overspent month never paints past the bar.
  const variableW = pct(flow.variableSpent);
  const fixedW = Math.min(pct(flow.fixedSpent), 100 - variableW);
  const surplusW = Math.max(0, 100 - variableW - fixedW);
  return { variableW, fixedW, surplusW, spentW: variableW + fixedW };
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
  const { variableW, fixedW, surplusW, spentW } = geometry(flow);
  const over = flow.left < 0;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flowbar${slim ? " flowbar-slim" : ""}`}
        role="img"
        aria-label={`Of ${formatCentsWhole(flow.income)} in the joint account, ${formatCentsWhole(
          flow.variableSpent,
        )} variable spend, ${formatCentsWhole(flow.fixedSpent)} fixed spend, ${formatCentsWhole(
          flow.left,
        )} surplus.`}
      >
        <span className="flowbar-seg flowbar-variable" style={{ width: `${variableW}%` }} />
        <span className="flowbar-seg flowbar-fixed" style={{ width: `${fixedW}%` }} />
        <span
          className={`flowbar-seg ${over ? "flowbar-short" : "flowbar-surplus"}`}
          style={{ width: `${surplusW}%` }}
        />
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
          style={{ left: `${pulse.tone === "out" ? spentW : 100 - surplusW / 2}%` }}
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
          <span className="overline !text-[9.5px]">Spent</span>
          <span className="money text-[19px] font-semibold leading-none text-ink-secondary">
            {formatCentsWhole(flow.spent)}
          </span>
        </div>
        <Tank flow={flow} pulse={pulse} slim className="flex-1" />
        <div className="tankbar-stat text-right">
          <span className="overline !text-[9.5px]">Surplus</span>
          <span
            className={`money text-[19px] font-semibold leading-none ${
              flow.left < 0 ? "status-over" : "text-ink"
            }`}
          >
            {formatCentsWhole(flow.left)}
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
