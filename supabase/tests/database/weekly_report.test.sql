-- Weekly report tests (run with: npx supabase test db)
--
-- Only an owner sets up the weekly report; settings are isolated per
-- business; analytics of another business stay closed to signed-in users.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(7);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('7b7b7b7b-0000-4000-8000-000000000001', 'owner@report.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('7b7b7b7b-0000-4000-8000-000000000002', 'master@report.local', '{"first_name":"Iryna"}', 'authenticated', 'authenticated'),
  ('7b7b7b7b-0000-4000-8000-000000000003', 'other@report.local', '{}', 'authenticated', 'authenticated');

select pg_temp.act_as('7b7b7b7b-0000-4000-8000-000000000003');
select public.create_business('Other Report', 'UA', 'services');
insert into public.weekly_reports (enabled, weekday, hour) values (true, 7, 20);

select pg_temp.act_as('7b7b7b7b-0000-4000-8000-000000000001');
select public.create_business('Report Salon', 'UA', 'services');
insert into public.weekly_reports (enabled, weekday, hour) values (true, 1, 9);
select is((select hour from public.weekly_reports), 9::smallint, 'an owner sets up the weekly report');
select throws_ok($$ update public.weekly_reports set weekday = 8 $$, '23514', null,
  'the day is Monday to Sunday');
select throws_ok($$ update public.weekly_reports set hour = 24 $$, '23514', null,
  'the hour is 0 to 23');
select throws_ok(
  format('select public.business_analytics_for(%L, now() - interval ''7 days'', now())',
         (select id from public.businesses where name = 'Other Report')),
  '42501', null, 'a signed-in user does not read analytics of another business');
select lives_ok($$ select public.business_analytics(now() - interval '7 days', now()) $$,
  'the analytics page still reads its own business');

reset role;
insert into public.members (business_id, user_id, role)
  select id, '7b7b7b7b-0000-4000-8000-000000000002', 'specialist' from public.businesses where name = 'Report Salon';
update public.sales set current_business_id = (select id from public.businesses where name = 'Report Salon')
  where user_id = '7b7b7b7b-0000-4000-8000-000000000002';
select pg_temp.act_as('7b7b7b7b-0000-4000-8000-000000000002');
update public.weekly_reports set hour = 22;
select is((select hour from public.weekly_reports), 9::smallint, 'a specialist does not change the report');

select pg_temp.act_as('7b7b7b7b-0000-4000-8000-000000000003');
select is((select hour from public.weekly_reports), 20::smallint, 'another business sees only its own settings');

select * from finish();
rollback;
