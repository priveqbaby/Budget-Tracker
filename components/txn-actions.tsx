"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  deleteTransaction,
  recategorizeTransaction,
  setTransactionExcluded,
} from "@/app/actions";

export interface CategoryOption {
  id: string;
  name: string;
}

/**
 * One control per transaction: move to a category, exclude from spend, delete.
 * No mode switches (PRD v2 §3).
 */
export function TxnActions({
  txnId,
  categoryId,
  isExcluded,
  categories,
}: {
  txnId: string;
  categoryId: string | null;
  isExcluded: boolean;
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = categories.find((c) => c.id === categoryId) ?? null;

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      setOpen(false);
      setConfirmDelete(false);
    });

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label="Edit transaction"
        aria-expanded={open}
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-6 w-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-hairline hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
          <circle cx="7" cy="3" r="1.3" />
          <circle cx="7" cy="7" r="1.3" />
          <circle cx="7" cy="11" r="1.3" />
        </svg>
      </button>

      {open && (
        <div
          // Opaque: the translucent surface let the rows behind bleed through.
          className="absolute right-0 top-7 z-30 w-[232px] rounded-[10px] border border-hairline bg-white p-1.5 shadow-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="block px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Move to category
          </label>
          {/* Always starts on the placeholder: picking the category a row is
              already in must still fire onChange, so a correct guess can be
              confirmed. */}
          <select
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && run(() => recategorizeTransaction(txnId, e.target.value))}
            className="field !py-1.5 text-[13px]"
          >
            <option value="">
              {current ? `In ${current.name} — move or confirm…` : "Pick a category…"}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="my-1.5 h-px bg-hairline" />

          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setTransactionExcluded(txnId, !isExcluded))}
            className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-ink-secondary transition-colors hover:bg-sunken hover:text-ink"
          >
            {isExcluded ? "Include in spend" : "Exclude from spend"}
          </button>

          {confirmDelete ? (
            <div className="rounded-md bg-danger-track/60 p-2">
              <p className="text-[11.5px] leading-snug text-ink-secondary">
                Deleting removes this row. Re-importing the same statement will bring it
                back.
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteTransaction(txnId))}
                  className="btn !py-1 !text-[12.5px]"
                  style={{ background: "var(--color-danger)", color: "#fff" }}
                >
                  {pending ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="btn btn-ghost !py-1 !text-[12.5px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-danger transition-colors hover:bg-danger-track/50"
            >
              Delete transaction
            </button>
          )}
        </div>
      )}
    </div>
  );
}
