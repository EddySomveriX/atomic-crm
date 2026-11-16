-- Cancellation and reliability tests (run with: npx supabase test db)
--
-- A cancellation records who and when and whether it was late; moves are
-- counted, last-minute ones apart; the reliability level follows the last
-- twelve months; an owner's choice wins; a business sees only its clients.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(13);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('cdcdcdcd-0000-4000-8000-000000000001', 'owner@reliable.local', '{}', 'authenticated', 'authenticated'),
  ('cdcdcdcd-0000-4000-8000-000000000002', 'other@reliable.local', '{}', 'authenticated', 'authenticated');

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-000000000002');
select public.create_business('Other Salon', 'UA', 'services');
insert into public.companies (name) values ('Someone else');

select pg_temp.act_as('cdcdcdcd-0000-4000-8000-000000000001');
select public.create_business('Reliable Salon', 'UA', 'services');
insert into public.products (kind, name, duration_minutes) values ('service', 'Nails', 60);
insert into public.companies (name) values ('Steady'), ('Flaky'), ('Newcomer');

create temporary table b (key text primary key, id bigint);
grant all on b to authenticated;

-- A booking in three days, then one starting in two hours
with made as (
  insert into public.bookings (sales_id, product_id, client_id, starts_at)
  select s.id, p.id, c.id, now() + interval '3 days'
  from public.sales s, public.products p, public.companies c
  where s.user_id = 'cdcdcdcd-0000-4000-8000-000000000001' and c.name = 'Flaky'
  returning id)
insert into b select 'early', id from made;
with made as (
  insert into public.bookings (sales_id, product_id, client_id, starts_at)
  select s.id, p.id, c.id, date_trunc('hour', now()) + interval '2 hours'
  from public.sales s, public.products p, public.companies c
  where s.user_id = 'cdcdcdcd-0000-4000-8000-000000000001' and c.name = 'Flaky'
  returning id)
insert into b select 'soon', id from made;

-- Moves
update public.bookings set starts_at = starts_at + interval '1 day' where id = (select id from b where key = 'early');
select is((select row(reschedule_count, late_reschedules)::text from public.bookings where id = (select id from b where key = 'early')),
  '(1,0)', 'a move days ahead is a reschedule, not a last-minute one');
update public.bookings set confirmed_at = now() where id = (select id from b where key = 'soon');
update public.bookings set starts_at = starts_at + interval '1 hour' where id = (select id from b where key = 'soon');
select is((select row(reschedule_count, late_reschedules)::text from public.bookings where id = (select id from b where key = 'soon')),
  '(1,1)', 'a move inside the free window is a last-minute one');
select is((select confirmed_at from public.bookings where id = (select id from b where key = 'soon')), null,
  'a moved visit needs a new confirmation');

-- Cancellations
update public.bookings set status = 'cancelled', cancelled_by = 'client' where id = (select id from b where key = 'early');
select is((select row(cancelled_by, late_cancel, cancelled_at is not null)::text from public.bookings where id = (select id from b where key = 'early')),
  '(client,f,t)', 'a client cancelling days ahead cancels on time');
update public.bookings set status = 'cancelled', cancelled_by = 'client' where id = (select id from b where key = 'soon');
select is((select late_cancel from public.bookings where id = (select id from b where key = 'soon')), true,
  'a client cancelling inside the free window cancels late');
update public.bookings set status = 'booked' where id = (select id from b where key = 'soon');
select is((select row(cancelled_by, late_cancel)::text from public.bookings where id = (select id from b where key = 'soon')),
  '(,f)', 'a booking restored after a cancellation forgets it');
update public.businesses set free_cancel_hours = 1 where name = 'Reliable Salon';
update public.bookings set status = 'cancelled', cancelled_by = 'client' where id = (select id from b where key = 'soon');
select is((select late_cancel from public.bookings where id = (select id from b where key = 'soon')), false,
  'the free window is the one the business set');

-- Levels: Steady came three times; Flaky missed twice
insert into public.bookings (sales_id, product_id, client_id, starts_at, status)
select s.id, p.id, c.id, now() - (g * interval '7 days'), 'completed'
from public.sales s, public.products p, public.companies c, generate_series(1, 3) g
where s.user_id = 'cdcdcdcd-0000-4000-8000-000000000001' and c.name = 'Steady';
insert into public.bookings (sales_id, product_id, client_id, starts_at, status)
select s.id, p.id, c.id, now() - (g * interval '9 days'), 'no_show'
from public.sales s, public.products p, public.companies c, generate_series(1, 2) g
where s.user_id = 'cdcdcdcd-0000-4000-8000-000000000001' and c.name = 'Flaky';

select is((select level from public.client_reliability r join public.companies c on c.id = r.id where c.name = 'Steady'),
  'reliable', 'three visits and no trouble: reliable');
select is((select level from public.client_reliability r join public.companies c on c.id = r.id where c.name = 'Newcomer'),
  'regular', 'a new client is regular');
select is((select row(level, no_shows)::text from public.client_reliability r join public.companies c on c.id = r.id where c.name = 'Flaky'),
  '(unreliable,2)', 'two no-shows: unreliable');
update public.bookings set starts_at = starts_at - interval '13 months'
  where status = 'no_show' and starts_at < now() - interval '15 days';
select is((select level from public.client_reliability r join public.companies c on c.id = r.id where c.name = 'Flaky'),
  'watch', 'only the last twelve months count: one no-show is to watch');
update public.companies set reliability_override = 'reliable' where name = 'Flaky';
select is((select level from public.client_reliability r join public.companies c on c.id = r.id where c.name = 'Flaky'),
  'reliable', 'the owner can mark a client as trusted');

select is((select count(*)::int from public.client_reliability where id in (select id from public.companies where name = 'Someone else')),
  0, 'a business sees the reliability of its own clients only');

select * from finish();
rollback;
