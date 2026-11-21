-- Rate limit tests (run with: npx supabase test db)
--
-- The counter lets a key through up to its limit in a window and stops it
-- after; signed-in users and visitors can neither call it nor read it.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(5);

set local role service_role;
select ok(public.take_rate_limit('test:key', 2, 60), 'the first hit goes through');
select ok(public.take_rate_limit('test:key', 2, 60), 'hits up to the limit go through');
select ok(not public.take_rate_limit('test:key', 2, 60), 'a hit over the limit is stopped');
reset role;

set local role authenticated;
select throws_ok($$ select public.take_rate_limit('test:other', 5, 60) $$, '42501', null,
  'a signed-in user does not touch the counters');
select throws_ok($$ select count(*) from public.rate_limits $$, '42501', null,
  'a signed-in user does not read the counters');
reset role;

select * from finish();
rollback;
