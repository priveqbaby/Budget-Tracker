"use client";

import { useState } from "react";
import { formatCents, dayLabel } from "@/lib/money";
import { TxnActions, type CategoryOption } from "./txn-actions";
import type { TxnDto } from "./category-rows";

/**
 * Spend with no category still counts against the month, so it gets a row of
 * its own instead of vanishing from the list (PRD v2 §2.5).
 */
export function UncategorizedRow({
  transactions,
  categories,
}: {
  transactions: TxnDto[];
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  if (transactions.length === 0) return null;
  const total = transactions.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="rounded-b-[13px] border-t border-hairline bg-accent-wash/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 px-5 py-3.5 text-left transition-colors hover:bg-accent-wash/50 md:grid-cols-[200px_minmax(0,1fr)_auto]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <svg
            width="10" height="10" viewBox="0 0 10 10" aria-hidden
            className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          >
            <path d="M3 1.5 7 5 3 8.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate text-[14px] font-semibold text-accent-deep">Uncategorized</span>
        </span>
        <span className="hidden text-[12.5px] text-ink-secondary md:block">
          counts against the month, but not against any cap
        </span>
        <span className="whitespace-nowrap text-right">
          <span className="money text-[13.5px] font-medium text-ink">{formatCents(total)}</span>
          <span className="ml-2 text-[11.5px] font-semibold text-accent-deep">
            {transactions.length} to file
          </span>
        </span>
      </button>

      {open && (
        <div className="rise-in border-t border-hairline px-5 pb-4 pt-3 md:pl-[47px]">
          <table className="w-full text-[13px]">
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-hairline/70 first:border-t-0">
                  <td className="money w-[64px] py-[7px] pr-3 text-[12px] text-ink-muted">
                    {dayLabel(t.date)}
                  </td>
                  <td className="max-w-0 truncate py-[7px] pr-3 text-ink" title={t.description}>
                    {t.merchantNormalized}
                  </td>
                  <td className="money w-[90px] py-[7px] text-right text-ink">
                    {formatCents(t.amount)}
                  </td>
                  <td className="w-[34px] py-[7px] pl-2 text-right">
                    <TxnActions
                      txnId={t.id}
                      categoryId={t.categoryId}
                      isExcluded={t.isExcluded}
                      categories={categories}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
