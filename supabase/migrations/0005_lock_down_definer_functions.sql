-- Hardening (v5), from Supabase's database linter.
--
-- Every SECURITY DEFINER function in `public` is reachable as a REST RPC by
-- default. Two of ours have no business being called that way:
--
--   snapshot_month_caps() is a trigger function. Postgres checks EXECUTE at
--   CREATE TRIGGER time, not when the trigger fires, so revoking it from every
--   role leaves the trigger working — verified against the live database by
--   inserting as `authenticated` with no EXECUTE and confirming month_caps was
--   still snapshotted.
--
--   create_household_with_categories() already raises when auth.uid() is null,
--   so an anonymous call fails — but not exposing the endpoint at all beats
--   relying on the guard inside it.
--
-- REVOKE has to name PUBLIC. Postgres grants EXECUTE on a new function to
-- PUBLIC, and `anon`/`authenticated` inherit it from there; revoking from those
-- two roles alone changes nothing (confirmed with has_function_privilege).
revoke execute on function public.snapshot_month_caps() from public, anon, authenticated;

revoke execute on function public.create_household_with_categories(text, text, jsonb)
  from public, anon;
grant execute on function public.create_household_with_categories(text, text, jsonb)
  to authenticated;

-- is_household_member(hid) and pending_invite_role(hid) keep their PUBLIC grant
-- deliberately. Both are called from inside RLS policy expressions, which
-- Postgres evaluates with the querying role's privileges — revoking EXECUTE
-- would make every policy that calls them fail, taking the whole app down.
-- Neither leaks anything: each answers only "what is true of the caller
-- themselves", for a household UUID the caller had to know already.
