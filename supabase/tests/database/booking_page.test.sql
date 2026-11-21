-- Booking page tests (run with: npx supabase test db)
--
-- Only an owner sets up the public booking page; an address belongs to one
-- business; SMS codes and client keys stay on the server; bookings keep the
-- page as their source; pages are isolated per business.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(8);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('7a7a7a7a-0000-4000-8000-000000000001', 'owner@page.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('7a7a7a7a-0000-4000-8000-000000000002', 'master@page.local', '{"first_name":"Iryna"}', 'authenticated', 'authenticated'),
  ('7a7a7a7a-0000-4000-8000-000000000003', 'other@page.local', '{}', 'authenticated', 'authenticated');

select pg_temp.act_as('7a7a7a7a-0000-4000-8000-000000000003');
select public.create_business('Other Page', 'UA', 'services');
insert into public.booking_pages (slug, enabled) values ('other-salon', true);

select pg_temp.act_as('7a7a7a7a-0000-4000-8000-000000000001');
select public.create_business('Page Salon', 'UA', 'services');
insert into public.booking_pages (slug, enabled, about) values ('page-salon', true, 'Hello');
select is((select slug from public.booking_pages), 'page-salon', 'an owner sets up the booking page');
select throws_ok($$ update public.booking_pages set slug = 'other-salon' $$, '23505', null,
  'an address belongs to one business');
select throws_ok($$ update public.booking_pages set slug = 'Bad Slug!' $$, '23514', null,
  'an address has latin letters, digits and dashes only');
select throws_ok($$ select count(*) from public.phone_codes $$, '42501', null, 'SMS codes stay on the server');
select throws_ok($$ select count(*) from public.booking_sessions $$, '42501', null, 'client keys stay on the server');

reset role;
insert into public.members (business_id, user_id, role)
  select id, '7a7a7a7a-0000-4000-8000-000000000002', 'specialist' from public.businesses where name = 'Page Salon';
update public.sales set current_business_id = (select id from public.businesses where name = 'Page Salon')
  where user_id = '7a7a7a7a-0000-4000-8000-000000000002';
select pg_temp.act_as('7a7a7a7a-0000-4000-8000-000000000002');
update public.booking_pages set about = 'Changed by a specialist';
select is((select about from public.booking_pages), 'Hello', 'a specialist does not change the page');

reset role;
select ok((select pg_get_constraintdef(oid) like '%''page''%' from pg_constraint where conname = 'bookings_source'),
  'bookings may come from the booking page');

select pg_temp.act_as('7a7a7a7a-0000-4000-8000-000000000003');
select is((select string_agg(slug, ',') from public.booking_pages), 'other-salon', 'another business sees only its own page');

select * from finish();
rollback;
