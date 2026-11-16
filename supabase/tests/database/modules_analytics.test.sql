-- Modules and analytics tests (run with: npx supabase test db)
--
-- A new business gets the modules of its kind; only owners change them and
-- only to known modules; analytics count the current business only, with
-- revenue from won deals and completed bookings.

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
  ('abababab-0000-4000-8000-000000000001', 'owner@stats.local', '{}', 'authenticated', 'authenticated'),
  ('abababab-0000-4000-8000-000000000002', 'other@stats.local', '{}', 'authenticated', 'authenticated'),
  ('abababab-0000-4000-8000-000000000003', 'manager@stats.local', '{}', 'authenticated', 'authenticated');

-- Another business with a big sale that must not be counted
select pg_temp.act_as('abababab-0000-4000-8000-000000000002');
select public.create_business('Other Shop', 'PL', 'retail');
insert into public.deals (name, stage, amount, expected_closing_date) values ('Huge', 'won', 99999900, '2030-01-15');
select is((select modules from public.businesses where name = 'Other Shop'),
  '{chats,sales,stock,pricing,marketing,documents,analytics}'::text[], 'a shop starts with chats, sales, stock, prices, marketing, documents and analytics');

select pg_temp.act_as('abababab-0000-4000-8000-000000000001');
select public.create_business('Stats Salon', 'UA', 'services');

-- Modules
select is((select modules from public.businesses where name = 'Stats Salon'),
  '{chats,booking,pricing,marketing,tasks,analytics}'::text[], 'a salon starts with chats, booking, prices, marketing, tasks and analytics');
update public.businesses set modules = '{chats,booking,sales}' where name = 'Stats Salon';
select is((select modules from public.businesses where name = 'Stats Salon'),
  '{chats,booking,sales}'::text[], 'the owner changes the modules');
select throws_ok($$ update public.businesses set modules = '{chats,payroll}' where name = 'Stats Salon' $$,
  '23514', null, 'only known modules can be turned on');

reset role;
insert into public.members (business_id, user_id, role)
  select id, 'abababab-0000-4000-8000-000000000003', 'manager' from public.businesses where name = 'Stats Salon';
select pg_temp.act_as('abababab-0000-4000-8000-000000000003');
update public.businesses set modules = '{chats}' where name = 'Stats Salon';
select is((select modules from public.businesses where name = 'Stats Salon'),
  '{chats,booking,sales}'::text[], 'a manager does not change the modules');

-- Analytics: one won deal and two bookings of a 500.00 service, one completed
select pg_temp.act_as('abababab-0000-4000-8000-000000000001');
insert into public.deals (name, stage, amount, expected_closing_date) values ('Wedding', 'won', 300000, '2030-01-10');
insert into public.deals (name, stage, amount) values ('Maybe', 'opportunity', 120000);
insert into public.products (kind, name, price, duration_minutes) values ('service', 'Haircut', 50000, 60);
insert into public.companies (name, roles) values ('Iryna', '{client}');
insert into public.bookings (sales_id, product_id, client_id, starts_at, status)
  select s.id, p.id, c.id, '2030-01-08 10:00+02', 'completed'
  from public.sales s, public.products p, public.companies c
  where s.user_id = 'abababab-0000-4000-8000-000000000001' and p.name = 'Haircut' and c.name = 'Iryna';
insert into public.bookings (sales_id, product_id, client_id, starts_at, status)
  select s.id, p.id, c.id, '2030-01-09 10:00+02', 'no_show'
  from public.sales s, public.products p, public.companies c
  where s.user_id = 'abababab-0000-4000-8000-000000000001' and p.name = 'Haircut' and c.name = 'Iryna';

create temporary table stats as
  select public.business_analytics('2030-01-01 00:00+02', '2030-02-01 00:00+02') as data;
grant select on stats to authenticated;

select is((select (data->'kpis'->>'revenue')::bigint from stats), 350000::bigint,
  'revenue is won deals plus completed bookings, of this business only');
select is((select (data->'kpis'->>'average_ticket')::bigint from stats), 175000::bigint,
  'the average ticket divides revenue by sales');
select is((select row(data->'kpis'->>'completed', data->'kpis'->>'no_show')::text from stats), '(1,1)',
  'attendance counts completed bookings and no-shows');
select is((select data->'top_clients'->0->>'name' from stats), 'Iryna', 'the client who paid most comes first');
select is((select jsonb_array_length(data->'sales_by_month') from stats), 12, 'sales are shown for twelve months');
select is((select data->'deals_by_stage'->0->>'amount' from stats), '120000', 'open deals are summed by stage');

reset role;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$ select public.business_analytics(now() - interval '1 month', now()) $$,
  '42501', null, 'someone without a business gets no analytics');

select * from finish();
rollback;
