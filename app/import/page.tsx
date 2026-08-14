import { getStore } from "@/lib/data";
import { dayLabel } from "@/lib/money";
import { ImportWizard } from "@/components/import-wizard";

export default async function ImportPage() {
  const store = await getStore();
  const [sources, categories, batches, household] = await Promise.all([
    store.listSources(),
    store.listCategories(),
    store.listImportBatches(),
    store.getHousehold(),
  ]);

  return (
    <div className="mx-auto max-w-[760px]">
      <header className="settle">
        <div className="overline">{household.name}</div>
        <h1 className="font-display mt-1 text-[34px] font-semibold leading-tight text-ink">
          Import a statement
        </h1>
        <p className="mt-2 max-w-[540px] text-[14px] text-ink-secondary">
          Export a CSV from Amex or Wealthsimple and drop it here. Known merchants are
          categorized by your rules; new ones are asked about once, then remembered.
        </p>
      </header>

      <div className="settle settle-1 mt-6">
        <ImportWizard
          sources={sources.map((s) => ({
            id: s.id,
            label: s.label,
            mapping: s.columnMapping,
          }))}
          categories={categories.filter((c) => !c.isFixed).map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>

      {batches.length > 0 && (
        <section className="settle settle-2 mt-10">
          <h2 className="overline mb-2.5 px-1">Recent imports</h2>
          <div className="card divide-y divide-hairline overflow-hidden">
            {batches.slice(0, 6).map((b) => {
              const source = sources.find((s) => s.id === b.sourceId);
              return (
                <div key={b.id} className="flex items-center gap-4 px-5 py-3 text-[13.5px]">
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{b.filename}</span>
                  <span className="hidden text-ink-muted sm:block">{source?.label}</span>
                  <span className="money text-ink-secondary">{b.rowCount} rows</span>
                  <span className="money w-[74px] text-right text-[12px] text-ink-muted">
                    {dayLabel(b.createdAt.slice(0, 10))}
                  </span>
                </div>
              );
            })}
          </div>
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
