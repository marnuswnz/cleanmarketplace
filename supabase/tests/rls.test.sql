-- RLS & invariant tests. Run via scripts/test-db.sh (vanilla Postgres + stub)
-- or `supabase db reset && psql -f` against a local Supabase.
-- Each assertion raises on failure, which aborts the run (ON_ERROR_STOP).
begin;

create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');

insert into partners (id, business_name, contact_name, email, mobile, status, insurance_expiry) values
  ('10000000-0000-0000-0000-00000000000a', 'Alpha Clean', 'Ann', 'a@example.com', '+64211111111', 'approved', '2099-01-01'),
  ('10000000-0000-0000-0000-00000000000b', 'Bravo Clean', 'Bob', 'b@example.com', '+64212222222', 'approved', '2099-01-01'),
  ('10000000-0000-0000-0000-00000000000c', 'Charlie Clean', 'Cat', 'c@example.com', '+64213333333', 'approved', '2099-01-01');

insert into partner_users (user_id, partner_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b');
insert into admin_users (user_id) values ('00000000-0000-0000-0000-0000000000ad');

insert into seats (partner_id, area_id, group_id, status, monthly_price_cents)
select p.id, a.id, g.id, 'active', 14900
  from partners p, areas a, service_groups g
 where p.business_name in ('Alpha Clean', 'Bravo Clean') and a.code = 'CEN' and g.code = 'HOME';

-- Seat cap: a third live seat in CEN/HOME must be rejected.
do $$ begin
  insert into seats (partner_id, area_id, group_id, monthly_price_cents)
  select '10000000-0000-0000-0000-00000000000c', a.id, g.id, 14900 from areas a, service_groups g where a.code = 'CEN' and g.code = 'HOME';
  raise exception 'ASSERTION FAILED: seat cap not enforced';
exception when check_violation then null;
end $$;

insert into leads (id, ref_code, suburb_id, area_id, services, customer_name, customer_mobile, customer_email, consent_at, status)
select '20000000-0000-0000-0000-000000000001', 'CC-TEST01', s.id, s.area_id, '{end_of_tenancy}', 'Cust One', '+64219999999', 'c1@example.com', now(), 'offered'
  from suburbs s where s.slug = 'riccarton';
insert into leads (id, ref_code, suburb_id, area_id, services, customer_name, customer_mobile, customer_email, consent_at, status)
select '20000000-0000-0000-0000-000000000002', 'CC-TEST02', s.id, s.area_id, '{deep_clean}', 'Cust Two', '+64218888888', 'c2@example.com', now(), 'offered'
  from suburbs s where s.slug = 'riccarton';

insert into lead_offers (lead_id, partner_id, group_id, kind, token, expires_at)
select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', g.id, 'seat', 'tok-a1', now() + interval '30 minutes' from service_groups g where g.code = 'HOME';
insert into lead_offers (lead_id, partner_id, group_id, kind, token, expires_at)
select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000b', g.id, 'seat', 'tok-b1', now() + interval '30 minutes' from service_groups g where g.code = 'HOME';
insert into lead_offers (lead_id, partner_id, group_id, kind, token, expires_at)
select '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000b', g.id, 'seat', 'tok-b2', now() + interval '30 minutes' from service_groups g where g.code = 'HOME';
insert into lead_offers (lead_id, partner_id, group_id, kind, token, expires_at)
select '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', g.id, 'seat', 'tok-a2-expired', now() - interval '1 minute' from service_groups g where g.code = 'HOME';

-- Offer cap: a third live offer for lead 1 / HOME must be rejected.
do $$ begin
  insert into lead_offers (lead_id, partner_id, group_id, kind, expires_at)
  select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000c', g.id, 'overflow', now() + interval '30 minutes'
    from service_groups g where g.code = 'HOME';
  raise exception 'ASSERTION FAILED: offer cap not enforced';
exception when check_violation then null;
end $$;

-- Same partner can't be offered the same lead/group twice.
do $$ begin
  update lead_offers set status = 'declined' where token = 'tok-b1';
  insert into lead_offers (lead_id, partner_id, group_id, kind, expires_at)
  select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000b', g.id, 'seat', now() + interval '30 minutes'
    from service_groups g where g.code = 'HOME';
  raise exception 'ASSERTION FAILED: duplicate partner offer allowed';
exception when unique_violation then null;
end $$;
update lead_offers set status = 'offered' where token = 'tok-b1';

-- ------------------------------------------------------- anon (public site)
set local role anon;
select pg_temp.check((select count(*) from areas) = 6, 'anon can read areas');
select pg_temp.check((select count(*) from suburbs) > 40, 'anon can read suburbs');
select pg_temp.check((select count(*) from pricing_rules) = 9, 'anon can read pricing');
select pg_temp.check((select count(*) from partners) = 0, 'anon cannot read partners');
select pg_temp.check((select count(*) from leads) = 0, 'anon cannot read leads');
select pg_temp.check((select count(*) from lead_offers) = 0, 'anon cannot read offers');
do $$ begin
  insert into leads (ref_code, suburb_id, area_id, services, consent_at)
  select 'X', id, area_id, '{deep_clean}', now() from suburbs limit 1;
  raise exception 'ASSERTION FAILED: anon inserted a lead';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into waitlist (email) values ('x@example.com');
  raise exception 'ASSERTION FAILED: anon inserted waitlist';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform accept_offer('tok-a1');
  raise exception 'ASSERTION FAILED: anon called accept_offer';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ------------------------------------------- partner A before accepting
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from leads) = 0, 'A cannot read leads before accepting');
select pg_temp.check((select count(*) from get_partner_offers()) = 2, 'A sees its 2 offers in inbox');
select pg_temp.check(
  (select bool_and(customer_mobile is null and customer_email is null and customer_name is null) from get_partner_offers()),
  'inbox hides customer contact before acceptance');
select pg_temp.check((select count(*) from partners) = 1, 'A sees only own partner row');
select pg_temp.check((select count(*) from seats) = 1, 'A sees only own seats');
select pg_temp.check((select count(*) from lead_offers) = 2, 'A sees only own offers');
select pg_temp.check((select count(*) from lead_offers where partner_id <> '10000000-0000-0000-0000-00000000000a') = 0, 'A sees no other partner offers');
select pg_temp.check((select count(*) from messages) = 0, 'A cannot read messages');
select pg_temp.check((select count(*) from admin_users) = 0, 'A cannot read admin list');
do $$ begin
  perform accept_offer('tok-a1');
  raise exception 'ASSERTION FAILED: partner called accept_offer directly';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update partners set status = 'approved', insurance_expiry = '2100-01-01' where id = '10000000-0000-0000-0000-00000000000a';
  raise exception 'ASSERTION FAILED: partner updated protected columns';
exception when insufficient_privilege then null;
end $$;
update partners set description = 'We clean' where id = '10000000-0000-0000-0000-00000000000a';
update partners set description = 'hijack' where id = '10000000-0000-0000-0000-00000000000b';
do $$ begin
  update lead_offers set status = 'accepted' where token = 'tok-a1';
  raise exception 'ASSERTION FAILED: partner self-accepted via update';
exception when insufficient_privilege then null;
end $$;
reset role;
select pg_temp.check((select description from partners where id = '10000000-0000-0000-0000-00000000000a') = 'We clean', 'A can edit own profile');
select pg_temp.check((select description from partners where id = '10000000-0000-0000-0000-00000000000b') is null, 'A cannot edit B profile');

-- ------------------------------------------ acceptance (service role path)
select pg_temp.check((accept_offer('tok-a1') ->> 'result') = 'accepted', 'accept works');
select pg_temp.check((accept_offer('tok-a1') ->> 'result') = 'already_accepted', 'accept is idempotent');
select pg_temp.check((decline_offer('tok-a1') ->> 'result') = 'already_accepted', 'cannot decline after accepting');
select pg_temp.check((accept_offer('tok-a2-expired') ->> 'result') = 'expired', 'expired token reports expired');
select pg_temp.check((select status from lead_offers where token = 'tok-a2-expired') = 'expired', 'expired token is marked');
select pg_temp.check((accept_offer('nope') ->> 'result') = 'not_found', 'unknown token');
select pg_temp.check((select status from leads where ref_code = 'CC-TEST01') = 'accepted', 'lead marked accepted');

-- ------------------------------------------- partner A after accepting
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from leads) = 1, 'A reads only the accepted lead');
select pg_temp.check((select customer_mobile from leads) = '+64219999999', 'A sees contact after accepting');
select pg_temp.check(
  (select customer_mobile from get_partner_offers() where ref_code = 'CC-TEST01') = '+64219999999',
  'inbox reveals contact after acceptance');
update lead_offers set outcome = 'booked', price_cents = 45000 where token = 'tok-a1';
reset role;
select pg_temp.check((select outcome from lead_offers where token = 'tok-a1') = 'booked', 'A can record outcome');

-- --------------------------------------------------------------- partner B
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from leads) = 0, 'B cannot read leads it has not accepted (incl. A''s)');
select pg_temp.check((select count(*) from seats where partner_id = '10000000-0000-0000-0000-00000000000a') = 0, 'B cannot read A seats');
select pg_temp.check((select count(*) from lead_offers where partner_id = '10000000-0000-0000-0000-00000000000a') = 0, 'B cannot read A offers');
select pg_temp.check((select count(*) from partners where id = '10000000-0000-0000-0000-00000000000a') = 0, 'B cannot read A partner row');
update lead_offers set outcome = 'booked' where token = 'tok-b1'; -- not accepted → no rows
reset role;
select pg_temp.check((select outcome from lead_offers where token = 'tok-b1') is null, 'B cannot set outcome on unaccepted offer');

-- ------------------------------------------------------------------- admin
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select pg_temp.check((select count(*) from leads) = 2, 'admin sees all leads');
select pg_temp.check((select count(*) from lead_offers) = 4, 'admin sees all offers');
select pg_temp.check((select count(*) from partners) = 3, 'admin sees all partners');
reset role;

-- ------------------------------------------------------------- misc RPCs
select pg_temp.check(rate_limit_hit('t', 60, 2) and rate_limit_hit('t', 60, 2) and not rate_limit_hit('t', 60, 2), 'rate limit');
select refresh_partner_metrics('10000000-0000-0000-0000-00000000000a');
select pg_temp.check((select accept_rate from partners where id = '10000000-0000-0000-0000-00000000000a') = 0.5, 'accept rate = 1 of 2');
select pg_temp.check((select count(*) from expire_lapsed_offers()) = 0, 'nothing left to expire');

rollback;
