-- Files of the documents bucket without a document (an upload whose row was
-- never written), older than a moment: documents_purge removes them.
CREATE OR REPLACE FUNCTION "public"."orphan_document_files"("p_before" timestamp with time zone) RETURNS SETOF "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select o.name
    from storage.objects o
    where o.bucket_id = 'documents'
      and o.created_at < p_before
      and not exists (select 1 from public.documents d where d.file_path = o.name)
    limit 100
$$;

revoke all on function public.orphan_document_files(timestamp with time zone) from public, anon, authenticated;
grant execute on function public.orphan_document_files(timestamp with time zone) to service_role;
