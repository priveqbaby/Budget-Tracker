"use client";

import { useEffect, useRef, useState } from "react";
import { saveMonthNote } from "@/app/actions";
import { monthLabel } from "@/lib/money";

/** One shared note per month, autosaved. A field, not a feature (PRD v2 §2.4). */
export function MonthJournal({
  month,
  initialBody,
  initialUpdatedAt,
}: {
  month: string;
  initialBody: string;
  initialUpdatedAt: string | null;
}) {
  const [body, setBody] = useState(initialBody);
  const [savedAt, setSavedAt] = useState<string | null>(initialUpdatedAt);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // Reset when the month selector moves.
  useEffect(() => {
    setBody(initialBody);
    setSavedAt(initialUpdatedAt);
    dirty.current = false;
  }, [month, initialBody, initialUpdatedAt]);

  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      const note = await saveMonthNote(month, body);
      setSavedAt(note.updatedAt);
      setSaving(false);
      dirty.current = false;
    }, 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [body, month]);

  const stamp = savedAt
    ? new Date(savedAt).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <section className="settle settle-4 mt-8">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="overline">Notes on {monthLabel(month)}</h2>
        <span className="text-[12px] text-ink-muted">
          {saving ? "saving…" : stamp ? `saved ${stamp}` : "autosaves as you type"}
        </span>
      </div>
      <div className="card px-5 py-4">
        <textarea
          value={body}
          rows={3}
          placeholder="What happened this month? Hosted Sara's parents twice, replaced the bike tire, cancelled Crave…"
          onChange={(e) => {
            dirty.current = true;
            setBody(e.target.value);
          }}
          className="w-full resize-y bg-transparent text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-muted"
        />
      </div>
    </section>
  );
}
