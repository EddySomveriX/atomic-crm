-- Marketing tests (run with: npx supabase test db)
--
-- Accounts are added by the server and their tokens stay hidden; owners and
-- managers plan posts, specialists only read them; stories go to Instagram
-- only; the server claims a due target once; the post status follows its
-- targets; a published post is kept unchanged; a failed post is retried;
-- a client keeps an Instagram username; everything is isolated per business.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(17);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('7c7c7c7c-0000-4000-8000-000000000001', 'owner@marketing.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('7c7c7c7c-0000-4000-8000-000000000002', 'master@marketing.local', '{"first_name":"Iryna"}', 'authenticated', 'authenticated'),
  ('7c7c7c7c-0000-4000-8000-000000000003', 'other@marketing.local', '{}', 'authenticated', 'authenticated');

create temporary table t (key text primary key, id bigint);
grant all on t to authenticated;

select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000003');
select public.create_business('Other Marketing', 'UA', 'services');
insert into public.posts (text) values ('Their draft');

select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000001');
select public.create_business('Marketing Salon', 'UA', 'services');
select ok((select 'marketing' = any(modules) from public.businesses where id = public.current_business_id()),
  'a salon starts with marketing on');

select throws_ok($$ insert into public.marketing_accounts (kind, name, external_id) values ('instagram', 'salon', '1') $$,
  '42501', null, 'members do not add accounts themselves');

reset role;
insert into public.marketing_accounts (business_id, kind, name, external_id)
  select id, 'telegram_channel', '@salon_news', '-1001' from public.businesses where name = 'Marketing Salon';
insert into public.marketing_accounts (business_id, kind, name, external_id)
  select id, 'instagram', 'salon', '17841' from public.businesses where name = 'Marketing Salon';
insert into public.marketing_secrets (account_id, access_token)
  select id, 'secret-token' from public.marketing_accounts where kind = 'instagram' and name = 'salon';
insert into t (key, id) select 'channel', id from public.marketing_accounts where name = '@salon_news';
insert into t (key, id) select 'instagram', id from public.marketing_accounts where kind = 'instagram' and name = 'salon';

select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000001');
select throws_ok($$ select access_token from public.marketing_secrets $$, '42501', null, 'tokens stay on the server');

-- Planning
with made as (insert into public.posts (text, scheduled_at, status) values ('Spring offer', now() - interval '1 minute', 'scheduled') returning id)
insert into t (key, id) select 'post', id from made;
insert into public.post_targets (post_id, account_id)
values ((select id from t where key = 'post'), (select id from t where key = 'channel')),
       ((select id from t where key = 'post'), (select id from t where key = 'instagram'));
select is((select count(*)::int from public.post_targets where post_id = (select id from t where key = 'post')), 2,
  'a post goes to the channel and Instagram');

with made as (insert into public.posts (format, text) values ('story', 'Story') returning id)
insert into t (key, id) select 'story', id from made;
select throws_ok($$ insert into public.post_targets (post_id, account_id) values ((select id from t where key = 'story'), (select id from t where key = 'channel')) $$,
  '23514', null, 'a story goes to Instagram only');
select throws_ok($$ insert into public.posts (text, status) values ('No time', 'scheduled') $$, '23514', null,
  'a scheduled post has a time');
select throws_ok($$ insert into public.post_targets (post_id, account_id, status) values ((select id from t where key = 'story'), (select id from t where key = 'instagram'), 'published') $$,
  '42501', null, 'members do not mark posts as published');

-- A specialist reads, does not plan
reset role;
insert into public.members (business_id, user_id, role)
  select id, '7c7c7c7c-0000-4000-8000-000000000002', 'specialist' from public.businesses where name = 'Marketing Salon';
update public.sales set current_business_id = (select id from public.businesses where name = 'Marketing Salon')
  where user_id = '7c7c7c7c-0000-4000-8000-000000000002';
select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000002');
select is((select count(*)::int from public.posts), 2, 'a specialist sees the posts');
select throws_ok($$ insert into public.posts (text) values ('Mine') $$, '42501', null, 'a specialist does not plan posts');

-- Publishing
select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000001');
select throws_ok($$ select * from public.claim_due_posts() $$, '42501', null, 'only the server claims posts');
reset role;
select is((select count(*)::int from public.claim_due_posts() c where c.post_id = (select id from t where key = 'post')), 2,
  'the server claims both targets of a due post');
select is((select count(*)::int from public.claim_due_posts() c where c.post_id = (select id from t where key = 'post')), 0,
  'a claimed target is not claimed again');

update public.post_targets set status = 'published', external_id = '55', published_at = now()
  where post_id = (select id from t where key = 'post') and account_id = (select id from t where key = 'channel');
update public.post_targets set status = 'failed', error = 'token expired'
  where post_id = (select id from t where key = 'post') and account_id = (select id from t where key = 'instagram');
select is((select status from public.posts where id = (select id from t where key = 'post')), 'partly',
  'a post published to one account of two is partly published');

select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000001');
select throws_ok($$ update public.posts set text = 'Changed' where id = (select id from t where key = 'post') $$, '42501', null,
  'a published post cannot be changed');
select public.retry_post((select id from t where key = 'post'));
select is((select string_agg(status, ',' order by account_id) from public.post_targets where post_id = (select id from t where key = 'post')),
  'published,pending', 'retrying publishes again only what failed');

-- Instagram of a client
insert into public.companies (name, instagram) values ('Olena', 'olena.style');
select throws_ok($$ insert into public.companies (name, instagram) values ('Bad', '@bad name') $$, '23514', null,
  'an Instagram username has no @ and no spaces');

-- Isolation
select pg_temp.act_as('7c7c7c7c-0000-4000-8000-000000000003');
select is((select string_agg(text, ',') from public.posts), 'Their draft', 'another business sees only its own posts');

select * from finish();
rollback;
