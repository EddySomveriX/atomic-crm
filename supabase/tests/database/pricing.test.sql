-- Price list, offers, packages and certificates tests (run with: npx supabase test db)
--
-- A booking keeps its price; a specialist can have an own price; only the
-- best offer applies; promo codes count their uses; a package pays for a
-- visit and gives it back when the visit is undone; a certificate is spent
-- and given back only by records; price changes are kept in the history;
-- each table is isolated per business; only owners and managers set prices.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(22);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('efefefef-0000-4000-8000-000000000001', 'owner@price.local', '{}', 'authenticated', 'authenticated'),
  ('efefefef-0000-4000-8000-000000000002', 'other@price.local', '{}', 'authenticated', 'authenticated'),
  ('efefefef-0000-4000-8000-000000000003', 'stylist@price.local', '{}', 'authenticated', 'authenticated');

create temporary table k (key text primary key, id bigint);
grant all on k to authenticated;

select pg_temp.act_as('efefefef-0000-4000-8000-000000000002');
select public.create_business('Other Salon', 'UA', 'services');
insert into public.promotions (kind, name, percent) values ('first_visit', 'Other welcome', 50);

select pg_temp.act_as('efefefef-0000-4000-8000-000000000001');
select public.create_business('Price Salon', 'UA', 'services');
select ok((select 'pricing' = any(modules) from public.businesses where name = 'Price Salon'), 'a salon starts with the price list');
reset role;
insert into public.members (business_id, user_id, role)
  select id, 'efefefef-0000-4000-8000-000000000003', 'specialist' from public.businesses where name = 'Price Salon';
select pg_temp.act_as('efefefef-0000-4000-8000-000000000001');

insert into k select 'owner', id from public.sales where user_id = 'efefefef-0000-4000-8000-000000000001';
insert into k select 'stylist', id from public.sales where user_id = 'efefefef-0000-4000-8000-000000000003';
with p as (insert into public.products (kind, name, price, duration_minutes, category)
           values ('service', 'Haircut', 65000, 60, 'Hair') returning id)
insert into k select 'haircut', id from p;
with c as (insert into public.companies (name) values ('Iryna') returning id)
insert into k select 'iryna', id from c;

-- Specialist price and history
insert into public.specialist_prices (product_id, sales_id, price)
  select (select id from k where key = 'haircut'), (select id from k where key = 'stylist'), 80000;
select is((select price from public.price_quote((select current_business_id()), (select id from k where key = 'haircut'),
  (select id from k where key = 'stylist'), '2030-01-08 10:00+02')), 80000::bigint, 'a specialist can have an own price');
update public.products set price = 70000 where name = 'Haircut';
select is((select row(old_price, new_price)::text from public.price_history), '(65000,70000)', 'a price change is kept in the history');

-- Offers: the best one only
insert into public.promotions (kind, name, percent, weekdays, time_from, time_to)
  values ('happy_hours', 'Mornings', 15, '{2}', '09:00', '12:00');
insert into public.promotions (kind, name, percent) values ('first_visit', 'Welcome', 10);
select is((select row(price, promotion_name)::text from public.price_quote((select current_business_id()),
  (select id from k where key = 'haircut'), (select id from k where key = 'owner'), '2030-01-08 10:00+02', (select id from k where key = 'iryna'))),
  '(59500,Mornings)', 'the best offer wins: 15% happy hours over 10% first visit');
select is((select row(price, promotion_name)::text from public.price_quote((select current_business_id()),
  (select id from k where key = 'haircut'), (select id from k where key = 'owner'), '2030-01-08 14:00+02', (select id from k where key = 'iryna'))),
  '(63000,Welcome)', 'outside the happy hours the first-visit offer applies');
update public.companies set personal_discount = 20 where name = 'Iryna';
select is((select price from public.price_quote((select current_business_id()),
  (select id from k where key = 'haircut'), (select id from k where key = 'owner'), '2030-01-08 10:00+02', (select id from k where key = 'iryna'))),
  56000::bigint, 'a personal discount wins when it is bigger');
update public.companies set personal_discount = null where name = 'Iryna';

-- Bookings keep their price
insert into public.bookings (sales_id, product_id, client_id, starts_at)
  select (select id from k where key = 'owner'), (select id from k where key = 'haircut'), (select id from k where key = 'iryna'), '2030-01-08 10:00+02';
update public.products set price = 90000 where name = 'Haircut';
select is((select row(list_price, price)::text from public.bookings), '(70000,59500)', 'a booking keeps the price it was made at');

-- Promo codes
insert into public.promotions (kind, name, percent, code, max_uses) values ('promo_code', 'Spring', 30, 'SPRING-30', 1);
select throws_ok($$ insert into public.promotions (kind, name, percent, code) values ('promo_code', 'Bad', 10, 'no spaces!') $$,
  '23514', null, 'a promo code is letters, digits and dashes');
insert into public.bookings (sales_id, product_id, starts_at, promo_code)
  select (select id from k where key = 'owner'), (select id from k where key = 'haircut'), '2030-01-08 16:00+02', 'spring-30';
select is((select row(price, (select used_count from public.promotions where code = 'SPRING-30'))::text from public.bookings where promo_code is not null),
  '(63000,1)', 'a promo code lowers the price and counts its use');
select is((select promotion_name from public.price_quote((select current_business_id()), (select id from k where key = 'haircut'),
  (select id from k where key = 'owner'), '2030-01-08 18:00+02', null, 'SPRING-30')), 'Welcome', 'a promo code stops after its last use');

-- Packages
with pk as (insert into public.packages (name, product_id, visits, price) select 'Five cuts', id, 5, 300000 from public.products where name = 'Haircut' returning id)
insert into k select 'package', id from pk;
insert into public.client_packages (package_id, client_id, product_id, visits_total, visits_left, expires_at, price_paid, payment_method)
  select (select id from k where key = 'package'), (select id from k where key = 'iryna'), (select id from k where key = 'haircut'), 5, 5, '2030-12-31', 300000, 'cash';
insert into public.bookings (sales_id, product_id, client_id, starts_at)
  select (select id from k where key = 'stylist'), (select id from k where key = 'haircut'), (select id from k where key = 'iryna'), '2030-01-09 10:00+02';
select is((select row(price, client_package_id is not null)::text from public.bookings where starts_at = '2030-01-09 10:00+02'),
  '(0,t)', 'a client with a package books the service at no price');
update public.bookings set status = 'completed' where starts_at = '2030-01-09 10:00+02';
select is((select visits_left from public.client_packages), 4, 'a completed visit uses one visit of the package');
update public.bookings set status = 'booked' where starts_at = '2030-01-09 10:00+02';
select is((select visits_left from public.client_packages), 5, 'undoing the visit gives it back');
delete from public.client_packages;
select is((select count(*)::int from public.client_packages), 1, 'a sold package is never deleted');

-- Certificates
insert into public.gift_certificates (amount, expires_at, price_paid, payment_method, recipient_name)
  values (100000, '2030-12-31', 100000, 'card', 'Olha');
select matches((select code from public.gift_certificates), '^[A-Z0-9]{8}$', 'a certificate gets a code');
insert into public.certificate_uses (certificate_id, booking_id, amount)
  select g.id, b.id, 59500 from public.gift_certificates g, public.bookings b where b.starts_at = '2030-01-08 10:00+02';
select is((select balance from public.gift_certificates), 40500::bigint, 'a use spends the balance');
select throws_ok($$ insert into public.certificate_uses (certificate_id, booking_id, amount)
  select g.id, b.id, 50000 from public.gift_certificates g, public.bookings b where b.starts_at = '2030-01-08 10:00+02' $$,
  '23514', null, 'a certificate cannot be spent beyond its balance');
insert into public.certificate_uses (certificate_id, booking_id, amount, reverses_id)
  select u.certificate_id, u.booking_id, -u.amount, u.id from public.certificate_uses u;
select is((select balance from public.gift_certificates), 100000::bigint, 'a reversal gives the amount back');

-- Bulk change, roles, isolation
select is(public.change_prices((select array_agg(id) from public.products), 10), 1, 'prices change by a percent');
select is((select price from public.products where name = 'Haircut'), 99000::bigint, 'rounded to whole money');
select pg_temp.act_as('efefefef-0000-4000-8000-000000000003');
select throws_ok($$ select public.change_prices((select array_agg(id) from public.products), 10) $$, '42501', null,
  'a specialist does not change prices');
select is((select count(*)::int from public.promotions where name = 'Other welcome'), 0, 'offers of another business are not visible');

select * from finish();
rollback;
