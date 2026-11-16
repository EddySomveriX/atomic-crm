-- Materials per service tests (run with: npx supabase test db)
--
-- A service lists the materials one visit uses; completing a booking writes
-- them off the default warehouse at the average cost, even when a specialist
-- marks the visit; undoing or deleting it returns them; only what is in
-- stock is written off; analytics count the cost; materials are isolated per
-- business and kept by those who manage stock.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(14);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('7f7f7f7f-0000-4000-8000-000000000001', 'owner@materials.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('7f7f7f7f-0000-4000-8000-000000000002', 'master@materials.local', '{"first_name":"Iryna"}', 'authenticated', 'authenticated'),
  ('7f7f7f7f-0000-4000-8000-000000000003', 'other@materials.local', '{}', 'authenticated', 'authenticated');

create temporary table t (key text primary key, id bigint);
grant all on t to authenticated;

select pg_temp.act_as('7f7f7f7f-0000-4000-8000-000000000003');
select public.create_business('Other Materials', 'UA', 'services');

select pg_temp.act_as('7f7f7f7f-0000-4000-8000-000000000001');
select public.create_business('Materials Salon', 'UA', 'services');
insert into public.products (kind, name, duration_minutes, price) values ('service', 'Colour', 60, 100000);
insert into public.products (kind, name, unit_code) values ('material', 'Dye', 'ml'), ('material', 'Gloves', 'pcs');
insert into public.companies (name) values ('Client');
insert into t (key, id) select 'colour', id from public.products where name = 'Colour';
insert into t (key, id) select 'dye', id from public.products where name = 'Dye';
insert into t (key, id) select 'gloves', id from public.products where name = 'Gloves';
insert into t (key, id) select 'warehouse', id from public.warehouses where business_id = public.current_business_id() and is_default;

-- Dye: 100 ml at 2.00 and 100 ml at 4.00 (average 3.00); one pair of gloves
insert into public.stock_moves (kind, product_id, to_warehouse_id, quantity, unit_cost)
values ('receipt', (select id from t where key = 'dye'), (select id from t where key = 'warehouse'), 100, 200),
       ('receipt', (select id from t where key = 'dye'), (select id from t where key = 'warehouse'), 100, 400),
       ('receipt', (select id from t where key = 'gloves'), (select id from t where key = 'warehouse'), 1, 1000);

select throws_ok($$ insert into public.service_materials (service_id, material_id, quantity)
  values ((select id from t where key = 'dye'), (select id from t where key = 'gloves'), 1) $$, '23514', null,
  'materials belong to a service');
select throws_ok($$ insert into public.service_materials (service_id, material_id, quantity)
  values ((select id from t where key = 'colour'), (select id from t where key = 'colour'), 1) $$, '23514', null,
  'a service does not use a service');
insert into public.service_materials (service_id, material_id, quantity)
values ((select id from t where key = 'colour'), (select id from t where key = 'dye'), 50),
       ((select id from t where key = 'colour'), (select id from t where key = 'gloves'), 1);
select is((select count(*)::int from public.service_materials), 2, 'an owner lists the materials of a service');

reset role;
insert into public.members (business_id, user_id, role)
  select id, '7f7f7f7f-0000-4000-8000-000000000002', 'specialist' from public.businesses where name = 'Materials Salon';
update public.sales set current_business_id = (select id from public.businesses where name = 'Materials Salon')
  where user_id = '7f7f7f7f-0000-4000-8000-000000000002';
insert into t (key, id) select 'master', id from public.sales where user_id = '7f7f7f7f-0000-4000-8000-000000000002';

-- A specialist does not change the materials but completes visits
select pg_temp.act_as('7f7f7f7f-0000-4000-8000-000000000002');
select throws_ok($$ insert into public.service_materials (service_id, material_id, quantity)
  values ((select id from t where key = 'colour'), (select id from t where key = 'dye'), 5) $$, '42501', null,
  'a specialist does not change the materials of a service');

with made as (
  insert into public.bookings (sales_id, product_id, client_id, starts_at)
  select (select id from t where key = 'master'), (select id from t where key = 'colour'), c.id,
         date_trunc('day', now()) - interval '1 day' + interval '10 hours'
  from public.companies c where c.name = 'Client'
  returning id)
insert into t (key, id) select 'first', id from made;
update public.bookings set status = 'completed' where id = (select id from t where key = 'first');

select is((select quantity from public.products_summary where id = (select id from t where key = 'dye')), 150.000::numeric,
  'completing a visit writes off its materials');
select is((select unit_cost from public.stock_moves where booking_id = (select id from t where key = 'first')
             and product_id = (select id from t where key = 'dye')), 300::bigint,
  'a write-off keeps the average cost of the moment');

-- A second visit finds no gloves left: the dye is written off, the visit completes
with made as (
  insert into public.bookings (sales_id, product_id, client_id, starts_at)
  select (select id from t where key = 'master'), (select id from t where key = 'colour'), c.id,
         date_trunc('day', now()) - interval '1 day' + interval '12 hours'
  from public.companies c where c.name = 'Client'
  returning id)
insert into t (key, id) select 'second', id from made;
update public.bookings set status = 'completed' where id = (select id from t where key = 'second');
select is((select status from public.bookings where id = (select id from t where key = 'second')), 'completed',
  'a visit completes when a material ran out');
select is((select string_agg(p.name, ',' order by p.name) from public.stock_moves m join public.products p on p.id = m.product_id
             where m.booking_id = (select id from t where key = 'second')), 'Dye',
  'only what is in stock is written off');

-- Analytics: revenue 2 x 1000.00; materials 50 x 3.00 + 10.00 and 50 x 3.00 = 310.00
select pg_temp.act_as('7f7f7f7f-0000-4000-8000-000000000001');
select is((public.business_analytics(now() - interval '7 days', now() + interval '1 day') -> 'kpis' ->> 'materials_cost')::bigint,
  31000::bigint, 'analytics count the cost of the materials of visits');
select is((public.business_analytics(now() - interval '7 days', now() + interval '1 day') -> 'top_services' -> 0 ->> 'materials_cost')::bigint,
  31000::bigint, 'analytics show the materials cost per service');

-- Undoing the visit returns the materials; completing it again writes them off again
update public.bookings set status = 'booked' where id = (select id from t where key = 'first');
select is((select quantity from public.products_summary where id = (select id from t where key = 'gloves')), 1.000::numeric,
  'undoing a visit returns its materials');
update public.bookings set status = 'completed' where id = (select id from t where key = 'first');
update public.bookings set status = 'no_show' where id = (select id from t where key = 'first');
select is((select count(*)::int from public.stock_moves where booking_id = (select id from t where key = 'first')), 8,
  'write-offs are reversed, never changed or deleted');

-- Deleting a completed visit returns its materials
delete from public.bookings where id = (select id from t where key = 'second');
select is((select quantity from public.products_summary where id = (select id from t where key = 'dye')), 200.000::numeric,
  'deleting a completed visit returns its materials');

-- Isolation
select pg_temp.act_as('7f7f7f7f-0000-4000-8000-000000000003');
select is((select count(*)::int from public.service_materials), 0, 'another business does not see the materials');

select * from finish();
rollback;
