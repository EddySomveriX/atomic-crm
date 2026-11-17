-- Messengers tests (run with: npx supabase test db)
--
-- Instagram, Messenger, WhatsApp and Viber are channels the server adds, one
-- of a kind per business; their secrets stay on the server; a message of a
-- client opens the 24 hours in which the channels of Meta may be answered;
-- reminders and automatic messages go only where the business may write; a
-- chat is tied to a known client by the phone number; bookings keep the
-- messenger they came from; chats are isolated per business.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(15);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('7b7b7b7b-0000-4000-8000-000000000001', 'owner@messengers.local', '{"first_name":"Owner"}', 'authenticated', 'authenticated'),
  ('7b7b7b7b-0000-4000-8000-000000000003', 'other@messengers.local', '{}', 'authenticated', 'authenticated');

create temporary table t (key text primary key, id bigint);
grant all on t to authenticated;

select pg_temp.act_as('7b7b7b7b-0000-4000-8000-000000000003');
select public.create_business('Other Messengers', 'UA', 'services');

select pg_temp.act_as('7b7b7b7b-0000-4000-8000-000000000001');
select public.create_business('Messenger Salon', 'UA', 'services');
insert into public.products (kind, name, duration_minutes, price) values ('service', 'Cut', 60, 50000);
insert into public.companies (name, phone_number, roles) values ('Olena', '+380 67 123 45 67', '{client}');
insert into t (key, id) select 'client', id from public.companies where name = 'Olena';
insert into t (key, id) select 'owner', s.id from public.sales s where s.user_id = '7b7b7b7b-0000-4000-8000-000000000001';

select throws_ok($$ insert into public.channels (kind, name) values ('whatsapp', '+380') $$, '42501', null,
  'members do not add messengers themselves');

reset role;
insert into public.channels (business_id, kind, name, external_id)
  select b.id, k.kind, k.kind || ' account', '100' || k.n
  from public.businesses b,
       (values ('instagram', 1), ('messenger', 2), ('whatsapp', 3), ('viber', 4)) as k(kind, n)
  where b.name = 'Messenger Salon';
select is((select count(*)::int from public.channels c join public.businesses b on b.id = c.business_id
           where b.name = 'Messenger Salon' and c.kind in ('instagram', 'messenger', 'whatsapp', 'viber')), 4,
  'the server adds Instagram, Messenger, WhatsApp and Viber');
select throws_ok($$ insert into public.channels (business_id, kind, name)
  select id, 'viber', 'second' from public.businesses where name = 'Messenger Salon' $$, '23505', null,
  'a business has one channel of a kind');
select throws_ok($$ insert into public.channels (business_id, kind, name)
  select id, 'signal', 'x' from public.businesses where name = 'Messenger Salon' $$, '23514', null,
  'an unknown messenger is refused');

insert into public.channel_secrets (channel_id, access_token, app_secret, verify_token)
  select c.id, 'token-' || c.kind, 'app-secret', 'verify' from public.channels c
  join public.businesses b on b.id = c.business_id where b.name = 'Messenger Salon' and c.kind = 'instagram';
insert into t (key, id) select c.kind, c.id from public.channels c
  join public.businesses b on b.id = c.business_id where b.name = 'Messenger Salon' and c.kind <> 'widget';

select pg_temp.act_as('7b7b7b7b-0000-4000-8000-000000000001');
select throws_ok($$ select access_token from public.channel_secrets $$, '42501', null, 'tokens and app secrets stay on the server');

-- A chat in Instagram and one in Viber with the same client
reset role;
insert into public.conversations (business_id, channel_id, external_id, title, client_id, consent_at)
  select c.business_id, c.id, 'ig-900', 'Olena', (select id from t where key = 'client'), now()
  from public.channels c where c.id = (select id from t where key = 'instagram');
insert into public.conversations (business_id, channel_id, external_id, title, client_id, consent_at)
  select c.business_id, c.id, 'vb-1', 'Olena', (select id from t where key = 'client'), now()
  from public.channels c where c.id = (select id from t where key = 'viber');
insert into t (key, id) select 'chat_ig', id from public.conversations where external_id = 'ig-900';
insert into t (key, id) select 'chat_vb', id from public.conversations where external_id = 'vb-1';

select is((select last_inbound_at from public.conversations where id = (select id from t where key = 'chat_ig')), null,
  'a chat nobody wrote in has no time to answer');
insert into public.messages (business_id, conversation_id, direction, body, status, external_id)
  select business_id, id, 'in', 'Hello', 'received', 'm1' from public.conversations where id = (select id from t where key = 'chat_ig');
select ok((select last_inbound_at is not null from public.conversations where id = (select id from t where key = 'chat_ig')),
  'a message of the client opens the time to answer');
insert into public.messages (business_id, conversation_id, direction, body, status, sales_id)
  select business_id, id, 'out', 'Hi', 'sent', (select id from t where key = 'owner') from public.conversations where id = (select id from t where key = 'chat_ig');
select ok((select last_inbound_at = (select created_at from public.messages where external_id = 'm1')
           from public.conversations where id = (select id from t where key = 'chat_ig')),
  'an answer of the business does not move it');

select ok(public.chat_reachable('instagram', now() - interval '23 hours') and not public.chat_reachable('whatsapp', now() - interval '25 hours'),
  'the channels of Meta are answered within 24 hours');
select ok(public.chat_reachable('viber', null) and public.chat_reachable('telegram', null) and not public.chat_reachable('widget', now()),
  'Telegram and Viber are always open, the website widget never');

-- A reminder for a booking made in Instagram: there while the 24 hours last, in Viber after
with made as (
  insert into public.bookings (business_id, sales_id, product_id, client_id, starts_at, source, conversation_id, created_at)
  select c.business_id, (select id from t where key = 'owner'), p.id, (select id from t where key = 'client'),
         now() + interval '90 minutes', 'instagram', (select id from t where key = 'chat_ig'), now() - interval '3 days'
  from public.conversations c, public.products p
  where c.id = (select id from t where key = 'chat_ig') and p.name = 'Cut' and p.business_id = c.business_id
  returning id)
insert into t (key, id) select 'booking', id from made;
select is((select source from public.bookings where id = (select id from t where key = 'booking')), 'instagram',
  'a booking keeps the messenger it came from');
select is((select conversation_id from public.claim_due_reminders(now()) where booking_id = (select id from t where key = 'booking')),
  (select id from t where key = 'chat_ig'), 'a reminder goes to the chat of the booking while it may be answered');

update public.bookings set reminded_2h_at = null where id = (select id from t where key = 'booking');
update public.conversations set last_inbound_at = now() - interval '2 days' where id = (select id from t where key = 'chat_ig');
select is((select conversation_id from public.claim_due_reminders(now()) where booking_id = (select id from t where key = 'booking')),
  (select id from t where key = 'chat_vb'), 'after 24 hours it goes to a chat the business may write in');

-- Known clients by phone
select is(public.find_client_by_phone((select id from public.businesses where name = 'Messenger Salon'), '+380671234567'),
  (select id from t where key = 'client'), 'a chat is tied to the client with the same phone number');

-- Isolation
select pg_temp.act_as('7b7b7b7b-0000-4000-8000-000000000003');
select is((select count(*)::int from public.conversations) + (select count(*)::int from public.channels where kind <> 'widget'), 0,
  'another business sees neither the chats nor the messengers');

select * from finish();
rollback;
