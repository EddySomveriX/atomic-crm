--
-- Messengers: Instagram Direct, Facebook Messenger, WhatsApp and Viber join
-- Telegram and the website widget as channels of the chat center.
-- A channel keeps the id of its account in the messenger (external_id) and
-- its secrets on the server: the access token, and for the channels of Meta
-- the app secret that signs deliveries and the token that confirms the
-- webhook address. Instagram, Messenger and WhatsApp let a business write
-- only within 24 hours of the client's last message: conversations keep that
-- moment (last_inbound_at). Buttons the bot offered in a messenger are kept
-- with the conversation (reply_choices), so a typed number or label counts
-- as pressing one.
--

alter table public.channels drop constraint channels_kind;
alter table public.channels
    add constraint channels_kind check (kind in ('telegram', 'widget', 'instagram', 'messenger', 'whatsapp', 'viber'));
-- Instagram: the user id; Messenger: the page id; WhatsApp: the phone number id
alter table public.channels add column external_id text;
alter table public.channels
    add constraint channels_external_id_length check (external_id is null or length(external_id) <= 100);

alter table public.channel_secrets add column access_token text;
-- Meta signs every delivery with the secret of the app
alter table public.channel_secrets add column app_secret text;
-- Meta sends it back once, to confirm the webhook address
alter table public.channel_secrets add column verify_token text;
alter table public.channel_secrets add column token_expires_at timestamp with time zone;
alter table public.channel_secrets add column refreshed_at timestamp with time zone;

alter table public.conversations add column last_inbound_at timestamp with time zone;
-- [{"data": "svc:12", "label": "Haircut"}]: the buttons of the last bot reply
alter table public.conversations add column reply_choices jsonb not null default '[]'::jsonb;
alter table public.conversations
    add constraint conversations_reply_choices_is_array check (jsonb_typeof(reply_choices) = 'array');

alter table public.bookings drop constraint bookings_source;
alter table public.bookings
    add constraint bookings_source check (source in ('crm', 'telegram', 'widget', 'instagram', 'messenger', 'whatsapp', 'viber'));

-- Whether a business may write first in a conversation now: always in
-- Telegram and Viber, within 24 hours of the client's last message in the
-- channels of Meta, never on the website widget (the visitor has left).
CREATE OR REPLACE FUNCTION "public"."chat_reachable"("p_kind" "text", "p_last_inbound_at" timestamp with time zone, "p_now" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
    select case
        when p_kind in ('telegram', 'viber') then true
        when p_kind in ('instagram', 'messenger', 'whatsapp') then coalesce(p_last_inbound_at > p_now - interval '24 hours', false)
        else false
    end
$$;

grant all on function public.chat_reachable(text, timestamp with time zone, timestamp with time zone) to authenticated;
grant all on function public.chat_reachable(text, timestamp with time zone, timestamp with time zone) to service_role;

-- The client of a phone number in a business, when there is one: a chat of
-- WhatsApp or Viber is tied to its client without making a new one. Server only.
CREATE OR REPLACE FUNCTION "public"."find_client_by_phone"("p_business_id" "uuid", "p_phone" "text") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    select c.id
    from public.companies c
    where c.business_id = p_business_id
      and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 7
      and regexp_replace(coalesce(c.phone_number, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    order by c.id
    limit 1
$$;

revoke all on function public.find_client_by_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.find_client_by_phone(uuid, text) to service_role;
