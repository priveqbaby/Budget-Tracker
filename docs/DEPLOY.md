# Going live

Hearth runs in one of two modes, decided by two environment variables:

| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Mode |
|---|---|
| absent | **Demo** — seeded fiction, in memory, nothing saved. A yellow banner says so on every page. |
| present | **Live** — Supabase Postgres, magic-link sign-in, row-level security. |

There is no third state and no partial one. If the banner is showing on a
deployed site, the variables did not reach the running process.

## 1. Create the database

1. Create a project at [supabase.com](https://supabase.com) — the free tier is
   more than enough for two people and three cards.
2. Open **SQL Editor** and run the four migrations **in order**, one at a time,
   checking each succeeds before the next:

   ```
   supabase/migrations/0001_init.sql
   supabase/migrations/0002_v2.sql
   supabase/migrations/0003_v3.sql
   supabase/migrations/0004_gross_income.sql
   ```

   0001 creates the tables, the `is_household_member(hid)` security-definer
   function and every RLS policy. The rest add columns and extend the bootstrap
   RPC. They are ordinary DDL — running them twice is not safe, so run each once.

3. Sanity check in the SQL editor. Every one of these must return `true`:

   ```sql
   select count(*) = 12 from pg_tables
     where schemaname = 'public'
       and tablename in ('households','household_members','categories','sources',
                         'transactions','fixed_payments','month_caps','month_notes',
                         'merchant_rules','import_batches','invites','income_entries');
   -- RLS on every one of them
   select bool_and(rowsecurity) from pg_tables where schemaname = 'public';
   -- the columns the income chain needs
   select count(*) = 2 from information_schema.columns
     where table_name = 'income_entries' and column_name in ('gross_amount','savings_amount');
   ```

## 2. Turn on email sign-in

In **Authentication → Providers**, enable **Email** and leave "Confirm email"
on. Hearth uses magic links only — there are no passwords to manage.

In **Authentication → URL Configuration**, set:

- **Site URL** — the deployed origin, e.g. `https://hearth.vercel.app`
- **Redirect URLs** — add `https://<your-domain>/auth/callback`

The callback path is not configurable in the app; it is derived from the
request's own host (`app/auth/actions.ts`), so it is always
`<origin>/auth/callback`.

## 3. Deploy

Push this branch and import the repo on [Vercel](https://vercel.com) (or any
Node host — nothing here is Vercel-specific). Set three environment variables:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → Project API keys → `anon` `public` |
| `ANTHROPIC_API_KEY` | *optional* — only for AI categorization of unknown merchants. Without it the import falls back to the built-in heuristics, which handle the Montréal merchants already. |

The anon key is safe in the browser **because** RLS is on. That is the whole
security model: a signed-in user can only ever read and write rows belonging to
a household they are a member of. Never put the `service_role` key in this app.

## 4. First run

1. Open the deployed URL. You should land on `/signin` with **no yellow banner**.
   If the banner is there, stop — the env vars are not reaching the app.
2. Sign in with Leon's email, click the magic link.
3. You will land on `/welcome` → **Create a household**. This seeds the plan:
   8 fixed lines, 9 variable lines and the surplus line, with the caps from
   `lib/data/default-categories.ts`. Everything is editable in Settings.
4. In **Settings → Income**, add the two recurring salary entries. This is what
   the header chain reads:

   | Field | Leon | Sara |
   |---|---|---|
   | Amount (reaches the joint account) | 3373 | 3243 |
   | Gross (before tax) | 7576 | 7083 |
   | Into savings (FHSA/TFSA/RRSP) | 1826 | 1739 |
   | Recurring | yes | yes |

   Together those give the chain: **$14,659 → $10,181 → $3,565 → $6,616**.

5. In **Settings → Cards & accounts**, add the three cards. The column mapping
   is remembered per card after the first CSV import.
6. In **Settings → Household**, invite Sara by email. She signs in with the same
   magic-link flow and lands on `/welcome` with the invite waiting.

## What is not carried over

The demo household — Leon, Sara, three months of transactions, the seeded
income — lives only in `lib/data/demo-seed.ts` and only in memory. It is never
written to Postgres and there is no code path that could write it there. A live
household starts genuinely empty: the category plan, and nothing else.

## Known gap to decide on

The seeded caps total **$6,176** and the surplus goal is **$500**, which wants
$6,676 a month. The joint account receives **$6,616**. A plain month therefore
leaves $440 — $60 short of the goal, reported honestly rather than hidden.
Close it either way in Settings:

- trim $60 of caps (Fun activities $369 → $309 does it exactly), or
- set the surplus line to $440.
