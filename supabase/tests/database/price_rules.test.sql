-- Price rules tests (run with: npx supabase test db)
--
-- An owner sets the price rules and confirmed calculated prices; a wrong
-- rule is refused; a specialist sees and changes nothing; rules and prices
-- stay inside their business.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(10);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('7c7c7c7c-0000-4000-8000-000000000001', 'owner@prices.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('7c7c7c7c-0000-4000-8000-000000000002', 'master@prices.local', '{"first_name":"Iryna"}', 'authenticated', 'authenticated'),
  ('7c7c7c7c-0000-4000-8000-000000000003', 'other@prices.local', '{}', 'authenticated', 'authenticated');

select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000003');
select public.create_business('Other Prices', 'UA', 'services');
insert into public.products (kind, name, duration_minutes, price) values ('service', 'Other cut', 60, 30000);
insert into public.product_price_rules (product_id, method, value)
  select id, 'markup', 40 from public.products where name = 'Other cut';

select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000001');
select public.create_business('Price Salon', 'UA', 'services');
insert into public.products (kind, name, duration_minutes, price) values ('service', 'Cut', 60, 50000);

insert into public.cost_settings (service_price_method, service_price_value, price_rounding)
  values ('markup', 60, '10');
select is((select service_price_method from public.cost_settings), 'markup', 'an owner sets the rule for services');
select throws_ok($$ update public.cost_settings set service_price_method = 'margin', service_price_value = 120 $$,
  '23514', null, 'a margin stays below 95 percent');
select throws_ok($$ update public.cost_settings set price_rounding = '7' $$,
  '23514', null, 'only known roundings');

insert into public.product_price_rules (product_id, method, value, rounding)
  select id, 'profit', 20000, '50' from public.products where name = 'Cut';
select is((select method from public.product_price_rules), 'profit', 'a service has a rule of its own');
select throws_ok($$ update public.product_price_rules set method = 'profit', value = null $$,
  '23514', null, 'a rule has both a method and a value');

select is(
  public.apply_calculated_prices(jsonb_build_array(
    jsonb_build_object('id', (select id from public.products where name = 'Cut'), 'price', 64000))),
  1, 'an owner sets a confirmed calculated price');
select is((select price from public.products where name = 'Cut'), 64000::bigint, 'the price list shows it');
select throws_ok(
  format('select public.apply_calculated_prices(%L::jsonb)',
         jsonb_build_array(jsonb_build_object('id', (select id from public.products where name = 'Cut'), 'price', 0))),
  '22023', null, 'a price is above zero');

reset role;
insert into public.members (business_id, user_id, role)
  select id, '7c7c7c7c-0000-4000-8000-000000000002', 'specialist' from public.businesses where name = 'Price Salon';
update public.sales set current_business_id = (select id from public.businesses where name = 'Price Salon')
  where user_id = '7c7c7c7c-0000-4000-8000-000000000002';
select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.apply_calculated_prices('[{"id": 1, "price": 100}]'::jsonb) $$,
  '42501', null, 'a specialist does not set prices');

select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000003');
select is((select string_agg(value::text, ',') from public.product_price_rules), '40.00',
  'another business sees only its own rules');

select * from finish();
rollback;
