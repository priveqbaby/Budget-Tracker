"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSource, updateSource } from "@/app/actions";
import { addSource } from "@/app/auth/actions";
import type { SourceKind } from "@/lib/data/types";

export interface SourceDto {
  id: string;
  label: string;
  ownerMemberId: string;
  kind: SourceKind;
  hasMapping: boolean;
  signLabel: string | null;
  transactionCount: number;
}

export interface MemberDto {
  id: string;
  displayName: string;
}

const KINDS: Array<{ value: SourceKind; label: string }> = [
  { value: "credit_card", label: "Credit card" },
  { value: "debit", label: "Debit card" },
  { value: "chequing", label: "Chequing" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const kindLabel = (k: SourceKind) => KINDS.find((x) => x.value === k)?.label ?? k;

/** Any member can own any number of sources, of any kind (PRD v2 §2.2). */
export function SourceManager({
  sources,
  members,
}: {
  sources: SourceDto[];
  members: MemberDto[];
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [owner, setOwner] = useState(members[0]?.id ?? "");
  const [kind, setKind] = useState<SourceKind>("credit_card");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div>
      <div className="card overflow-hidden">
        {sources.map((s) => (
          <SourceRow key={s.id} source={s} members={members} />
        ))}
        {sources.length === 0 && (
          <div className="px-5 py-4 text-[13.5px] text-ink-muted">
            No sources yet. Add the first card or account below.
          </div>
        )}
      </div>

      {adding ? (
        <form
          className="card mt-3 flex flex-wrap items-end gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            startTransition(async () => {
              await addSource(label.trim(), owner, kind);
              setLabel("");
              setAdding(false);
              router.refresh();
            });
          }}
        >
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Label</span>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Leon — Wealthsimple Visa"
              className="field"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Owner</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className="field !w-[120px]">
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[11.5px] font-semibold text-ink-secondary">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SourceKind)}
              className="field !w-[140px]"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending || !label.trim()}>
            {pending ? "Adding…" : "Add"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-ghost mt-3" onClick={() => setAdding(true)}>
          + Add a card or account
        </button>
      )}
    </div>
  );
}

function SourceRow({ source, members }: { source: SourceDto; members: MemberDto[] }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [label, setLabel] = useState(source.label);
  const [owner, setOwner] = useState(source.ownerMemberId);
  const [kind, setKind] = useState<SourceKind>(source.kind);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = () =>
    startTransition(async () => {
      await updateSource(source.id, { label: label.trim(), ownerMemberId: owner, kind });
      setEditing(false);
      router.refresh();
    });

  if (editing) {
    return (
      <div className="flex flex-wrap items-end gap-2 border-b border-hairline p-3 last:border-b-0">
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="field min-w-[160px] flex-1" />
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className="field !w-[110px]">
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.displayName}</option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as SourceKind)}
          className="field !w-[130px]"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending || !label.trim()}>
          {pending ? "…" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="border-b border-hairline px-5 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-ink">{source.label}</div>
          <div className="mt-0.5 text-[12px] text-ink-muted">
            {members.find((m) => m.id === source.ownerMemberId)?.displayName ?? "—"} ·{" "}
            {kindLabel(source.kind)} · {source.transactionCount} transaction
            {source.transactionCount === 1 ? "" : "s"}
            {source.hasMapping && source.signLabel && <> · columns remembered, {source.signLabel}</>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[12.5px] font-semibold text-ink-secondary underline decoration-hairline-deep underline-offset-4 hover:text-ink"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setConfirming((c) => !c)}
          className="text-[12.5px] font-semibold text-danger underline decoration-danger/30 underline-offset-4"
        >
          Delete
        </button>
      </div>

      {confirming && (
        <div className="rise-in mt-2.5 rounded-[10px] bg-danger-track/50 px-3.5 py-3">
          <p className="text-[12.5px] leading-snug text-ink-secondary">
            Delete <strong className="text-ink">{source.label}</strong> and its{" "}
            <strong className="text-ink">{source.transactionCount} transaction
            {source.transactionCount === 1 ? "" : "s"}</strong>? Its import history goes too.
            This can’t be undone — but you can re-import the statements afterward.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="btn !py-1.5 !text-[13px]"
              style={{ background: "var(--color-danger)", color: "#fff" }}
              onClick={() =>
                startTransition(async () => {
                  await deleteSource(source.id);
                  setConfirming(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Deleting…" : "Delete source and data"}
            </button>
            <button type="button" className="btn btn-ghost !py-1.5 !text-[13px]" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
