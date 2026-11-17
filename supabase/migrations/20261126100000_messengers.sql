-- Messengers: Instagram Direct, Facebook Messenger, WhatsApp and Viber as
-- channels of the chat center (see supabase/schemas/27_messengers.sql,
-- 16_channels.sql and 22_automations.sql)

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

-- Conversations that already have messages of clients
update public.conversations c
set last_inbound_at = (select max(m.created_at) from public.messages m
                       where m.conversation_id = c.id and m.direction = 'in');

CREATE OR REPLACE FUNCTION "public"."handle_message_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.conversations c
  set last_message_at = new.created_at,
      -- Opens the 24 hours in which Instagram, Messenger and WhatsApp let a business answer
      last_inbound_at = case when new.direction = 'in' then new.created_at else c.last_inbound_at end,
      waiting_since = case
          when new.direction = 'in' and not new.handled_by_bot then coalesce(c.waiting_since, new.created_at)
          when new.direction = 'out' and new.sales_id is not null then null
          else c.waiting_since
      end,
      status = case when new.direction = 'in' then 'open' else c.status end
  where c.id = new.conversation_id;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."claim_due_reminders"("p_now" timestamp with time zone DEFAULT now()) RETURNS TABLE("booking_id" bigint, "kind" "text", "conversation_id" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return query
  with due as (
      select b.id, '24h'::text as kind
      from public.bookings b
      where b.status = 'booked' and b.reminded_24h_at is null
        and b.starts_at > p_now + interval '2 hours'
        and b.starts_at <= p_now + interval '24 hours'
        and b.created_at <= b.starts_at - interval '24 hours'
      union all
      select b.id, '2h'::text
      from public.bookings b
      where b.status = 'booked' and b.reminded_2h_at is null
        and b.starts_at > p_now
        and b.starts_at <= p_now + interval '2 hours'
        and b.created_at <= b.starts_at - interval '2 hours'
  ),
  claimed as (
      update public.bookings b
      set reminded_24h_at = case when d.kind = '24h' then p_now else b.reminded_24h_at end,
          reminded_2h_at = case when d.kind = '2h' then p_now else b.reminded_2h_at end
      from due d
      where b.id = d.id
      returning b.id, d.kind, b.conversation_id, b.client_id, b.business_id
  )
  -- The conversation the booking was made in while the business may still
  -- write there, else the latest conversation of the client it may write in
  select c.id, c.kind, coalesce((
      select cv.id
      from public.conversations cv
      join public.channels ch on ch.id = cv.channel_id
      where cv.business_id = c.business_id and ch.enabled
        and (cv.id = c.conversation_id or cv.client_id = c.client_id)
        and public.chat_reachable(ch.kind, cv.last_inbound_at, p_now)
      order by (cv.id = c.conversation_id) desc nulls last, cv.last_message_at desc nulls last
      limit 1
  ), c.conversation_id)
  from claimed c;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."claim_due_automations"("p_now" timestamp with time zone DEFAULT now()) RETURNS TABLE("send_id" bigint, "kind" "text", "client_id" bigint, "booking_id" bigint, "conversation_id" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return query
  with active as (
      -- Businesses with the automation on, inside their sending hours
      select a.business_id, a.kind, coalesce(a.days, 60) as days, bz.timezone
      from public.automations a
      join public.businesses bz on bz.id = a.business_id
      where a.enabled
        and extract(hour from p_now at time zone bz.timezone) between 9 and 19
  ),
  due as (
      select ac.business_id, ac.kind, b.id::text as dedupe_key, b.client_id, b.id as booking_id
      from active ac
      join public.bookings b on b.business_id = ac.business_id
      where ac.kind = 'review' and b.status = 'completed' and b.client_id is not null
        and b.ends_at <= p_now - interval '2 hours'
        and b.ends_at > p_now - interval '26 hours'
      union all
      select ac.business_id, ac.kind, b.id::text, b.client_id, b.id
      from active ac
      join public.bookings b on b.business_id = ac.business_id
      where ac.kind = 'no_show' and b.status = 'no_show' and b.client_id is not null
        and b.starts_at <= p_now
        and b.starts_at > p_now - interval '48 hours'
      union all
      select ac.business_id, ac.kind, b.id::text, b.client_id, b.id
      from active ac
      join public.bookings b on b.business_id = ac.business_id
      join public.products p on p.id = b.product_id
      where ac.kind = 'rebook' and b.status = 'completed' and b.client_id is not null
        and p.rebook_days is not null
        and b.ends_at <= p_now - make_interval(days => p.rebook_days)
        and b.ends_at > p_now - make_interval(days => p.rebook_days + 7)
        -- the latest visit for this service, and nothing booked ahead
        and not exists (
            select 1 from public.bookings later
            where later.client_id = b.client_id and later.business_id = b.business_id
              and later.product_id = b.product_id and later.status = 'completed'
              and later.starts_at > b.starts_at)
        and not exists (
            select 1 from public.bookings ahead
            where ahead.client_id = b.client_id and ahead.business_id = b.business_id
              and ahead.status = 'booked' and ahead.starts_at > p_now)
      union all
      select ac.business_id, ac.kind,
             c.id || ':' || extract(year from p_now at time zone ac.timezone),
             c.id, null::bigint
      from active ac
      join public.companies c on c.business_id = ac.business_id
      where ac.kind = 'birthday' and c.birth_date is not null
        and to_char(c.birth_date, 'MM-DD') = to_char(p_now at time zone ac.timezone, 'MM-DD')
      union all
      select ac.business_id, ac.kind, last_visit.id::text, last_visit.client_id, last_visit.id
      from active ac
      join lateral (
          select distinct on (b.client_id) b.id, b.client_id, b.ends_at
          from public.bookings b
          where b.business_id = ac.business_id and b.client_id is not null
            and b.status in ('completed', 'booked')
          order by b.client_id, b.starts_at desc
      ) last_visit on true
      join public.bookings lb on lb.id = last_visit.id
      where ac.kind = 'reactivation' and lb.status = 'completed'
        and last_visit.ends_at <= p_now - make_interval(days => ac.days)
        and last_visit.ends_at > p_now - make_interval(days => ac.days + 14)
  ),
  reachable as (
      select d.*, (
          select cv.id
          from public.conversations cv
          join public.channels ch on ch.id = cv.channel_id
          where cv.client_id = d.client_id and cv.business_id = d.business_id
            and ch.enabled and public.chat_reachable(ch.kind, cv.last_inbound_at, p_now)
            and cv.consent_at is not null and cv.automations_off_at is null
          order by cv.last_message_at desc nulls last
          limit 1
      ) as conversation_id
      from due d
  ),
  claimed as (
      insert into public.automation_sends (business_id, kind, dedupe_key, client_id, booking_id, conversation_id)
      select r.business_id, r.kind, r.dedupe_key, r.client_id, r.booking_id, r.conversation_id
      from reachable r
      where r.conversation_id is not null
      on conflict on constraint automation_sends_once do nothing
      returning automation_sends.id, automation_sends.kind, automation_sends.client_id,
                automation_sends.booking_id, automation_sends.conversation_id
  )
  select * from claimed;
end;
$$;
