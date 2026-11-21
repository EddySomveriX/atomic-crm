-- Attachments isolated by business (supabase/schemas/07_storage.sql): any
-- signed-in member could list, add and remove files of every business.

drop policy if exists "Attachments 1mt4rzk_0" on storage.objects;
drop policy if exists "Attachments 1mt4rzk_1" on storage.objects;
drop policy if exists "Attachments 1mt4rzk_3" on storage.objects;

-- Attachments (note files, avatars, logos) live in the folder of their
-- business: <business_id>/<random name>. A member lists, adds and removes
-- files of their own business only. Files made before this rule sit at the
-- top level: their links keep working (the bucket serves files by an
-- unguessable public link), but nobody lists or removes them any more.
create policy "Attachments read" on storage.objects for select to authenticated using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select public.current_business_id())::text);
create policy "Attachments upload" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select public.current_business_id())::text);
create policy "Attachments delete" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select public.current_business_id())::text);
