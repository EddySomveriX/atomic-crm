-- Subscription tests (run with: npx supabase test db)
--
-- A new business is on a trial with everything open; an unpaid business is
-- read-only for its people (reading and export still work); a plan limits
-- features and members; only platform admins change plans; the export holds
-- the current business only.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(16);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('5e5e5e5e-0000-4000-8000-000000000001', 'owner@plan.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('5e5e5e5e-0000-4000-8000-000000000002', 'other@plan.local', '{}', 'authenticated', 'authenticated'),
  ('5e5e5e5e-0000-4000-8000-000000000003', 'admin@plan.local', '{}', 'authenticated', 'authenticated'),
  ('5e5e5e5e-0000-4000-8000-000000000004', 'staff@plan.local', '{}', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('5e5e5e5e-0000-4000-8000-000000000003');

select pg_temp.act_as('5e5e5e5e-0000-4000-8000-000000000002');
select public.create_business('Other Plan', 'UA', 'services');
insert into public.contacts (first_name, last_name) values ('Hidden', 'Client');

select pg_temp.act_as('5e5e5e5e-0000-4000-8000-000000000001');
select public.create_business('Plan Salon', 'UA', 'services');
select set_config('test.salon', public.current_business_id()::text, true);

select is(public.current_subscription()->>'status', 'trial', 'a new business starts on a trial');
select lives_ok($$ insert into public.contacts (first_name, last_name) values ('Trial', 'Client') $$,
  'a business on a trial adds data');
select is((select count(*)::int from public.business_subscriptions), 1,
  'a business sees its own subscription only');

update public.business_subscriptions set paid_until = '2099-01-01', plan_code = 'pro';
select is(public.current_subscription()->>'status', 'trial', 'an owner does not pay for the plan by editing the row');
select throws_ok($$ select public.set_business_subscription(public.current_business_id(), 'pro', '2099-01-01') $$,
  '42501', null, 'an owner does not turn a plan on');

-- The trial ends without payment
reset role;
update public.business_subscriptions set trial_ends_at = now() - interval '1 day'
  where business_id = (select id from public.businesses where name = 'Plan Salon');
select pg_temp.act_as('5e5e5e5e-0000-4000-8000-000000000001');

select is(public.current_subscription()->>'status', 'read_only', 'an unpaid business turns read-only');
select throws_ok($$ insert into public.contacts (first_name, last_name) values ('New', 'Client') $$,
  'P0001', 'crm.subscription.errors.read_only', 'a read-only business adds nothing');
select throws_ok($$ update public.contacts set first_name = 'Changed' $$,
  'P0001', 'crm.subscription.errors.read_only', 'a read-only business changes nothing');
select is((select count(*)::int from public.contacts), 1, 'a read-only business still reads its data');
select is(jsonb_array_length(public.export_business_data()->'contacts'), 1,
  'a read-only business exports its own data only');

-- The platform admin turns the start plan on
select pg_temp.act_as('5e5e5e5e-0000-4000-8000-000000000003');
select lives_ok(
  $$ select public.set_business_subscription(current_setting('test.salon')::uuid, 'start', current_date + 30, 29900, 'card') $$,
  'a platform admin turns a plan on');
select is((select count(*)::int from public.subscription_events), 0,
  'a person outside the business does not read its payments');

select pg_temp.act_as('5e5e5e5e-0000-4000-8000-000000000001');
select is(public.current_subscription()->>'status', 'active', 'a paid business is active again');
select lives_ok($$ insert into public.contacts (first_name, last_name) values ('Paid', 'Client') $$,
  'a paid business adds data');
select throws_ok($$ insert into public.channels (kind, name) values ('telegram', 'Bot') $$,
  'P0001', 'crm.subscription.errors.feature', 'the start plan has no messengers');

reset role;
select throws_ok(
  $$ insert into public.members (business_id, user_id, role)
     values ((select id from public.businesses where name = 'Plan Salon'), '5e5e5e5e-0000-4000-8000-000000000004', 'manager') $$,
  'P0001', 'crm.subscription.errors.member_limit', 'the start plan holds one person');

select * from finish();
rollback;
