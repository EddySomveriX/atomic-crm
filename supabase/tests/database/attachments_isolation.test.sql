-- Attachments isolation tests (run with: npx supabase test db)
--
-- Files of the attachments bucket live in the folder of their business: a
-- member lists, adds and removes files of their own business only, and
-- files made before the rule (top level) are listed and removed by nobody.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(7);

update public.businesses set is_demo = false;
-- The Storage API deletes rows directly; let this test do the same
set local storage.allow_delete_query = 'true';

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('7d7d7d7d-0000-4000-8000-000000000001', 'one@files.local', '{}', 'authenticated', 'authenticated'),
  ('7d7d7d7d-0000-4000-8000-000000000002', 'two@files.local', '{}', 'authenticated', 'authenticated');

select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000002');
select public.create_business('Files Two', 'UA', 'services');

select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000001');
select public.create_business('Files One', 'UA', 'services');
insert into storage.objects (bucket_id, name)
  values ('attachments', public.current_business_id()::text || '/note.pdf');
select is((select count(*)::int from storage.objects where bucket_id = 'attachments'), 1,
  'a member adds and sees a file of their business');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('attachments', 'loose.pdf') $$,
  '42501', null, 'a file goes into the folder of the business');
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('attachments', %L) $$,
         (select id::text from public.businesses where name = 'Files Two') || '/planted.pdf'),
  '42501', null, 'nobody puts a file into the folder of another business');

reset role;
insert into storage.objects (bucket_id, name) values ('attachments', 'legacy.png');

select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000002');
select is((select count(*)::int from storage.objects where bucket_id = 'attachments'), 0,
  'another business lists none of these files');
delete from storage.objects where bucket_id = 'attachments';
reset role;
select is((select count(*)::int from storage.objects where bucket_id = 'attachments'
  and (name = 'legacy.png' or name like '%/note.pdf')), 2,
  'another business removes nothing');

select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000001');
delete from storage.objects where bucket_id = 'attachments' and name = 'legacy.png';
reset role;
select ok(exists (select 1 from storage.objects where name = 'legacy.png'),
  'files made before the rule are removed by nobody');

select pg_temp.act_as('7d7d7d7d-0000-4000-8000-000000000001');
delete from storage.objects where bucket_id = 'attachments';
reset role;
select ok(not exists (select 1 from storage.objects where name like '%/note.pdf'),
  'a member removes a file of their business');

select * from finish();
rollback;
