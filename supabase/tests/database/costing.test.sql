-- Cost tests (run with: npx supabase test db)
--
-- Owners keep the cost settings, expenses and lines of their own; a
-- specialist neither sees nor changes them; cost_inputs gathers the monthly
-- expenses (equipment spread over its months), the working minutes, the
-- average commission, the last purchase costs and the pack's income taxes;
-- everything is isolated per business.

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
  ('7d7d7d7d-0000-4000-8000-000000000001', 'owner@costing.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('7d7d7d7d-0000-4000-8000-000000000002', 'master@costing.local', '{"first_name":"Iryna"}', 'authenticated', 'authenticated'),
  ('7d7d7d7d-0000-4000-8000-000000000003', 'other@costing.local', '{}', 'authenticated', 'authenticated');

create temporary table t (key text primary key, id bigint);
grant all on t to authenticated;

select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000003');
select public.create_business('Other Costing', 'UA', 'services');
insert into public.overhead_items (name, amount) values ('Their rent', 100000);

select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000001');
select public.create_business('Costing Salon', 'UA', 'services');
insert into public.products (kind, name, duration_minutes, price) values ('service', 'Cut', 60, 50000);
insert into public.products (kind, name, unit_code) values ('material', 'Dye', 'ml');
insert into t (key, id) select 'cut', id from public.products where name = 'Cut';
insert into t (key, id) select 'dye', id from public.products where name = 'Dye';
insert into t (key, id) select 'warehouse', id from public.warehouses where business_id = public.current_business_id() and is_default;

select is((public.cost_inputs() -> 'settings' ->> 'load_percent')::int, 75, 'a business starts with default settings');

insert into public.cost_settings (load_percent, tax_percent) values (80, 5);
select is((public.cost_inputs() -> 'settings' ->> 'tax_percent')::numeric, 5.00, 'an owner saves the settings');
select throws_ok($$ update public.cost_settings set load_percent = 0 $$, '23514', null, 'the load is at least 1%');

-- Rent 10 000.00 a month and a chair of 12 000.00 used for 24 months
insert into public.overhead_items (name, amount) values ('Rent', 1000000);
insert into public.overhead_items (name, kind, amount, months) values ('Chair', 'equipment', 1200000, 24);
select is((public.cost_inputs() ->> 'overhead_monthly')::bigint, 1050000::bigint, 'equipment is spread over its months');
select throws_ok($$ insert into public.overhead_items (name, kind, amount) values ('Lamp', 'equipment', 1000) $$, '23514', null,
  'equipment needs its months of use');

insert into public.product_cost_items (product_id, name, amount) values ((select id from t where key = 'cut'), 'Towel', 500);
select throws_ok($$ insert into public.product_cost_items (product_id, name, amount, percent) values ((select id from t where key = 'cut'), 'Both', 1, 1) $$,
  '23514', null, 'a line of its own is an amount or a percent');

-- Last purchase cost: 2.00 then 4.00
insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost, moved_at)
values ('receipt', (select id from t where key = 'dye'), (select id from t where key = 'warehouse'), 10, 200, now() - interval '2 days'),
       ('receipt', (select id from t where key = 'dye'), (select id from t where key = 'warehouse'), 10, 400, now() - interval '1 day');
select is((public.cost_inputs() -> 'last_costs' ->> (select id from t where key = 'dye')::text)::bigint, 400::bigint,
  'the last purchase cost is the latest receipt');

select ok(jsonb_array_length(public.cost_inputs() -> 'income_taxes') >= 1, 'the country pack offers income tax rates');

reset role;
insert into public.members (business_id, user_id, role, commission_percent)
  select id, '7d7d7d7d-0000-4000-8000-000000000002', 'specialist', 40 from public.businesses where name = 'Costing Salon';
update public.sales set current_business_id = (select id from public.businesses where name = 'Costing Salon')
  where user_id = '7d7d7d7d-0000-4000-8000-000000000002';
-- Monday 10:00-18:00: 480 minutes a week, 2080 a month
insert into public.working_hours (business_id, sales_id, weekday, starts_at, ends_at)
  select b.id, s.id, 1, '10:00', '18:00'
  from public.businesses b, public.sales s
  where b.name = 'Costing Salon' and s.user_id = '7d7d7d7d-0000-4000-8000-000000000002';

select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000001');
select is((public.cost_inputs() ->> 'working_minutes_month')::bigint, 2080::bigint, 'working minutes of a month');
select is((public.cost_inputs() ->> 'commission_percent')::numeric, 40.00, 'the average commission of the team');

-- A specialist does not see costs
select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000002');
select throws_ok($$ select public.cost_inputs() $$, '42501', null, 'a specialist does not get the cost figures');
select is((select count(*)::int from public.overhead_items), 0, 'a specialist does not see the expenses');

-- Isolation
select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000003');
select is((select string_agg(name, ',') from public.overhead_items), 'Their rent', 'another business sees only its own expenses');

select * from finish();
rollback;
