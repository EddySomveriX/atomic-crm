-- Team tests (run with: npx supabase test db)
--
-- A member links their Telegram with a one-time code; a specialist hears of
-- bookings others make, move or cancel for them; only an owner sets
-- commissions; the report counts completed visits and their commission and
-- shows a specialist only themselves; a day closes once every visit is
-- marked; closings are isolated per business.

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
  ('7e7e7e7e-0000-4000-8000-000000000001', 'owner@team.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('7e7e7e7e-0000-4000-8000-000000000002', 'master@team.local', '{"first_name":"Iryna"}', 'authenticated', 'authenticated'),
  ('7e7e7e7e-0000-4000-8000-000000000003', 'other@team.local', '{}', 'authenticated', 'authenticated');

create temporary table t (key text primary key, id bigint, code text);
grant all on t to authenticated;

select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000003');
select public.create_business('Other Team', 'UA', 'services');

select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000001');
select public.create_business('Team Salon', 'UA', 'services');
insert into public.products (kind, name, duration_minutes, price) values ('service', 'Nails', 60, 50000);
insert into public.companies (name) values ('Client');

reset role;
insert into public.members (business_id, user_id, role)
  select id, '7e7e7e7e-0000-4000-8000-000000000002', 'specialist' from public.businesses where name = 'Team Salon';
update public.sales set current_business_id = (select id from public.businesses where name = 'Team Salon')
  where user_id = '7e7e7e7e-0000-4000-8000-000000000002';
insert into t (key, id) select 'master', id from public.sales where user_id = '7e7e7e7e-0000-4000-8000-000000000002';
insert into t (key, id) select 'owner', id from public.sales where user_id = '7e7e7e7e-0000-4000-8000-000000000001';

-- Linking Telegram
select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000002');
insert into t (key, code) values ('code', public.create_staff_link_code());
select matches((select code from t where key = 'code'), '^[A-Z2-9]{8}$', 'a member gets a one-time code');
select throws_ok($$ select public.link_staff_telegram(public.current_business_id(), 'AAAAAAAA', '1') $$, '42501', null,
  'only the bot links a chat');
reset role;
select is(public.link_staff_telegram((select id from public.businesses where name = 'Team Salon'), (select lower(code) from t where key = 'code'), '5550001'),
  'Iryna', 'the bot links the chat that sent the code');
select is(public.link_staff_telegram((select id from public.businesses where name = 'Team Salon'), (select code from t where key = 'code'), '5550002'),
  null, 'a code works once');

-- Messages to the specialist
select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000001');
with made as (
  insert into public.bookings (sales_id, product_id, client_id, starts_at)
  select (select id from t where key = 'master'), p.id, c.id, date_trunc('day', now()) - interval '1 day' + interval '10 hours'
  from public.products p, public.companies c where p.name = 'Nails' and c.name = 'Client'
  returning id)
insert into t (key, id) select 'yesterday', id from made;
update public.bookings set starts_at = starts_at + interval '1 hour' where id = (select id from t where key = 'yesterday');
reset role;
select is((select string_agg(kind, ',' order by id) from public.staff_notifications where booking_id = (select id from t where key = 'yesterday')),
  'new,moved', 'a specialist hears of a booking made and moved by someone else');

select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000002');
with made as (
  insert into public.bookings (sales_id, product_id, client_id, starts_at)
  select (select id from t where key = 'master'), p.id, c.id, date_trunc('day', now()) + interval '3 days 10 hours'
  from public.products p, public.companies c where p.name = 'Nails' and c.name = 'Client'
  returning id)
insert into t (key, id) select 'own', id from made;
reset role;
select is((select count(*)::int from public.staff_notifications where booking_id = (select id from t where key = 'own')), 0,
  'a specialist is not told of what they did themselves');
select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000001');
update public.bookings set status = 'cancelled' where id = (select id from t where key = 'own');
reset role;
select is((select kind from public.staff_notifications where booking_id = (select id from t where key = 'own')), 'cancelled',
  'a specialist hears of a cancellation');

-- Commission
select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000002');
select throws_ok($$ select public.set_member_commission((select id from t where key = 'master'), 40) $$, '42501', null,
  'a specialist does not set commissions');
select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000001');
select public.set_member_commission((select id from t where key = 'master'), 40);

-- Closing yesterday
select throws_ok($$ select public.close_day((now() at time zone 'Europe/Kyiv')::date - 1) $$, 'P0001', null,
  'a day with unmarked visits does not close');
update public.bookings set status = 'completed' where id = (select id from t where key = 'yesterday');
select is((select row(visits, revenue, commission)::text from public.team_report((now() at time zone 'Europe/Kyiv')::date - 1, (now() at time zone 'Europe/Kyiv')::date - 1)
  where sales_id = (select id from t where key = 'master')),
  '(1,50000,20000)', 'the report counts completed visits, revenue and commission');
select is((public.close_day((now() at time zone 'Europe/Kyiv')::date - 1) ->> 'revenue')::bigint, 50000::bigint,
  'a day closes once every visit is marked');
select throws_ok($$ select public.close_day((now() at time zone 'Europe/Kyiv')::date + 1) $$, '22023', null,
  'a day to come is not closed');

select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000002');
select is((select count(*)::int from public.team_report((now() at time zone 'Europe/Kyiv')::date - 7, (now() at time zone 'Europe/Kyiv')::date)), 1,
  'a specialist sees only themselves in the report');
select throws_ok($$ select public.close_day((now() at time zone 'Europe/Kyiv')::date - 1) $$, '42501', null,
  'a specialist does not close the day');
select is((select count(*)::int from public.staff_telegram), 1, 'the team sees who gets messages');

select pg_temp.act_as('7e7e7e7e-0000-4000-8000-000000000003');
select is((select count(*)::int from public.day_closings) + (select count(*)::int from public.staff_telegram), 0,
  'another business sees no closings and no linked chats');

select * from finish();
rollback;
