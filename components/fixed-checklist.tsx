"use client";

import { useOptimistic, useTransition } from "react";
import { formatCentsWhole } from "@/lib/money";
import { toggleFixedPaid } from "@/app/actions";

export interface FixedItemDto {
  categoryId: string;
  name: string;
  amount: number;
  isPaid: boolean;
  /** Statement spend on this line, when any was imported. */
  spent: number;
}

export function FixedChecklist({ items, month }: { items: FixedItemDto[]; month: string }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(items);

  return (
    <ul>
      {optimistic.map((item) => (
        <li key={item.categoryId} className="border-b border-hairline last:border-b-0">
          <label className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken/60">
            <input
              type="checkbox"
              checked={item.isPaid}
              onChange={(e) => {
                const isPaid = e.target.checked;
                startTransition(async () => {
                  setOptimistic((prev) =>
                    prev.map((p) => (p.categoryId === item.categoryId ? { ...p, isPaid } : p)),
                  );
                  await toggleFixedPaid(item.categoryId, month, isPaid);
                });
              }}
              className="h-[17px] w-[17px] accent-[var(--color-ok)]"
            />
            <span
              className={`flex-1 text-[14px] font-medium ${
                item.isPaid ? "text-ink-muted line-through decoration-hairline-deep" : "text-ink"
              }`}
            >
              {item.name}
            </span>
            <span className="text-right">
              <span className="money block text-[13.5px] text-ink-secondary">
                {formatCentsWhole(item.amount)}
              </span>
              {item.spent > 0 && (
                <span className="money block text-[11px] text-ink-muted">
                  {formatCentsWhole(item.spent)} on card
                </span>
              )}
            </span>
            <span
              className={`w-[52px] text-right text-[11.5px] font-semibold ${
                item.isPaid ? "text-ok" : "text-ink-muted"
              }`}
            >
              {item.isPaid ? "paid" : "due"}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
