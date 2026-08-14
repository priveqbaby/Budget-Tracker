-- RLS verification (PRD Phase 3/4: attempt cross-household reads).
-- Run in the Supabase SQL editor against a project with the migration applied.
-- Each block simulates a JWT the way PostgREST does; every "expect" comment
-- states the pass condition. Any row leaking across households is a failure.

begin;

-- Two users, two households.
select gen_random_uuid() as user_a \gset
-- (If \gset is unavailable, substitute literal UUIDs for :'user_a' / :'user_b'.)

-- Setup as service role (bypasses RLS):
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local')
on conflict do nothing;

insert into households (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Household A'),
  ('10000000-0000-0000-0000-000000000002', 'Household B');

insert into household_members (household_id, user_id, display_name, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'A', 'owner'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'B', 'owner');

insert into categories (id, household_id, name, monthly_cap) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A food', 100000),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'B food', 100000);

-- ---- As user A ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"a@test.local","role":"authenticated"}';

-- expect: 1 row (only Household A)
select count(*) as households_visible from households;

-- expect: 1 row (only A's category)
select count(*) as categories_visible from categories;

-- expect: ERROR (new row violates row-level security) — cross-household write
insert into categories (household_id, name, monthly_cap)
values ('10000000-0000-0000-0000-000000000002', 'smuggled', 1);

-- expect: ERROR — cannot join a household with no invite for a@test.local
insert into household_members (household_id, user_id, display_name)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'A');

-- expect: 0 rows updated — cannot mark B's invites accepted
update invites set accepted_at = now()
where household_id = '10000000-0000-0000-0000-000000000002';

reset role;

-- ---- Invite flow ----------------------------------------------------------
-- As B: invite a@test.local, then as A: joining B's household must now succeed.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"b@test.local","role":"authenticated"}';
insert into invites (household_id, email, invited_by)
values ('10000000-0000-0000-0000-000000000002', 'a@test.local',
        '00000000-0000-0000-0000-00000000000b');
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"a@test.local","role":"authenticated"}';
-- expect: succeeds (pending invite exists)
insert into household_members (household_id, user_id, display_name)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'A');
-- expect: 2 rows now visible
select count(*) as households_after_join from households;
reset role;

rollback; -- leave no test data behind
