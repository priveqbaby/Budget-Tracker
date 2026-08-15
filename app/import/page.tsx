import { getStore, isDemoMode } from "@/lib/data";
import { DEMO_TODAY } from "@/lib/data/demo-seed";
import { ImportWizard } from "@/components/import-wizard";
import { ImportHistory } from "@/components/import-history";
import { ManualEntry } from "@/components/manual-entry";

export default async function ImportPage() {
  const store = await getStore();
  const [sources, categories, batches, household] = await Promise.all([
    store.listSources(),
    store.listCategories(),
    store.listImportBatches(),
    store.getHousehold(),
  ]);

  const categoryOptions = categories
    .filter((c) => !c.isSurplus)
    .map((c) => ({ id: c.id, name: c.name }));
  const today = isDemoMode() ? DEMO_TODAY : new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[760px]">
      <header className="settle">
        <div className="overline">{household.name}</div>
        <h1 className="font-display mt-1 text-[34px] font-semibold leading-tight text-ink">
          Import a statement
        </h1>
        <p className="mt-2 max-w-[540px] text-[14px] text-ink-secondary">
          Export a CSV from any card or account and drop it here. Known merchants are
          categorized by your rules; new ones are asked about once, then remembered.
        </p>
      </header>

      <div className="settle settle-1 mt-6">
        <ImportWizard
          sources={sources.map((s) => ({ id: s.id, label: s.label, mapping: s.columnMapping }))}
          categories={categoryOptions}
        />
        <ManualEntry
          sources={sources.map((s) => ({ id: s.id, label: s.label }))}
          categories={categoryOptions}
          defaultDate={today}
        />
      </div>

      {batches.length > 0 && (
        <section className="settle settle-2 mt-10">
          <div className="mb-2.5 flex items-baseline justify-between px-1">
            <h2 className="overline">Recent imports</h2>
            <span className="text-[12px] text-ink-muted">undo puts the statement back</span>
          </div>
          <ImportHistory
            batches={batches.slice(0, 8).map((b) => ({
              id: b.id,
              filename: b.filename,
              sourceLabel: sources.find((s) => s.id === b.sourceId)?.label ?? "—",
              rowCount: b.rowCount,
              createdAt: b.createdAt,
            }))}
          />
          <p className="mt-2.5 px-1 text-[12px] text-ink-muted">
            Auto-categorization so far:{" "}
            {(() => {
              const auto = batches.reduce((s, b) => s + b.autoCategorizedCount, 0);
              const total = batches.reduce((s, b) => s + b.rowCount, 0);
              return total > 0 ? `${Math.round((auto / total) * 100)}% of rows matched a rule` : "—";
            })()}{" "}
            · target is 90% by month three
          </p>
        </section>
      )}
    </div>
  );
}
