import { getStore, isDemoMode } from "@/lib/data";
import { DEMO_TODAY } from "@/lib/data/demo-seed";
import { formatCentsWhole } from "@/lib/money";
import { CapEditor } from "@/components/cap-editor";
import { InviteForm } from "@/components/invite-form";
import { SourceManager } from "@/components/source-manager";
import { IncomeManager } from "@/components/income-manager";

export default async function SettingsPage() {
  const store = await getStore();
  // Counts make the delete confirmation state its blast radius (PRD v2 §2.1).
  const [household, categories, sources, invites, txnCountBySource] = await Promise.all([
    store.getHousehold(),
    store.listCategories(),
    store.listSources(),
    store.listInvites(),
    store.getSourceTransactionCounts(),
  ]);
  const incomeEntries = await store.listIncomeEntries();
  const thisMonth = (isDemoMode() ? DEMO_TODAY : new Date().toISOString().slice(0, 10)).slice(0, 7);

  const variable = categories.filter((c) => !c.isFixed && !c.isSurplus);
  const fixed = categories.filter((c) => c.isFixed);
  const surplus = categories.filter((c) => c.isSurplus);
  const totalCap = categories.reduce((s, c) => s + c.monthlyCap, 0);

  return (
    <div className="mx-auto max-w-[760px]">
      <header className="settle">
        <div className="overline">{household.name}</div>
        <h1 className="font-display mt-1 text-[34px] font-semibold leading-tight text-ink">
          Settings
        </h1>
        <p className="mt-2 text-[14px] text-ink-secondary">
          The plan: {formatCentsWhole(totalCap)} a month across {categories.length} lines.
          Cap changes apply from this month forward — history keeps the caps it was measured
          against.
        </p>
      </header>

      <section className="settle settle-1 mt-7">
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="overline">Income</h2>
          <span className="text-[12px] text-ink-muted">surplus follows what lands here</span>
        </div>
        <IncomeManager
          entries={incomeEntries}
          members={household.members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          savingsTarget={household.savingsTarget}
          defaultMonth={thisMonth}
        />
      </section>

      <section className="settle settle-2 mt-9">
        <h2 className="overline mb-2.5 px-1">Budget lines</h2>
        <div className="card overflow-hidden">
          <div className="border-b border-hairline bg-sunken/60 px-5 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Fixed — checklist, not matched to transactions
          </div>
          {fixed.map((c) => (
            <CapEditor key={c.id} id={c.id} name={c.name} capCents={c.monthlyCap} />
          ))}
          <div className="border-y border-hairline bg-sunken/60 px-5 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
            Variable — tracked against statement imports
          </div>
          {variable.map((c) => (
            <CapEditor key={c.id} id={c.id} name={c.name} capCents={c.monthlyCap} />
          ))}
          {surplus.length > 0 && (
            <>
              <div className="border-y border-hairline bg-sunken/60 px-5 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
                Surplus — never receives transactions
              </div>
              {surplus.map((c) => (
                <CapEditor key={c.id} id={c.id} name={c.name} capCents={c.monthlyCap} />
              ))}
            </>
          )}
        </div>
        <p className="mt-2.5 px-1 text-[12px] text-ink-muted">
          These are the Sankey lines. Renaming or recapping a line applies from this month
          forward; past months keep the caps they were measured against.
        </p>
      </section>

      <div className="mt-9 grid gap-8 md:grid-cols-2">
        <section className="settle settle-2">
          <h2 className="overline mb-2.5 px-1">Household</h2>
          <div className="card divide-y divide-hairline overflow-hidden">
            {household.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white"
                  style={{ background: m.id === "leon" ? "#a85a32" : "#56698f" }}
                >
                  {m.displayName[0]}
                </span>
                <span className="flex-1 text-[14px] font-medium text-ink">{m.displayName}</span>
                <span className="text-[12px] text-ink-muted">{m.role}</span>
              </div>
            ))}
            {invites
              .filter((i) => !i.acceptedAt)
              .map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-hairline-deep text-[12px] font-bold text-ink-muted">
                    ?
                  </span>
                  <span className="flex-1 truncate text-[14px] text-ink-secondary">{i.email}</span>
                  <span className="chip chip-neutral !text-[11px]">invited</span>
                </div>
              ))}
          </div>
          <div className="mt-3">
            <InviteForm />
          </div>
        </section>

        <section className="settle settle-3">
          <h2 className="overline mb-2.5 px-1">Cards &amp; accounts</h2>
          <SourceManager
            members={household.members.map((m) => ({ id: m.id, displayName: m.displayName }))}
            sources={sources.map((s) => ({
              id: s.id,
              label: s.label,
              ownerMemberId: s.ownerMemberId,
              kind: s.kind,
              hasMapping: s.columnMapping !== null,
              signLabel: s.columnMapping
                ? s.columnMapping.sign === "charges_positive"
                  ? "charges positive"
                  : "debits negative"
                : null,
              transactionCount: txnCountBySource.get(s.id) ?? 0,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
