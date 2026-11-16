-- Automatic messages tests (run with: npx supabase test db)
--
-- A due message is claimed once; only switched-on scenarios run, inside the
-- sending hours, for clients who agreed to the bot's terms and did not write
-- "stop"; a client with a visit booked ahead gets no "time to repeat"; the
-- log is isolated per business and only the server claims messages.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(12);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('a7a7a7a7-0000-4000-8000-000000000001', 'owner@auto.local', '{}', 'authenticated', 'authenticated'),
  ('a7a7a7a7-0000-4000-8000-000000000002', 'other@auto.local', '{}', 'authenticated', 'authenticated');

create temporary table t (key text primary key, id bigint, at timestamptz);
grant all on t to authenticated;
-- 11:00 in Kyiv today: inside the sending hours
insert into t (key, at) values ('now', date_trunc('day', now()) + interval '9 hours');

select pg_temp.act_as('a7a7a7a7-0000-4000-8000-000000000002');
select public.create_business('Other Studio', 'UA', 'services');

select pg_temp.act_as('a7a7a7a7-0000-4000-8000-000000000001');
select public.create_business('Auto Studio', 'UA', 'services');
insert into public.products (kind, name, duration_minutes, rebook_days) values ('service', 'Cut', 60, 21);
insert into public.companies (name, birth_date) values
  ('Visited', null), ('Missed', null), ('Repeat', null), ('Booked ahead', null),
  ('Gone quiet', null), ('Birthday', (select (at - interval '30 years')::date from t where key = 'now')),
  ('Said stop', (select (at - interval '25 years')::date from t where key = 'now')),
  ('No consent', (select (at - interval '20 years')::date from t where key = 'now'));

-- One Telegram chat per client; "Said stop" wrote stop, "No consent" never agreed
reset role;
insert into public.channels (business_id, kind, name)
  select id, 'telegram', 'auto_bot' from public.businesses where name = 'Auto Studio';
insert into public.conversations (business_id, channel_id, external_id, title, client_id, consent_at, automations_off_at)
  select c.business_id, ch.id, 'chat-' || c.id, c.name, c.id,
         case when c.name = 'No consent' then null else now() end,
         case when c.name = 'Said stop' then now() end
  from public.companies c
  join public.channels ch on ch.business_id = c.business_id
  where c.business_id = (select id from public.businesses where name = 'Auto Studio');

select pg_temp.act_as('a7a7a7a7-0000-4000-8000-000000000001');
insert into public.bookings (sales_id, product_id, client_id, starts_at, status)
select s.id, p.id, c.id, (select at from t where key = 'now') - v.ago, v.status
from (values
    ('Visited', interval '4 hours', 'completed'),
    ('Missed', interval '1 day', 'no_show'),
    ('Repeat', interval '22 days', 'completed'),
    ('Booked ahead', interval '22 days 2 hours', 'completed'),
    ('Gone quiet', interval '61 days', 'completed')
  ) as v(name, ago, status)
join public.companies c on c.name = v.name
cross join public.products p
join public.sales s on s.user_id = 'a7a7a7a7-0000-4000-8000-000000000001'
where p.name = 'Cut';
insert into public.bookings (sales_id, product_id, client_id, starts_at)
select s.id, p.id, c.id, now() + interval '5 days'
from public.sales s, public.products p, public.companies c
where s.user_id = 'a7a7a7a7-0000-4000-8000-000000000001' and p.name = 'Cut' and c.name = 'Booked ahead';

select throws_ok($$ select * from public.claim_due_automations() $$, '42501', null,
  'a member does not claim messages; only the server does');

-- Switch on everything but no_show
insert into public.automations (kind, enabled)
  select k, k <> 'no_show' from unnest(array['rebook', 'no_show', 'review', 'birthday', 'reactivation']) as k;

reset role;
create temporary table claimed as
  select s.kind, c.name
  from public.claim_due_automations((select at from t where key = 'now')) s
  join public.companies c on c.id = s.client_id
  where c.business_id = (select id from public.businesses where name = 'Auto Studio');

select is((select count(*)::int from claimed where kind = 'review' and name = 'Visited'), 1,
  'a review request goes out 2 hours after a completed visit');
select is((select count(*)::int from claimed where kind = 'rebook' and name = 'Repeat'), 1,
  'a "time to repeat" goes out when the days of the service have passed');
select is((select count(*)::int from claimed where kind = 'rebook' and name = 'Booked ahead'), 0,
  'a client with a visit booked ahead gets no "time to repeat"');
select is((select count(*)::int from claimed where kind = 'reactivation' and name = 'Gone quiet'), 1,
  'a client gone for 60 days is invited back');
select is((select count(*)::int from claimed where kind = 'birthday' and name = 'Birthday'), 1,
  'a birthday greeting goes out on the day');
select is((select count(*)::int from claimed where name in ('Said stop', 'No consent')), 0,
  'clients who wrote stop or never agreed get nothing');
select is((select count(*)::int from claimed where kind = 'no_show'), 0,
  'a scenario that is off sends nothing');

select is((select count(*)::int from public.claim_due_automations((select at from t where key = 'now')) s
  where s.client_id in (select id from public.companies where name = 'Visited')), 0,
  'a message is claimed once');

update public.automations set enabled = true where kind = 'no_show';
select is((select count(*)::int from public.claim_due_automations((select at + interval '12 hours' from t where key = 'now')) s
  join public.companies c on c.id = s.client_id where c.name = 'Missed'), 0,
  'nothing goes out at night');

-- The log
select pg_temp.act_as('a7a7a7a7-0000-4000-8000-000000000001');
select is((select count(*)::int from public.automation_sends), 4, 'a business sees what was sent to its clients');
select pg_temp.act_as('a7a7a7a7-0000-4000-8000-000000000002');
select is((select count(*)::int from public.automation_sends), 0, 'another business sees none of it');

select * from finish();
rollback;
