"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { undoImportBatch } from "@/app/actions";
import { dayLabel } from "@/lib/money";

export interface BatchDto {
  id: string;
  filename: string;
  sourceLabel: string;
  rowCount: number;
  createdAt: string;
}

/**
 * Undo removes exactly the rows the batch inserted. Dedup counts come from
 * stored rows, so the same statement imports cleanly afterward (PRD v2 §2.1).
 */
export function ImportHistory({ batches }: { batches: BatchDto[] }) {
  return (
    <div className="card divide-y divide-hairline overflow-hidden">
      {batches.map((b) => (
        <BatchRow key={b.id} batch={b} />
      ))}
    </div>
  );
}

function BatchRow({ batch }: { batch: BatchDto }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-4 text-[13.5px]">
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{batch.filename}</span>
        <span className="hidden text-ink-muted sm:block">{batch.sourceLabel}</span>
        <span className="money text-ink-secondary">{batch.rowCount} rows</span>
        <span className="money w-[64px] text-right text-[12px] text-ink-muted">
          {dayLabel(batch.createdAt.slice(0, 10))}
        </span>
        <button
          type="button"
          onClick={() => setConfirming((c) => !c)}
          className="text-[12.5px] font-semibold text-ink-secondary underline decoration-hairline-deep underline-offset-4 hover:text-danger"
        >
          Undo
        </button>
      </div>

      {confirming && (
        <div className="rise-in mt-2.5 rounded-[10px] bg-danger-track/50 px-3.5 py-3">
          <p className="text-[12.5px] leading-snug text-ink-secondary">
            Remove the <strong className="text-ink">{batch.rowCount} transactions</strong> this
            import added? Any categories you set on them are lost, but the statement can be
            imported again cleanly.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="btn !py-1.5 !text-[13px]"
              style={{ background: "var(--color-danger)", color: "#fff" }}
              onClick={() =>
                startTransition(async () => {
                  await undoImportBatch(batch.id);
                  setConfirming(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Removing…" : "Undo this import"}
            </button>
            <button
              type="button"
              className="btn btn-ghost !py-1.5 !text-[13px]"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
