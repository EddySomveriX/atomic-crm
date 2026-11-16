-- Documents tests (run with: npx supabase test db)
--
-- A document is kept in the folder of its business, the same file is stored
-- once, only an owner moves a document to the trash, a document's file does
-- not change, storage files of another business stay out of reach, and the
-- table is isolated per business.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(11);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('dcdcdcdc-0000-4000-8000-000000000001', 'owner@docs.local', '{}', 'authenticated', 'authenticated'),
  ('dcdcdcdc-0000-4000-8000-000000000002', 'other@docs.local', '{}', 'authenticated', 'authenticated'),
  ('dcdcdcdc-0000-4000-8000-000000000003', 'manager@docs.local', '{}', 'authenticated', 'authenticated');

create temporary table biz (name text primary key, id uuid);
grant all on biz to authenticated;

select pg_temp.act_as('dcdcdcdc-0000-4000-8000-000000000002');
insert into biz values ('other', public.create_business('Other Shop', 'UA', 'retail'));
insert into public.documents (title, file_path, file_name, mime_type, size_bytes, checksum)
  select 'Their invoice', id || '/x/invoice.pdf', 'invoice.pdf', 'application/pdf', 100, repeat('a', 64) from biz where name = 'other';

select pg_temp.act_as('dcdcdcdc-0000-4000-8000-000000000001');
insert into biz values ('mine', public.create_business('Docs Shop', 'UA', 'retail'));
select ok((select 'documents' = any(modules) from public.businesses where name = 'Docs Shop'), 'a shop starts with documents');
reset role;
insert into public.members (business_id, user_id, role)
  select id, 'dcdcdcdc-0000-4000-8000-000000000003', 'manager' from biz where name = 'mine';
select pg_temp.act_as('dcdcdcdc-0000-4000-8000-000000000001');

insert into public.companies (name) values ('Supplier');
insert into public.documents (kind, title, file_path, file_name, mime_type, size_bytes, checksum, company_id, amount)
  select 'invoice', 'Invoice 12', b.id || '/a/invoice-12.pdf', 'invoice-12.pdf', 'application/pdf', 2048, repeat('b', 64), c.id, 125000
  from biz b, public.companies c where b.name = 'mine' and c.name = 'Supplier';
select is((select count(*)::int from public.documents), 1, 'a business sees only its own documents');
select throws_ok($$ insert into public.documents (title, file_path, file_name, mime_type, size_bytes, checksum)
  select 'Copy', id || '/b/copy.pdf', 'copy.pdf', 'application/pdf', 2048, repeat('b', 64) from biz where name = 'mine' $$,
  '23505', null, 'the same file is not stored twice');
select throws_ok($$ insert into public.documents (title, file_path, file_name, mime_type, size_bytes, checksum)
  select 'Elsewhere', id || '/c/x.pdf', 'x.pdf', 'application/pdf', 10, repeat('c', 64) from biz where name = 'other' $$,
  null, null, 'a document is not added to another business');
select throws_ok($$ insert into public.documents (title, file_path, file_name, mime_type, size_bytes, checksum)
  select 'Big', id || '/d/big.pdf', 'big.pdf', 'application/pdf', 30000000, repeat('d', 64) from biz where name = 'mine' $$,
  '23514', null, 'a file is at most 20 MB');
select throws_ok($$ update public.documents set file_path = replace(file_path, '/a/', '/z/') $$,
  '42501', null, 'the file of a document does not change');

-- Trash
select pg_temp.act_as('dcdcdcdc-0000-4000-8000-000000000003');
select throws_ok($$ update public.documents set deleted_at = now() $$, '42501', null, 'a manager does not move documents to the trash');
select pg_temp.act_as('dcdcdcdc-0000-4000-8000-000000000001');
update public.documents set deleted_at = now();
select isnt((select deleted_by from public.documents), null, 'an owner moves a document to the trash and is recorded');
insert into public.documents (title, file_path, file_name, mime_type, size_bytes, checksum)
  select 'Again', id || '/e/again.pdf', 'again.pdf', 'application/pdf', 2048, repeat('b', 64) from biz where name = 'mine';
select is((select count(*)::int from public.documents), 2, 'a file in the trash can be uploaded again');

-- Storage folders
select ok((select public.is_own_document_path(id || '/a/invoice-12.pdf') from biz where name = 'mine'), 'a member reaches files of the own folder');
select ok(not (select public.is_own_document_path(id || '/x/invoice.pdf') from biz where name = 'other'), 'files of another business stay out of reach');

select * from finish();
rollback;
