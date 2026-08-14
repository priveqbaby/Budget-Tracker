"use client";

import { useState, useTransition } from "react";
import { formatCents, formatCentsWhole, dayLabel } from "@/lib/money";
import { recategorizeTransaction } from "@/app/actions";

export interface TxnDto {
  id: string;
  date: string;
  description: string;
  merchantNormalized: string;
  amount: number;
  kind: "spend" | "refund" | "payment";
  ownerId: string;
  isConfirmed: boolean;
}

export interface CategoryRowDto {
  id: string;
  name: string;
  spent: number;
  cap: number;
  status: "ok" | "watch" | "over";
  paceAhead: boolean;
  transactions: TxnDto[];
  byMember: Record<string, number>;
  unconfirmedCount: number;
}

export interface MemberDto {
  id: string;
  displayName: string;
}

const FILL: Record<CategoryRowDto["status"], string> = {
  ok: "var(--color-ok)",
  watch: "var(--color-warn)",
  over: "var(--color-danger)",
};
const TRACK: Record<CategoryRowDto["status"], string> = {
  ok: "var(--color-ok-track)",
  watch: "var(--color-warn-track)",
  over: "var(--color-danger-track)",
};
const STATUS_LABEL: Record<CategoryRowDto["status"], string> = {
  ok: "on pace",
  watch: "near cap",
  over: "over",
};

// Member identity colors (fixed assignment, never re-ranked).
const MEMBER_COLOR: Record<string, string> = {
  leon: "#a85a32",
  sara: "#56698f",
};

export function CategoryRows({
  rows,
  members,
  categories,
  elapsedFraction,
}: {
  rows: CategoryRowDto[];
  members: MemberDto[];
  categories: { id: string; name: string }[];
  elapsedFraction: number;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      {rows.map((row) => {
        const pct = row.cap > 0 ? row.spent / row.cap : 0;
        const isOpen = open === row.id;
        return (
          <div key={row.id} className="border-b border-hairline last:border-b-0">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : row.id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1.5 px-5 py-3.5 text-left transition-colors hover:bg-[rgba(58,46,29,0.03)] md:grid-cols-[200px_minmax(0,1fr)_auto]"
              aria-expanded={isOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <svg
                  width="10" height="10" viewBox="0 0 10 10" aria-hidden
                  className={`shrink-0 text-ink-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                >
                  <path d="M3 1.5 7 5 3 8.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="truncate text-[14px] font-semibold text-ink">{row.name}</span>
                {row.unconfirmedCount > 0 && (
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full bg-ember"
                    title={`${row.unconfirmedCount} to review`}
                  />
                )}
              </span>

              <span className="col-span-2 md:col-span-1">
                <span className="meter block" style={{ background: TRACK[row.status] }}>
                  <span
                    className="meter-fill"
                    style={{ width: `${Math.min(100, pct * 100)}%`, background: FILL[row.status] }}
                  />
                  {elapsedFraction > 0 && elapsedFraction < 1 && (
                    <span className="meter-tick" style={{ left: `calc(${elapsedFraction * 100}% - 1px)` }} />
                  )}
                </span>
              </span>

              <span className="row-start-1 whitespace-nowrap text-right md:row-start-auto">
                <span className="money text-[13.5px] font-medium text-ink">{formatCents(row.spent)}</span>
                <span className="money text-[12.5px] text-ink-muted"> / {formatCentsWhole(row.cap)}</span>
                <span
                  className={`ml-2 text-[11.5px] font-semibold ${
                    row.paceAhead ? "status-watch" : `status-${row.status}`
                  }`}
                >
                  {row.paceAhead ? "ahead of pace" : STATUS_LABEL[row.status]}
                </span>
              </span>
            </button>

            {isOpen && (
              <div className="rise-in border-t border-hairline bg-sunken/60 px-5 pb-4 pt-3 md:pl-[47px]">
                <MemberSplit byMember={row.byMember} members={members} total={row.spent} />
                <table className="mt-3 w-full text-[13px]">
                  <tbody>
                    {row.transactions.map((t) => (
                      <tr key={t.id} className="border-t border-hairline/70 first:border-t-0">
                        <td className="money w-[64px] py-[7px] pr-3 text-[12px] text-ink-muted">
                          {dayLabel(t.date)}
                        </td>
                        <td className="max-w-0 truncate py-[7px] pr-3 text-ink" title={t.description}>
                          {t.merchantNormalized}
                          {t.kind === "refund" && (
                            <span className="ml-2 text-[11px] font-semibold text-ok">refund</span>
                          )}
                          {!t.isConfirmed && (
                            <ReviewSelect txnId={t.id} categories={categories} />
                          )}
                        </td>
                        <td className="w-[30px] py-[7px] pr-3">
                          <span
                            className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: MEMBER_COLOR[t.ownerId] ?? "var(--color-ink-muted)" }}
                            title={members.find((m) => m.id === t.ownerId)?.displayName}
                          >
                            {(members.find((m) => m.id === t.ownerId)?.displayName ?? "?")[0]}
                          </span>
                        </td>
                        <td className="money w-[90px] py-[7px] text-right text-ink">
                          {formatCents(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MemberSplit({
  byMember,
  members,
  total,
}: {
  byMember: Record<string, number>;
  members: MemberDto[];
  total: number;
}) {
  if (total <= 0) return null;
  const parts = members
    .map((m) => ({ member: m, amount: byMember[m.id] ?? 0 }))
    .filter((p) => p.amount > 0);
  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-[8px] flex-1 gap-[2px] overflow-hidden rounded-[4px]">
        {parts.map((p) => (
          <div
            key={p.member.id}
            style={{
              width: `${(p.amount / total) * 100}%`,
              background: MEMBER_COLOR[p.member.id] ?? "var(--color-ink-muted)",
            }}
            className="rounded-[2px]"
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-3.5">
        {parts.map((p) => (
          <span key={p.member.id} className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
            <span
              className="h-[8px] w-[8px] rounded-full"
              style={{ background: MEMBER_COLOR[p.member.id] ?? "var(--color-ink-muted)" }}
            />
            {p.member.displayName}
            <span className="money font-medium text-ink">{formatCents(p.amount)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ReviewSelect({
  txnId,
  categories,
}: {
  txnId: string;
  categories: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <span className="ml-2 text-[11px] font-semibold text-ok">saved ✓</span>;
  return (
    <span className="ml-2 inline-flex items-center gap-1.5">
      <span className="rounded-full bg-ember-wash px-2 py-[1px] text-[10.5px] font-semibold text-ember-deep">
        review
      </span>
      <select
        disabled={pending}
        defaultValue=""
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const categoryId = e.target.value;
          if (!categoryId) return;
          startTransition(async () => {
            await recategorizeTransaction(txnId, categoryId);
            setDone(true);
          });
        }}
        className="rounded-md border border-hairline-deep bg-surface px-1.5 py-[2px] text-[11px] text-ink-secondary"
      >
        <option value="">confirm as…</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </span>
  );
}
