"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addIncomeEntry, deleteIncomeEntry, setSavingsTarget, updateIncomeEntry,
} from "@/app/actions";
import { formatCentsWhole, monthLabel } from "@/lib/money";
import type { IncomeEntry, IncomeKind } from "@/lib/data/types";

const KINDS: Array<{ value: IncomeKind; label: string }> = [
  { value: "contribution", label: "Contribution" },
  { value: "salary", label: "Salary" },
  { value: "trading", label: "Trading" },
  { value: "side_hustle", label: "Side hustle" },
  { value: "tax_return", label: "Tax return" },
  { value: "gift", label: "Gift" },
  { value: "other", label: "Other" },
];

interface MemberDto {
  id: string;
  displayName: string;
}

/**
 * Recurring entries are the baseline the plan leans on (the contribution
 * floors); one-offs are recorded as they land and only count in their month.
 */
export function IncomeManager({
  entries,
  members,
  savingsTarget,
  defaultMonth,
}: {
  entries: IncomeEntry[];
  members: MemberDto[];
  savingsTarget: number;
  defaultMonth: string;
}) {
  const recurring = entries.filter((e) => e.isRecurring);
  const oneOffs = entries
    .filter((e) => !e.isRecurring)
    .sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""));
  const baseline = recurring.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="card overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-hairline bg-sunken/60 px-5 py-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Every month
          </span>
          <span className="money text-[12px] text-ink-secondary">
            {formatCentsWhole(baseline)} baseline
          </span>
        </div>
        {recurring.map((e) => (
          <IncomeRow key={e.id} entry={e} members={members} />
        ))}
        {recurring.length === 0 && (
          <div className="px-5 py-3.5 text-[13px] text-ink-muted">
            No recurring income yet — add each person’s monthly contribution.
          </div>
        )}

        <div className="border-y border-hairline bg-sunken/60 px-5 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
          One-offs
        </div>
        {oneOffs.map((e) => (
          <IncomeRow key={e.id} entry={e} members={members} />
        ))}
        {oneOffs.length === 0 && (
          <div className="px-5 py-3.5 text-[13px] text-ink-muted">
            Nothing recorded. Tax returns, trading gains and side-hustle income go here.
          </div>
        )}
      </div>

      <AddIncome members={members} defaultMonth={defaultMonth} />
      <SavingsTarget current={savingsTarget} />
    </div>
  );
}

function IncomeRow({ entry, members }: { entry: IncomeEntry; members: MemberDto[] }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const owner = members.find((m) => m.id === entry.memberId);

  return (
    <div className="border-b border-hairline px-5 py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] text-ink">{entry.label}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-muted">
            {owner?.displayName ?? "Joint"} ·{" "}
            {KINDS.find((k) => k.value === entry.kind)?.label ?? entry.kind}
            {entry.month && <> · {monthLabel(entry.month)}</>}
          </div>
        </div>
        <span className="money text-[14px] font-medium text-ink">
          {formatCentsWhole(entry.amount)}
        </span>
        <button
          type="button"
          onClick={() => setConfirming((c) => !c)}
          aria-label={`Remove ${entry.label}`}
          className="text-[12px] font-semibold text-ink-muted transition-colors hover:text-danger"
        >
          Remove
        </button>
      </div>
      {confirming && (
        <div className="rise-in mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className="btn !py-1 !text-[12.5px]"
            style={{ background: "var(--color-danger)", color: "#fff" }}
            onClick={() =>
              startTransition(async () => {
                await deleteIncomeEntry(entry.id);
                setConfirming(false);
                router.refresh();
              })
            }
          >
            {pending ? "Removing…" : "Remove it"}
          </button>
          <button type="button" className="btn btn-ghost !py-1 !text-[12.5px]" onClick={() => setConfirming(false)}>
            Keep
          </button>
        </div>
      )}
    </div>
  );
}

function AddIncome({ members, defaultMonth }: { members: MemberDto[]; defaultMonth: string }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<IncomeKind>("tax_return");
  const [memberId, setMemberId] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const cents = Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100);
  const valid = label.trim().length > 0 && Number.isFinite(cents) && cents > 0;

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost mt-3" onClick={() => setOpen(true)}>
        + Record income
      </button>
    );
  }

  return (
    <form
      className="card mt-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        startTransition(async () => {
          await addIncomeEntry({
            label: label.trim(),
            amount: cents,
            kind,
            memberId: memberId || null,
            isRecurring,
            month: isRecurring ? null : month,
          });
          setLabel("");
          setAmount("");
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="overline">Record income</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12.5px] font-semibold text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[180px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">What</span>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="2025 tax return"
            className="field"
          />
        </label>
        <label className="w-[120px]">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Amount</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="3180"
            className="field money text-right"
          />
        </label>
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <label className="min-w-[130px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as IncomeKind)} className="field">
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[120px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Whose</span>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="field">
            <option value="">Joint</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
        </label>
        {!isRecurring && (
          <label className="w-[130px]">
            <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="field" />
          </label>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending || !valid}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-secondary">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-ember)]"
        />
        Every month (a contribution floor or steady salary)
      </label>
    </form>
  );
}

function SavingsTarget({ current }: { current: number }) {
  const [value, setValue] = useState(String(Math.round(current / 100)));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const dollars = Number(value);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setValue(String(Math.round(current / 100)));
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents === current) return;
    startTransition(async () => {
      await setSavingsTarget(cents);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
  };

  return (
    <div className="card mt-3 flex flex-wrap items-center gap-3 px-5 py-3.5">
      <div className="min-w-[180px] flex-1">
        <div className="text-[14px] font-medium text-ink">Monthly savings intent</div>
        <div className="mt-0.5 text-[11.5px] text-ink-muted">
          The surplus is measured against this. Nothing moves money.
        </div>
      </div>
      {saved && <span className="text-[11.5px] font-semibold text-ok">saved ✓</span>}
      <div className="flex items-center gap-1">
        <span className="text-[13px] text-ink-muted">$</span>
        <input
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          inputMode="numeric"
          aria-label="Monthly savings target in dollars"
          className="field money !w-[92px] !py-1 text-right"
        />
        <span className="text-[12px] text-ink-muted">/mo</span>
      </div>
    </div>
  );
}
