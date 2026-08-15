-- Iteration 2 (PRD v2.1): surplus flag, source kinds, monthly journal,
-- bootstrap RPC learns is_surplus.

alter table categories
  add column is_surplus boolean not null default false;

alter table sources
  add column kind text not null default 'credit_card'
  check (kind in ('credit_card', 'debit', 'chequing', 'cash', 'other'));

-- One shared note per household per month. updated_at is set by the app on
-- save (no trigger — see PRD v2 review, amendment 3).
create table month_notes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  body          text not null default '' check (char_length(body) <= 10000),
  updated_at    timestamptz not null default now(),
  unique (household_id, month)
);

alter table month_notes enable row level security;
create policy month_notes_member on month_notes
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Bootstrap now seeds the surplus line too.
create or replace function create_household_with_categories(
  p_name text,
  p_display_name text,
  p_categories jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  cat jsonb;
  i int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into households (name) values (p_name) returning id into hid;
  insert into household_members (household_id, user_id, display_name, role)
  values (hid, auth.uid(), p_display_name, 'owner');
  for cat in select * from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) loop
    insert into categories (household_id, name, monthly_cap, is_fixed, is_surplus, sort_order)
    values (hid, cat->>'name', (cat->>'monthlyCap')::int,
            coalesce((cat->>'isFixed')::boolean, false),
            coalesce((cat->>'isSurplus')::boolean, false), i);
    i := i + 1;
  end loop;
  return hid;
end;
$$;
