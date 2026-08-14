-- RLS verification (PRD Phase 3/4: attempt cross-household reads/writes).
-- Run in the Supabase SQL editor (as postgres/service role) against a project
-- with the migration applied. Expected-error probes are wrapped in SAVEPOINTs
-- so one rejection doesn't abort the rest of the run. Every "expect" comment
-- states the pass condition; any cross-household row leaking is a failure.

begin;

-- --------------------------------------------------------------- setup
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local')
on conflict do nothing;

-- Bootstrap goes through the security-definer function, as in the app.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"a@test.local","role":"authenticated"}';
select create_household_with_categories(
  'Household A', 'A', '[{"name":"A food","monthlyCap":100000,"isFixed":false}]'
) as household_a \gset
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"b@test.local","role":"authenticated"}';
select create_household_with_categories(
  'Household B', 'B', '[{"name":"B food","monthlyCap":100000,"isFixed":false}]'
) as household_b \gset
reset role;

-- --------------------------------------------------------------- as user A
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"a@test.local","role":"authenticated"}';

-- expect: 1 (only Household A visible)
select count(*) as households_visible from households;

-- expect: 1 (only A's category visible)
select count(*) as categories_visible from categories;

-- expect: ERROR — cross-household category write
savepoint p1;
insert into categories (household_id, name, monthly_cap)
values (:'household_b', 'smuggled', 1);
rollback to savepoint p1;

-- expect: ERROR — joining B's household with no invite for a@test.local
savepoint p2;
insert into household_members (household_id, user_id, display_name)
values (:'household_b', '00000000-0000-0000-0000-00000000000a', 'A');
rollback to savepoint p2;

reset role;

-- --------------------------------------------------------------- invite flow
-- As B: invite a@test.local as a member.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000b","email":"b@test.local","role":"authenticated"}';
insert into invites (household_id, household_name, email, role, invited_by)
values (:'household_b', 'Household B', 'a@test.local', 'member',
        '00000000-0000-0000-0000-00000000000b');
reset role;

-- As A again:
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-00000000000a","email":"a@test.local","role":"authenticated"}';

-- expect: 1 row, with household_name visible despite not being a member yet
select household_name from invites where accepted_at is null;

-- expect: ERROR — invite grants 'member'; claiming 'owner' must be rejected
savepoint p3;
insert into household_members (household_id, user_id, display_name, role)
values (:'household_b', '00000000-0000-0000-0000-00000000000a', 'A', 'owner');
rollback to savepoint p3;

-- expect: ERROR — addressee may only touch accepted_at, not household_id/role
savepoint p4;
update invites set role = 'owner' where email = 'a@test.local';
rollback to savepoint p4;

-- expect: succeeds — role matches the invite
insert into household_members (household_id, user_id, display_name, role)
values (:'household_b', '00000000-0000-0000-0000-00000000000a', 'A', 'member');

-- expect: succeeds, 1 row — consuming the invite
update invites set accepted_at = now() where email = 'a@test.local';

-- expect: 2 (both households visible after joining)
select count(*) as households_after_join from households;

reset role;

rollback; -- leave no test data behind
