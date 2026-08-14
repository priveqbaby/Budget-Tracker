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

## Supabase gotcha

RLS membership checks use the `security definer` function `is_household_member(hid)` — a naive policy on `household_members` recurses into itself and Postgres rejects it. Every policy calls the function; don't inline membership subqueries.
