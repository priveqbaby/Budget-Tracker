-- Budget Tracker: initial schema (PRD v1.1, amended)
-- Money is integer cents. Sign convention: spend positive, credits negative.

create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table household_members (
  household_id  uuid not null references households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  role          text not null default 'member' check (role in ('owner', 'member')),
  primary key (household_id, user_id)
);

-- Bridges "invited by email" and "has an auth user": consumed on first sign-in.
create table invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  email         text not null,
  role          text not null default 'member' check (role in ('owner', 'member')),
  invited_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  unique (household_id, email)
);

create table categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  monthly_cap   integer not null default 0,          -- cents
  is_fixed      boolean not null default false,
  sort_order    integer not null default 0
);

-- Cap snapshots so cap edits never rewrite history. Month is 'YYYY-MM'.
create table month_caps (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  cap           integer not null,                    -- cents
  unique (category_id, month)
);

create table sources (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  owner_member_id  uuid not null references auth.users(id),
  label            text not null,
  -- Remembered per source: {date, description, amount, sign: 'charges_positive' | 'debits_negative'}
  column_mapping   jsonb
);

create table import_batches (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references households(id) on delete cascade,
  source_id              uuid not null references sources(id) on delete cascade,
  filename               text not null,
  row_count              integer not null default 0,
  auto_categorized_count integer not null default 0,  -- success-metric instrumentation
  manual_count           integer not null default 0,
  created_at             timestamptz not null default now()
);

create table transactions (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  source_id           uuid not null references sources(id) on delete cascade,
  owner_member_id     uuid not null references auth.users(id),
  date                date not null,                 -- transaction date, calendar-month buckets
  description         text not null,
  merchant_normalized text not null,
  amount              integer not null,              -- cents, spend positive
  currency            text not null default 'CAD',
  kind                text not null default 'spend' check (kind in ('spend', 'refund', 'payment')),
  is_excluded         boolean not null default false, -- payments excluded by default, manual override
  category_id         uuid references categories(id) on delete set null,
  is_confirmed        boolean not null default false,
  dedup_hash          text not null,                 -- (date, amount, merchant_normalized); dedup is count-aware
  import_batch_id     uuid references import_batches(id) on delete set null
);

create index transactions_month_idx on transactions (household_id, date);
create index transactions_dedup_idx on transactions (source_id, dedup_hash);

create table merchant_rules (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  merchant_normalized text not null,                 -- exact match on normalized string
  category_id         uuid not null references categories(id) on delete cascade,
  hit_count           integer not null default 0,
  unique (household_id, merchant_normalized)
);

create table fixed_payments (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  is_paid       boolean not null default false,
  amount        integer not null,                    -- cents
  unique (category_id, month)
);

-- ---------------------------------------------------------------------------
-- Row-level security.
-- Membership checks go through a SECURITY DEFINER function so the policy on
-- household_members does not recurse into itself (the standard Supabase
-- multi-tenant pitfall).
-- ---------------------------------------------------------------------------

create or replace function is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- Also security definer: called from the household_members insert policy,
-- where a plain subquery would either recurse or be filtered by RLS itself.
create or replace function household_has_members(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from household_members where household_id = hid);
$$;

create or replace function has_pending_invite(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from invites
    where household_id = hid
      and accepted_at is null
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table households        enable row level security;
alter table household_members enable row level security;
alter table invites           enable row level security;
alter table categories        enable row level security;
alter table month_caps        enable row level security;
alter table sources           enable row level security;
alter table import_batches    enable row level security;
alter table transactions      enable row level security;
alter table merchant_rules    enable row level security;
alter table fixed_payments    enable row level security;

create policy households_member_all on households
  for all using (is_household_member(id))
  with check (is_household_member(id));

-- Anyone authenticated may create a household; membership row is written by
-- the same transaction (see app code).
create policy households_insert on households
  for insert with check (auth.uid() is not null);

create policy members_select on household_members
  for select using (is_household_member(household_id));
-- Self-insert is allowed only when bootstrapping a household you just created
-- (no members yet) or accepting a pending invite addressed to your email —
-- never into an arbitrary household.
create policy members_insert_self on household_members
  for insert with check (
    user_id = auth.uid()
    and (not household_has_members(household_id) or has_pending_invite(household_id))
  );

-- Invitees can see (and accept) invites addressed to their email.
create policy invites_member on invites
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
create policy invites_addressee_select on invites
  for select using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy invites_addressee_accept on invites
  for update using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy categories_member on categories
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
create policy month_caps_member on month_caps
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
create policy sources_member on sources
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
create policy import_batches_member on import_batches
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
create policy transactions_member on transactions
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
create policy merchant_rules_member on merchant_rules
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
create policy fixed_payments_member on fixed_payments
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Snapshot caps the first time a month receives a transaction.
create or replace function snapshot_month_caps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_month text := to_char(new.date, 'YYYY-MM');
begin
  insert into month_caps (household_id, category_id, month, cap)
  select c.household_id, c.id, tx_month, c.monthly_cap
  from categories c
  where c.household_id = new.household_id
  on conflict (category_id, month) do nothing;
  return new;
end;
$$;

create trigger transactions_snapshot_caps
  after insert on transactions
  for each row execute function snapshot_month_caps();
