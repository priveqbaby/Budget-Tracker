"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addManualTransaction } from "@/app/actions";
import { parseAmountToCents } from "@/lib/import/parse";

export interface SourceOption {
  id: string;
  label: string;
}

/**
 * A "+" on every budget line: description, amount, card, done. The category is
 * the line you clicked, so the one field people always got wrong is gone.
 *
 * Cash and e-transfers never arrive in a CSV, and a statement that hasn't
 * posted yet still has to land somewhere — this is the path for both.
 */
export function QuickAdd({
  categoryId,
  categoryName,
  sources,
  defaultDate,
  align = "right",
}: {
  categoryId: string;
  categoryName: string;
  sources: SourceOption[];
  defaultDate: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
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
  const valid =
    Boolean(sourceId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Boolean(description.trim()) &&
    !Number.isNaN(cents) &&
    cents !== 0;

  const submit = () => {
    if (!valid || pending) return;
    startTransition(async () => {
      await addManualTransaction({
        sourceId,
        date,
        description: description.trim(),
        amountCents: cents,
        categoryId,
      });
      setDescription("");
      setAmount("");
      setOpen(false);
    });
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label={`Add a transaction to ${categoryName}`}
        aria-expanded={open}
        title={`Add to ${categoryName}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="flex h-6 w-6 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-accent-wash hover:text-accent-deep"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
          <path
            d="M6.5 1.8v9.4M1.8 6.5h9.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          // Opaque, not the translucent surface: a popover that lets the rows
          // behind it show through is unreadable.
          className={`rise-in absolute top-8 z-40 w-[268px] rounded-[12px] border border-hairline bg-white p-2.5 shadow-pop ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <div className="px-0.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Add to {categoryName}
          </div>

          <input
            ref={firstField}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Marché Jean-Talon"
            aria-label="Description"
            className="field !py-1.5 text-[13px]"
          />

          <div className="mt-1.5 flex gap-1.5">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="24.50"
              inputMode="decimal"
              aria-label="Amount"
              className="field money !w-[92px] !py-1.5 text-right text-[13px]"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className="field !py-1.5 text-[13px]"
            />
          </div>

          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            aria-label="Card"
            className="field mt-1.5 !py-1.5 text-[13px]"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">refund? use −24.50</span>
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
