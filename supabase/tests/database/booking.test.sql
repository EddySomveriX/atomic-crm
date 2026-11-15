-- Booking tests (run with: npx supabase test db)
--
-- A service has a duration; a booking ends after it and keeps the specialist
-- busy for the pause too; two bookings of one specialist never overlap;
-- free slots follow the working hours in the business time zone; each new
-- table is isolated per business; only owners and managers set the hours.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(27);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'owner@salon.local', '{}', 'authenticated', 'authenticated'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'other@salon.local', '{}', 'authenticated', 'authenticated'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'stylist@salon.local', '{}', 'authenticated', 'authenticated'),
  ('eeeeeeee-0000-4000-8000-000000000004', 'books@salon.local', '{}', 'authenticated', 'authenticated');

create temporary table ids (key text primary key, id bigint);
grant all on ids to authenticated;
create temporary table businesses_seen (name text primary key, id uuid);
grant all on businesses_seen to authenticated;

-- Another business with its own service, hours and booking
select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000002');
insert into businesses_seen values ('Warsaw Salon', public.create_business('Warsaw Salon', 'PL'));
insert into public.products (kind, name, duration_minutes) values ('service', 'Polish cut', 30);
insert into public.working_hours (sales_id, weekday, starts_at, ends_at)
  select id, 1, '09:00', '18:00' from public.sales where user_id = 'eeeeeeee-0000-4000-8000-000000000002';
insert into public.bookings (sales_id, product_id, starts_at)
  select s.id, p.id, '2030-01-07 10:00+01' from public.sales s, public.products p
  where s.user_id = 'eeeeeeee-0000-4000-8000-000000000002';

select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000001');
select public.create_business('Kyiv Salon', 'UA');

reset role;
insert into public.members (business_id, user_id, role)
  select b.id, u.id, u.role::public.business_role
  from public.businesses b,
    (values ('eeeeeeee-0000-4000-8000-000000000003'::uuid, 'specialist'),
            ('eeeeeeee-0000-4000-8000-000000000004'::uuid, 'accountant')) as u(id, role)
  where b.name = 'Kyiv Salon';
insert into ids select 'owner', id from public.sales where user_id = 'eeeeeeee-0000-4000-8000-000000000001';
insert into ids select 'stylist', id from public.sales where user_id = 'eeeeeeee-0000-4000-8000-000000000003';
insert into ids select 'foreigner', id from public.sales where user_id = 'eeeeeeee-0000-4000-8000-000000000002';
select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000001');

-- Services
insert into public.products (kind, name, duration_minutes, buffer_minutes) values ('service', 'Haircut', 60, 15);
insert into ids select 'haircut', id from public.products where name = 'Haircut';
insert into public.products (kind, name) values ('goods', 'Shampoo');
insert into ids select 'shampoo', id from public.products where name = 'Shampoo';
select throws_ok($$ insert into public.products (kind, name, duration_minutes) values ('goods', 'Comb', 30) $$,
  '23514', null, 'only a service has a duration');
select throws_ok($$ insert into public.products (kind, name, duration_minutes) values ('service', 'Blink', 1) $$,
  '23514', null, 'a service lasts at least 5 minutes');
select is((select duration_minutes from public.products_summary where name = 'Haircut'), 60, 'the product list shows the duration');

-- Working hours (Monday 2030-01-07; Kyiv is UTC+2 in January)
insert into public.working_hours (sales_id, weekday, starts_at, ends_at)
  select id, 1, '09:00', '13:00' from ids where key = 'stylist';
select throws_ok($$ insert into public.working_hours (sales_id, weekday, starts_at, ends_at)
  select id, 1, '12:00', '15:00' from ids where key = 'stylist' $$,
  '23P01', null, 'working hours of a day do not overlap');
select throws_ok($$ insert into public.working_hours (sales_id, weekday, starts_at, ends_at)
  select id, 2, '09:00', '13:00' from ids where key = 'foreigner' $$,
  '23503', null, 'hours are only set for members of the business');
select throws_ok($$ insert into public.working_hours (sales_id, weekday, starts_at, ends_at)
  select id, 3, '18:00', '09:00' from ids where key = 'stylist' $$,
  '23514', null, 'hours end after they start');

-- Bookings
insert into public.bookings (sales_id, product_id, starts_at)
  select (select id from ids where key = 'stylist'), (select id from ids where key = 'haircut'), '2030-01-07 10:00+02';
select is((select row(ends_at, blocked_until)::text from public.bookings),
  '("2030-01-07 09:00:00+00","2030-01-07 09:15:00+00")', 'a booking ends after the service, the pause keeps the specialist busy');
select throws_ok($$ insert into public.bookings (sales_id, product_id, starts_at)
  select (select id from ids where key = 'stylist'), (select id from ids where key = 'haircut'), '2030-01-07 10:30+02' $$,
  '23P01', null, 'a specialist cannot have two bookings at once');
select throws_ok($$ insert into public.bookings (sales_id, product_id, starts_at)
  select (select id from ids where key = 'stylist'), (select id from ids where key = 'haircut'), '2030-01-07 11:10+02' $$,
  '23P01', null, 'the pause after a service is kept free');
insert into public.bookings (sales_id, product_id, starts_at)
  select (select id from ids where key = 'owner'), (select id from ids where key = 'haircut'), '2030-01-07 10:30+02';
select is((select count(*)::int from public.bookings), 2, 'another specialist can take the same time');
select throws_ok($$ insert into public.bookings (sales_id, product_id, starts_at)
  select (select id from ids where key = 'stylist'), (select id from ids where key = 'shampoo'), '2030-01-07 12:00+02' $$,
  '23514', null, 'goods cannot be booked');
select throws_ok($$ insert into public.bookings (sales_id, product_id, starts_at)
  select (select id from ids where key = 'foreigner'), (select id from ids where key = 'haircut'), '2030-01-07 12:00+02' $$,
  '23503', null, 'a booking is only with a member of the business');

update public.bookings set starts_at = '2030-01-07 11:30+02'
  where sales_id = (select id from ids where key = 'stylist');
select is((select ends_at from public.bookings where sales_id = (select id from ids where key = 'stylist')),
  '2030-01-07 12:30+02'::timestamptz, 'a moved booking keeps its length');
update public.bookings set status = 'cancelled' where sales_id = (select id from ids where key = 'stylist');
insert into public.bookings (sales_id, product_id, starts_at)
  select (select id from ids where key = 'stylist'), (select id from ids where key = 'haircut'), '2030-01-07 11:30+02';
select is((select count(*)::int from public.bookings where status = 'booked'), 2, 'a cancelled booking frees its time');

-- Free slots: 09:00-13:00 local, 60 min + 15 min pause, booked 11:30-12:45
select is((select array_agg(to_char(starts_at at time zone 'Europe/Kyiv', 'HH24:MI') order by starts_at)
  from public.free_slots((select current_business_id()), (select id from ids where key = 'haircut'), '2030-01-07', (select id from ids where key = 'stylist'))),
  '{09:00,09:15,09:30,09:45,10:00,10:15}'::text[], 'free slots fit the service and its pause between bookings and within the hours');
select is((select count(*)::int from public.free_slots((select current_business_id()), (select id from ids where key = 'haircut'), '2030-01-08')),
  0, 'no slots on a day without working hours');
select is((select count(*)::int from public.free_slots((select current_business_id()), (select id from ids where key = 'haircut'), '2020-01-06')),
  0, 'no slots in the past');

-- Isolation
select is((select count(*)::int from public.bookings), 3, 'a business sees only its own bookings');
select is((select count(*)::int from public.working_hours), 1, 'a business sees only its own working hours');
select is((select count(*)::int from public.free_slots(
    (select business_id from public.products where name = 'Polish cut'),
    (select id from public.products where name = 'Polish cut'), '2030-01-07')),
  0, 'the slots of another business are not visible');
select throws_ok($$ insert into public.bookings (business_id, sales_id, product_id, starts_at)
  select b.id, (select id from ids where key = 'stylist'), (select id from ids where key = 'haircut'), '2030-01-07 12:00+02'
  from businesses_seen b where b.name = 'Warsaw Salon' $$,
  null, null, 'a booking cannot be added to another business');

-- Roles
select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000003');
insert into public.bookings (sales_id, product_id, starts_at, status)
  select (select id from ids where key = 'stylist'), (select id from ids where key = 'haircut'), '2030-01-07 09:00+02', 'booked';
select is((select count(*)::int from public.bookings), 4, 'a specialist books clients');
select throws_ok($$ insert into public.working_hours (sales_id, weekday, starts_at, ends_at)
  select id, 2, '09:00', '13:00' from ids where key = 'stylist' $$,
  '42501', null, 'a specialist does not set the working hours');

select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000004');
select is((select count(*)::int from public.bookings), 4, 'an accountant reads the bookings');
select throws_ok($$ insert into public.bookings (sales_id, product_id, starts_at)
  select (select id from ids where key = 'owner'), (select id from ids where key = 'haircut'), '2030-01-07 12:00+02' $$,
  '42501', null, 'an accountant does not book');
update public.bookings set status = 'cancelled';
select is((select count(*)::int from public.bookings where status = 'cancelled'), 1, 'an accountant does not change bookings');

-- Deleting the business removes its booking data
select pg_temp.act_as('eeeeeeee-0000-4000-8000-000000000001');
select public.delete_business((select current_business_id()), 'Kyiv Salon');
reset role;
select is((select count(*)::int from public.bookings b join public.businesses x on x.id = b.business_id where x.name = 'Kyiv Salon'),
  0, 'deleting a business deletes its bookings');

select * from finish();
rollback;
