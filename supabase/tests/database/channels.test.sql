-- Channels and chat center tests (run with: npx supabase test db)
--
-- Conversations, messages, channels and reply templates are isolated per
-- business; bot tokens are never readable by members; a repeated delivery
-- is recorded once; the waiting timer follows who answered; a phone number
-- finds its client; each reminder is claimed only once.

begin;
create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(21);

update public.businesses set is_demo = false;

create function pg_temp.act_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('ffffffff-0000-4000-8000-000000000001', 'owner@chat.local', '{}', 'authenticated', 'authenticated'),
  ('ffffffff-0000-4000-8000-000000000002', 'other@chat.local', '{}', 'authenticated', 'authenticated'),
  ('ffffffff-0000-4000-8000-000000000003', 'books@chat.local', '{}', 'authenticated', 'authenticated');

create temporary table seen (key text primary key, business_id uuid, id bigint);
grant all on seen to authenticated;

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000002');
insert into seen (key, business_id) values ('warsaw', public.create_business('Warsaw Studio', 'PL'));
select pg_temp.act_as('ffffffff-0000-4000-8000-000000000001');
insert into seen (key, business_id) values ('kyiv', public.create_business('Kyiv Studio', 'UA'));

-- The server connects a Telegram bot to each business and receives chats
reset role;
insert into public.members (business_id, user_id, role)
  select business_id, 'ffffffff-0000-4000-8000-000000000003', 'accountant' from seen where key = 'kyiv';
insert into public.channels (business_id, kind, name)
  select business_id, 'telegram', key || '_bot' from seen;
insert into public.channel_secrets (channel_id, bot_token, webhook_secret)
  select id, '123:secret-' || name, 'hook' from public.channels;
insert into public.conversations (business_id, channel_id, external_id, title)
  select c.business_id, c.id, '1001', 'Client of ' || c.name from public.channels c;
insert into public.messages (business_id, conversation_id, direction, body, external_id, status)
  select business_id, id, 'in', 'Hello', '1', 'received' from public.conversations;
insert into seen (key, business_id, id)
  select 'conversation', cv.business_id, cv.id from public.conversations cv join seen s on s.business_id = cv.business_id and s.key = 'kyiv';

-- Waiting timer
select isnt((select waiting_since from public.conversations c join seen s on s.id = c.id and s.key = 'conversation'), null,
  'a client message the bot did not answer waits for a person');
insert into public.messages (business_id, conversation_id, direction, body)
  select business_id, id, 'out', 'Choose a service' from seen where key = 'conversation';
select isnt((select waiting_since from public.conversations c join seen s on s.id = c.id and s.key = 'conversation'), null,
  'an answer of the bot does not end the wait');
insert into public.messages (business_id, conversation_id, direction, body, sales_id)
  select s.business_id, s.id, 'out', 'We are open till 18:00', (select id from public.sales where user_id = 'ffffffff-0000-4000-8000-000000000001')
  from seen s where key = 'conversation';
select is((select waiting_since from public.conversations c join seen s on s.id = c.id and s.key = 'conversation'), null,
  'an answer of a person ends the wait');
insert into public.messages (business_id, conversation_id, direction, body, handled_by_bot)
  select business_id, id, 'in', '[Book]', true from seen where key = 'conversation';
select is((select waiting_since from public.conversations c join seen s on s.id = c.id and s.key = 'conversation'), null,
  'a button the bot answered does not make the client wait');
select isnt((select last_message_at from public.conversations c join seen s on s.id = c.id and s.key = 'conversation'), null,
  'a message moves its conversation up the feed');

-- Repeated deliveries
insert into public.channel_events (channel_id, event_id) select id, '501' from public.channels;
select throws_ok($$ insert into public.channel_events (channel_id, event_id) select id, '501' from public.channels $$,
  '23505', null, 'the same update of a channel is recorded once');
select throws_ok($$ insert into public.messages (business_id, conversation_id, direction, body, external_id)
  select business_id, id, 'in', 'Hello again', '1' from seen where key = 'conversation' $$,
  '23505', null, 'the same channel message is stored once');

-- Clients by phone
insert into seen (key, business_id, id)
  select 'client', business_id, public.find_or_create_client(business_id, 'Iryna', '+380 (67) 123-45-67') from seen where key = 'kyiv';
select is((select row(name, phone_number, kind, roles)::text from public.companies c join seen s on s.id = c.id and s.key = 'client'),
  '(Iryna,+380671234567,person,{client})', 'a new phone number becomes a private client');
select is((select public.find_or_create_client(business_id, 'Someone else', '380671234567') from seen where key = 'kyiv'),
  (select id from seen where key = 'client'), 'the same digits find the same client');
select isnt((select public.find_or_create_client(business_id, 'Iryna', '+380671234567') from seen where key = 'warsaw'),
  (select id from seen where key = 'client'), 'another business gets its own client');
select throws_ok($$ select public.find_or_create_client(business_id, 'X', '12') from seen where key = 'kyiv' $$,
  '22023', null, 'a phone number needs at least 7 digits');

-- Reminders: a haircut booked a week ahead, a beard trim booked an hour ahead
insert into public.products (business_id, kind, name, duration_minutes, currency)
  select business_id, 'service', 'Haircut', 60, 'UAH' from seen where key = 'kyiv';
insert into public.bookings (business_id, sales_id, product_id, client_id, starts_at, created_at)
  select s.business_id, (select id from public.sales where user_id = 'ffffffff-0000-4000-8000-000000000001'),
         p.id, (select id from seen where key = 'client'), '2030-01-10 10:00+00', '2030-01-03 10:00+00'
  from seen s join public.products p on p.business_id = s.business_id where s.key = 'kyiv';
insert into public.bookings (business_id, sales_id, product_id, client_id, starts_at, created_at)
  select s.business_id, (select id from public.sales where user_id = 'ffffffff-0000-4000-8000-000000000001'),
         p.id, (select id from seen where key = 'client'), '2030-01-10 14:00+00', '2030-01-10 12:30+00'
  from seen s join public.products p on p.business_id = s.business_id where s.key = 'kyiv';
update public.conversations set client_id = (select id from seen where key = 'client')
  where id = (select id from seen where key = 'conversation');

select is((select array_agg(kind) from public.claim_due_reminders('2030-01-09 11:00+00')),
  '{24h}'::text[], '24 hours before, the 24-hour reminder is due');
select is((select conversation_id from public.claim_due_reminders('2030-01-09 11:00+00') limit 1), null,
  'a reminder is claimed only once');
select is((select array_agg(row(kind, conversation_id = (select id from seen where key = 'conversation'))::text order by kind)
  from public.claim_due_reminders('2030-01-10 08:30+00')),
  '{"(2h,t)"}'::text[], '2 hours before, the 2-hour reminder goes to the Telegram chat of the client');
select is((select count(*)::int from public.claim_due_reminders('2030-01-10 13:00+00')), 0,
  'a booking made an hour ahead gets no reminder');

-- Members see their own business only, and no secrets
select pg_temp.act_as('ffffffff-0000-4000-8000-000000000001');
select is((select count(*)::int from public.conversations), 1, 'a business sees only its own conversations');
select is((select count(*)::int from public.messages), 4, 'a business sees only its own messages');
select throws_ok($$ select bot_token from public.channel_secrets $$, '42501', null, 'bot tokens are not readable by members');
select throws_ok($$ select public.find_or_create_client(current_business_id(), 'X', '+380671111111') $$,
  '42501', null, 'members do not call the server functions');
insert into public.reply_templates (title, body) values ('Hours', 'We are open 9:00-18:00');
select is((select count(*)::int from public.reply_templates), 1, 'a member adds reply templates');

select pg_temp.act_as('ffffffff-0000-4000-8000-000000000003');
update public.conversations set status = 'closed';
select is((select status from public.conversations), 'open', 'an accountant does not change conversations');

select * from finish();
rollback;
