"use client";

import { useState, useTransition } from "react";
import { updateCategoryCap } from "@/app/actions";

export function CapEditor({ id, name, capCents }: { id: string; name: string; capCents: number }) {
  const [value, setValue] = useState(String(Math.round(capCents / 100)));
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const dollars = Number(value);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setValue(String(Math.round(capCents / 100)));
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents === capCents && !saved) return;
    startTransition(async () => {
      await updateCategoryCap(id, cents);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
  };

  return (
    <div className="flex items-center gap-3 border-b border-hairline px-5 py-2.5 last:border-b-0">
      <span className="flex-1 text-[14px] text-ink">{name}</span>
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
          className="field money !w-[84px] !py-1 text-right"
          aria-label={`${name} monthly cap in dollars`}
        />
        <span className="text-[12px] text-ink-muted">/mo</span>
      </div>
    </div>
  );
}
