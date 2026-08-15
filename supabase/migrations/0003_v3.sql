-- Iteration 3 (PRD v3): income becomes recorded, surplus becomes derived.

alter table households
  add column savings_target integer not null default 0;   -- cents per month

-- Income is never imported from CSV — statement imports are spend. A recurring
-- entry (the contribution floor, a salary) applies to every month and has
-- month = null; a one-off (tax return, trading win) belongs to one month.
create table income_entries (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  member_id     uuid references auth.users(id),
  label         text not null,
  kind          text not null default 'other'
                check (kind in ('contribution','salary','trading','side_hustle',
                                'tax_return','gift','other')),
  amount        integer not null,                          -- cents, positive
  is_recurring  boolean not null default false,
  month         text check (month is null or month ~ '^\d{4}-\d{2}$'),
  created_at    timestamptz not null default now(),
  -- A recurring entry has no month; a one-off must have one.
  constraint income_month_shape check (
    (is_recurring and month is null) or (not is_recurring and month is not null)
  )
);

create index income_entries_month_idx on income_entries (household_id, month);

alter table income_entries enable row level security;
create policy income_entries_member on income_entries
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
