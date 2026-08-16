"use client";

import { formatCentsWhole } from "@/lib/money";
import { QuickAdd, type SourceOption } from "./quick-add";

export interface FixedItemDto {
  categoryId: string;
  name: string;
  amount: number;
  isPaid: boolean;
  /** Statement spend filed against this line, when any was imported. */
  spent: number;
}

/**
 * Ticking a bill is a money move, not a note to self — the board it reports to
 * takes the amount out of the tank in the same beat. What ticking moves is the
 * part the card has not already covered, so a bill whose charge already landed
 * says so instead of pretending to spend twice.
 */
export function FixedChecklist({
  items,
  sources,
  defaultDate,
  onToggle,
  onSpend,
}: {
  items: FixedItemDto[];
  sources: SourceOption[];
  defaultDate: string;
  onToggle: (categoryId: string, isPaid: boolean) => void;
  onSpend: (input: {
    sourceId: string;
    date: string;
    description: string;
    amountCents: number;
    categoryId: string;
  }) => void;
}) {
  return (
    <ul>
      {items.map((item) => {
        const owing = Math.max(0, item.amount - Math.max(0, item.spent));
        return (
          <li
            key={item.categoryId}
            className="flex items-stretch border-b border-hairline first:rounded-t-[15px] last:rounded-b-[15px] last:border-b-0"
          >
            {/* The "+" lives outside the label — inside it, clicking would toggle
                the paid checkbox. */}
            <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-[inherit] py-3 pl-5 pr-2 transition-colors hover:bg-sunken/60">
              <input
                type="checkbox"
                checked={item.isPaid}
                onChange={(e) => onToggle(item.categoryId, e.target.checked)}
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
                className={`w-[62px] text-right text-[11.5px] font-semibold ${
                  item.isPaid ? "text-ok" : owing === 0 ? "text-ink-muted" : "text-ink-secondary"
                }`}
                // Unticked but already charged: ticking it will move nothing,
                // and saying so beats a silent no-op.
                title={
                  !item.isPaid && owing === 0
                    ? "the card already covered this"
                    : undefined
                }
              >
                {item.isPaid
                  ? "paid"
                  : owing === 0
                    ? "on card"
                    : `−${formatCentsWhole(owing)}`}
              </span>
            </label>
            <div className="flex items-center pl-1 pr-4">
              <QuickAdd
                categoryId={item.categoryId}
                categoryName={item.name}
                sources={sources}
                defaultDate={defaultDate}
                onAdd={onSpend}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
