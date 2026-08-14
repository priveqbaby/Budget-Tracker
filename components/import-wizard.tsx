"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  commitImport, previewImport, probeCsv,
  type CommitRowDto, type ImportPreviewDto, type MappingProbe,
} from "@/app/actions";
import type { ColumnMapping, SignConvention } from "@/lib/import/types";
import { formatCents, dayLabel } from "@/lib/money";

interface SourceDto {
  id: string;
  label: string;
  mapping: ColumnMapping | null;
}
interface CategoryDto {
  id: string;
  name: string;
}

type Step =
  | { step: "pick" }
  | { step: "mapping"; probe: MappingProbe }
  | { step: "review"; preview: ImportPreviewDto }
  | { step: "done"; inserted: number; ruleCount: number };

export function ImportWizard({ sources, categories }: { sources: SourceDto[]; categories: CategoryDto[] }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [filename, setFilename] = useState("");
  const [csvText, setCsvText] = useState("");
  const [state, setState] = useState<Step>({ step: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const source = sources.find((s) => s.id === sourceId);

  const begin = (name: string, text: string) => {
    setFilename(name);
    setCsvText(text);
    setError(null);
    startTransition(async () => {
      try {
        const probe = await probeCsv(text);
        if (probe.headers.length < 2) {
          setError("That file doesn't look like a CSV with a header row.");
          return;
        }
        setState({ step: "mapping", probe });
      } catch {
        setError("Couldn't read that file. Is it a CSV export?");
      }
    });
  };

  const runPreview = (mapping: ColumnMapping) => {
    startTransition(async () => {
      try {
        const preview = await previewImport(sourceId, csvText, mapping);
        setState({ step: "review", preview });
      } catch {
        setError("Something went wrong parsing the statement.");
      }
    });
  };

  return (
    <div className="card overflow-hidden">
      <StepRail
        current={state.step === "pick" ? 0 : state.step === "mapping" ? 1 : state.step === "review" ? 2 : 3}
      />
      <div className="border-t border-hairline px-6 py-6">
        {error && (
          <div className="chip chip-over mb-4" role="alert" style={{ fontSize: 13 }}>
            {error}
          </div>
        )}

        {state.step === "pick" && (
          <PickStep
            sources={sources}
            sourceId={sourceId}
            setSourceId={setSourceId}
            pending={pending}
            onFile={begin}
          />
        )}

        {state.step === "mapping" && source && (
          <MappingStep
            probe={state.probe}
            remembered={source.mapping}
            pending={pending}
            onBack={() => setState({ step: "pick" })}
            onConfirm={runPreview}
          />
        )}

        {state.step === "review" && (
          <ReviewStep
            preview={state.preview}
            categories={categories}
            pending={pending}
            onBack={() => setState({ step: "pick" })}
            onCommit={(rows, ruleCount) =>
              startTransition(async () => {
                const result = await commitImport(sourceId, filename, rows);
                setState({ step: "done", inserted: result.inserted, ruleCount });
              })
            }
          />
        )}

        {state.step === "done" && <DoneStep inserted={state.inserted} ruleCount={state.ruleCount} />}
      </div>
    </div>
  );
}

function StepRail({ current }: { current: number }) {
  const steps = ["Statement", "Columns", "Review", "Done"];
  return (
    <ol className="flex items-center gap-1 px-6 py-3.5">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-1">
          {i > 0 && <span className="mx-2 h-px w-7 bg-hairline-deep" aria-hidden />}
          <span
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold ${
              i < current
                ? "bg-ok text-white"
                : i === current
                  ? "bg-ember text-white"
                  : "bg-sunken text-ink-muted"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span
            className={`ml-1 text-[12.5px] font-semibold ${i === current ? "text-ink" : "text-ink-muted"}`}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ step 1 */

function PickStep({
  sources, sourceId, setSourceId, pending, onFile,
}: {
  sources: SourceDto[];
  sourceId: string;
  setSourceId: (id: string) => void;
  pending: boolean;
  onFile: (name: string, text: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onFile(file.name, String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="overline mb-2.5">Whose statement is this?</div>
      <div className="flex flex-wrap gap-2.5">
        {sources.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSourceId(s.id)}
            className={`rounded-[10px] border px-4 py-2.5 text-left text-[13.5px] font-semibold transition-colors ${
              s.id === sourceId
                ? "border-ember bg-ember-wash text-ember-deep"
                : "border-hairline-deep bg-surface text-ink-secondary hover:border-ink-muted"
            }`}
          >
            {s.label}
            {s.mapping && (
              <span className="mt-0.5 block text-[11px] font-medium text-ink-muted">
                column mapping remembered
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-dashed px-6 py-10 text-center transition-colors ${
          drag ? "border-ember bg-ember-wash" : "border-hairline-deep bg-sunken/50 hover:border-ink-muted"
        }`}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden className="text-ink-muted">
          <path d="M14 18V5m0 0-4.5 4.5M14 5l4.5 4.5M5 19v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="mt-3 text-[14.5px] font-semibold text-ink">
          {pending ? "Reading…" : "Drop the CSV here, or click to choose"}
        </div>
        <div className="mt-1 text-[12.5px] text-ink-muted">
          Amex Cobalt · Wealthsimple · any statement export
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
          }}
        />
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          disabled={pending}
          className="text-[13px] font-semibold text-ember underline decoration-ember/40 underline-offset-4 hover:text-ember-deep"
          onClick={async () => {
            const res = await fetch("/sample-amex.csv");
            onFile("sample-amex.csv", await res.text());
          }}
        >
          No file handy? Try the sample Amex export
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 2 */

function MappingStep({
  probe, remembered, pending, onBack, onConfirm,
}: {
  probe: MappingProbe;
  remembered: ColumnMapping | null;
  pending: boolean;
  onBack: () => void;
  onConfirm: (mapping: ColumnMapping) => void;
}) {
  const initial: ColumnMapping = {
    date: remembered?.date && probe.headers.includes(remembered.date) ? remembered.date : (probe.guess.date ?? probe.headers[0]),
    description: remembered?.description && probe.headers.includes(remembered.description) ? remembered.description : (probe.guess.description ?? probe.headers[0]),
    amount: remembered?.amount && probe.headers.includes(remembered.amount) ? remembered.amount : (probe.guess.amount ?? probe.headers[0]),
    sign: remembered?.sign ?? "charges_positive",
  };
  const [mapping, setMapping] = useState<ColumnMapping>(initial);

  const set = (key: "date" | "description" | "amount", value: string) =>
    setMapping((m) => ({ ...m, [key]: value }));

  return (
    <div>
      <div className="overline mb-3">Confirm the columns</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["date", "description", "amount"] as const).map((key) => (
          <label key={key} className="block">
            <span className="mb-1 block text-[12px] font-semibold capitalize text-ink-secondary">{key}</span>
            <select value={mapping[key]} onChange={(e) => set(key, e.target.value)} className="field">
              {probe.headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-[12px] font-semibold text-ink-secondary">
          How does this export write spending?
        </legend>
        <div className="flex gap-2.5">
          {([
            ["charges_positive", "Charges are positive", "Amex style: 84.12 means spend"],
            ["debits_negative", "Debits are negative", "Bank style: −84.12 means spend"],
          ] as [SignConvention, string, string][]).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMapping((m) => ({ ...m, sign: value }))}
              className={`flex-1 rounded-[10px] border px-3.5 py-2.5 text-left transition-colors ${
                mapping.sign === value
                  ? "border-ember bg-ember-wash"
                  : "border-hairline-deep hover:border-ink-muted"
              }`}
            >
              <span className="block text-[13px] font-semibold text-ink">{label}</span>
              <span className="money block text-[11.5px] text-ink-muted">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {probe.sampleRows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-[10px] border border-hairline bg-sunken/50">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left">
                {probe.headers.map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2 font-semibold ${
                      [mapping.date, mapping.description, mapping.amount].includes(h)
                        ? "text-ember-deep"
                        : "text-ink-muted"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {probe.sampleRows.slice(0, 3).map((row, i) => (
                <tr key={i} className="border-t border-hairline">
                  {probe.headers.map((h) => (
                    <td key={h} className="money max-w-[220px] truncate px-3 py-1.5 text-ink-secondary">
                      {row[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 flex justify-between">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => onConfirm(mapping)}>
          {pending ? "Categorizing…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 3 */

function ReviewStep({
  preview, categories, pending, onBack, onCommit,
}: {
  preview: ImportPreviewDto;
  categories: CategoryDto[];
  pending: boolean;
  onBack: () => void;
  onCommit: (rows: CommitRowDto[], newRuleCount: number) => void;
}) {
  // Unknown merchants are decided once, not per row (PRD 6.2).
  const merchantGroups = useMemo(() => {
    const groups = new Map<string, { rows: typeof preview.rows; suggested: string | null }>();
    for (const row of preview.rows) {
      if (row.kind === "payment" || row.categorySource === "rule") continue;
      const g = groups.get(row.merchantNormalized) ?? { rows: [], suggested: row.categoryId };
      g.rows.push(row);
      groups.set(row.merchantNormalized, g);
    }
    return [...groups.entries()];
  }, [preview.rows]);

  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      merchantGroups.filter(([, g]) => g.suggested).map(([m, g]) => [m, g.suggested!]),
    ),
  );
  const [includePayments, setIncludePayments] = useState<Record<number, boolean>>({});
  const [showMatched, setShowMatched] = useState(false);

  const ruleRows = preview.rows.filter((r) => r.categorySource === "rule");
  const paymentRows = preview.rows.filter((r) => r.kind === "payment");
  const undecided = merchantGroups.filter(([m]) => !choices[m]).length;

  const commit = () => {
    const rows: CommitRowDto[] = preview.rows.map((r) => ({
      ...r,
      finalCategoryId:
        r.kind === "payment"
          ? null
          : r.categorySource === "rule"
            ? r.categoryId
            : (choices[r.merchantNormalized] ?? null),
      includeExcluded: r.kind === "payment" ? (includePayments[r.index] ?? false) : true,
    }));
    onCommit(rows, merchantGroups.filter(([m]) => choices[m]).length);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <span className="chip chip-neutral">{preview.rows.length} new transactions</span>
        {preview.skippedAsDuplicates > 0 && (
          <span className="chip chip-neutral" title="Count-aware: same-day duplicates are kept, re-uploads are not">
            {preview.skippedAsDuplicates} already imported — skipped
          </span>
        )}
        {ruleRows.length > 0 && <span className="chip chip-ok">{ruleRows.length} matched your rules</span>}
        {paymentRows.length > 0 && (
          <span className="chip chip-neutral">{paymentRows.length} card payment excluded</span>
        )}
        {preview.issues.length > 0 && (
          <span className="chip chip-watch">{preview.issues.length} rows couldn’t be read</span>
        )}
      </div>

      {merchantGroups.length > 0 && (
        <section className="mt-5">
          <div className="overline mb-2">
            New merchants — decide once, remembered as a rule
          </div>
          <div className="divide-y divide-hairline rounded-[10px] border border-hairline">
            {merchantGroups.map(([merchant, g]) => {
              const total = g.rows.reduce((s, r) => s + r.amount, 0);
              return (
                <div key={merchant} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{merchant}</div>
                    <div className="text-[12px] text-ink-muted">
                      {g.rows.length === 1
                        ? `${dayLabel(g.rows[0].date)} · `
                        : `${g.rows.length} transactions · `}
                      <span className="money">{formatCents(total)}</span>
                    </div>
                  </div>
                  {g.suggested && choices[merchant] === g.suggested && (
                    <span className="chip chip-neutral !text-[11px]">Claude’s guess</span>
                  )}
                  <select
                    value={choices[merchant] ?? ""}
                    onChange={(e) =>
                      setChoices((c) => ({ ...c, [merchant]: e.target.value }))
                    }
                    className={`field !w-[190px] ${!choices[merchant] ? "!border-warn" : ""}`}
                  >
                    <option value="">Pick a category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {ruleRows.length > 0 && (
        <section className="mt-5">
          <button
            type="button"
            onClick={() => setShowMatched((s) => !s)}
            className="text-[13px] font-semibold text-ink-secondary underline decoration-hairline-deep underline-offset-4 hover:text-ink"
          >
            {showMatched ? "Hide" : "Show"} the {ruleRows.length} rule-matched transactions
          </button>
          {showMatched && (
            <div className="rise-in mt-2 divide-y divide-hairline rounded-[10px] border border-hairline">
              {ruleRows.map((r) => (
                <div key={r.index} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                  <span className="money w-[58px] text-ink-muted">{dayLabel(r.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{r.merchantNormalized}</span>
                  <span className="text-ink-muted">
                    {categories.find((c) => c.id === r.categoryId)?.name}
                  </span>
                  <span className="money w-[80px] text-right text-ink">{formatCents(r.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {paymentRows.length > 0 && (
        <section className="mt-5">
          <div className="overline mb-2">Excluded from spend</div>
          {paymentRows.map((r) => (
            <label
              key={r.index}
              className="flex items-center gap-3 rounded-[10px] border border-hairline bg-sunken/60 px-4 py-2.5 text-[13px]"
            >
              <input
                type="checkbox"
                checked={includePayments[r.index] ?? false}
                onChange={(e) =>
                  setIncludePayments((p) => ({ ...p, [r.index]: e.target.checked }))
                }
                className="h-4 w-4 accent-[var(--color-ember)]"
              />
              <span className="min-w-0 flex-1 truncate text-ink-secondary">
                {r.description} <span className="text-ink-muted">— card payment, not spend</span>
              </span>
              <span className="money text-ink-secondary">{formatCents(r.amount)}</span>
            </label>
          ))}
        </section>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Start over</button>
        <div className="flex items-center gap-3">
          {undecided > 0 && (
            <span className="text-[12.5px] font-medium text-ink-muted">
              {undecided} merchant{undecided > 1 ? "s" : ""} uncategorized — you can decide later
            </span>
          )}
          <button type="button" className="btn btn-primary" disabled={pending} onClick={commit}>
            {pending ? "Importing…" : `Import ${preview.rows.length} transactions`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 4 */

function DoneStep({ inserted, ruleCount }: { inserted: number; ruleCount: number }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-track">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path d="m5 11.5 4 4 8-9.5" stroke="var(--color-ok)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="font-display mt-4 text-[24px] font-semibold text-ink">
        {inserted} transaction{inserted === 1 ? "" : "s"} imported
      </div>
      <p className="mt-1.5 text-[13.5px] text-ink-secondary">
        {ruleCount > 0 && <>{ruleCount} new merchant rule{ruleCount === 1 ? "" : "s"} saved — next month asks less. </>}
        The dashboard is up to date.
      </p>
      <Link href="/" className="btn btn-primary mt-5">See the dashboard</Link>
    </div>
  );
}
