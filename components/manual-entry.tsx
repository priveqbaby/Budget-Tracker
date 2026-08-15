"use client";

import { useState, useTransition } from "react";
import { addManualTransaction } from "@/app/actions";
import { parseAmountToCents } from "@/lib/import/parse";

/** Cash has no CSV, and corrections sometimes mean adding a missed row (PRD v2 review). */
export function ManualEntry({
  sources,
  categories,
  defaultDate,
}: {
  sources: { id: string; label: string }[];
  categories: { id: string; name: string }[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const cents = parseAmountToCents(amount);
  const valid =
    Boolean(sourceId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Boolean(description.trim()) &&
    !Number.isNaN(cents) &&
    cents !== 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 text-[13px] font-semibold text-ink-secondary underline decoration-hairline-deep underline-offset-4 hover:text-ink"
      >
        Add one by hand instead
      </button>
    );
  }

  return (
    <form
      className="card mt-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        startTransition(async () => {
          await addManualTransaction({
            sourceId,
            date,
            description: description.trim(),
            amountCents: cents,
            categoryId: categoryId || null,
          });
          setDescription("");
          setAmount("");
          setSaved(true);
          setTimeout(() => setSaved(false), 2200);
        });
      }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="overline">Add a transaction by hand</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12.5px] font-semibold text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-[140px]">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        </label>
        <label className="min-w-[180px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Marché Jean-Talon, cash"
            className="field"
          />
        </label>
        <label className="w-[110px]">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Amount</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="24.50"
            inputMode="decimal"
            className="field money text-right"
          />
        </label>
      </div>
      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <label className="min-w-[160px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Source</span>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="field">
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[160px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field">
            <option value="">Leave uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending || !valid}>
          {pending ? "Adding…" : "Add"}
        </button>
        {saved && <span className="pb-2 text-[12.5px] font-semibold text-ok">added ✓</span>}
      </div>
      <p className="mt-2.5 text-[11.5px] text-ink-muted">
        Spend is positive; a refund is negative. Cash, e-transfers, anything without a
        statement.
      </p>
    </form>
  );
}
