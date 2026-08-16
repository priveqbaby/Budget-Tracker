# Budget Tracker

Household budget tracker: CSV statement import → categorize → dashboard. See `docs/PRD.md` (v1.1, amended) for scope; do not reopen settled decisions.

## Stack

Next.js (App Router) + TypeScript + Tailwind v4 · Supabase (Postgres, RLS, magic-link auth) · PapaParse · Anthropic API (Haiku, server-side only) · Recharts.

## Commands

- `npm run dev` — dev server
- `npm test` — vitest (import engine fixtures)
- `npm run build` — production build

## Conventions

- Import engine in `lib/import/` is pure TypeScript, no I/O — everything testable against fixture CSVs in `lib/import/fixtures/`.
- Data access goes through `lib/data/` (interface). Demo store (in-memory, seeded) is used when Supabase env vars are absent; never import Supabase clients into the engine.
- Money is integer cents everywhere. Sign convention: spend positive, credits negative, canonicalized at import.
- Dedup is count-aware per source: hash (date, amount, normalized description), insert only count differences. Never drop same-day duplicate purchases.
- Card payments (`kind = payment`) are excluded from spend by default; refunds count as negative spend.
- Merchant rules match exactly on the normalized string; normalization lives in `lib/import/normalize.ts`.
- `monthFlow()` splits the month into spent · committed · free, and the three always sum to income. A fixed line counts once — the larger of its ticked amount and its card charge, never both. A month that is over has no committed left; unused cap room becomes free.
- `flowFrom()` is the one implementation of that arithmetic. The server calls it for the truth; `MonthBoard` calls it again on the client for every optimistic move, so a checkbox moves the tank before the round trip. Never fork the formula.

## Supabase gotcha

RLS membership checks use the `security definer` function `is_household_member(hid)` — a naive policy on `household_members` recurses into itself and Postgres rejects it. Every policy calls the function; don't inline membership subqueries.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
