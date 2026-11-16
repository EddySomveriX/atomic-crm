-- Files in chats: a file or photo a client sends in Telegram is kept on its
-- message (Telegram's file id, name, type, size) until a member saves it to
-- the documents; a document sent to a client is linked from its message.

alter table public.documents
    add constraint documents_id_business_id_key unique (id, business_id);

alter table public.messages add column attachment jsonb;
alter table public.messages add column document_id bigint;
alter table public.messages
    add constraint messages_attachment check (attachment is null or jsonb_typeof(attachment) = 'object');
alter table public.messages
    add constraint messages_document_id_fkey foreign key (document_id, business_id) references public.documents(id, business_id) on delete set null (document_id);
create index messages_document_id_idx on public.messages using btree (document_id);
