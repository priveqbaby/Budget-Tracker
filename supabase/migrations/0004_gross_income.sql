-- Gross income (v4).
--
-- `amount` has always been what actually lands in the account. The dashboard
-- now also shows what was earned before tax and payroll deductions, which is a
-- separate fact the app never held. Null means nothing was withheld — a gift or
-- a tax return is its own gross — so readers fall back to `amount`.
alter table income_entries
  add column if not exists gross_amount integer
  check (gross_amount is null or gross_amount >= amount);

comment on column income_entries.gross_amount is
  'Earned before tax and deductions, in cents. Null when gross equals amount.';

-- The rest of the chain: what was diverted into investments before anything
-- reached the household budget. `amount` is net of this, so take-home is
-- amount + savings_amount and tax is gross_amount − take-home.
alter table income_entries
  add column if not exists savings_amount integer
  check (savings_amount is null or savings_amount >= 0);

comment on column income_entries.savings_amount is
  'Into FHSA/TFSA/RRSP before the joint account, in cents. Null means none.';
