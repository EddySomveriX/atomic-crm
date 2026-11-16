-- Cancellations and client reliability (see supabase/schemas/19_reliability.sql)

--
-- Cancellations and client reliability
-- A booking remembers who cancelled it and when, whether that was a late
-- cancellation (inside the free cancellation window of the business), how
-- often it was moved and how many of those moves were last-minute, how late
-- the client came and whether the client confirmed the visit. From the last
-- twelve months of that history each client gets a reliability level that
-- only members see: reliable, regular, watch, unreliable. An owner can set
-- the level by hand (a trusted client, or a client never booked online).
--

-- Booking rules of a business
alter table public.businesses add column free_cancel_hours integer not null default 24;
-- Unreliable clients book through a person, not online
alter table public.businesses add column block_unreliable boolean not null default true;
alter table public.businesses
    add constraint businesses_free_cancel_hours check (free_cancel_hours between 0 and 168);

alter table public.bookings add column cancelled_at timestamp with time zone;
alter table public.bookings add column cancelled_by text;
alter table public.bookings add column late_cancel boolean not null default false;
alter table public.bookings add column reschedule_count integer not null default 0;
alter table public.bookings add column late_reschedules integer not null default 0;
-- Minutes the client came late, marked by the specialist
alter table public.bookings add column late_minutes integer;
-- The client confirmed the visit (from the reminder)
alter table public.bookings add column confirmed_at timestamp with time zone;
alter table public.bookings
    add constraint bookings_cancelled_by check (cancelled_by in ('client', 'business'));
alter table public.bookings
    add constraint bookings_late_minutes check (late_minutes between 0 and 600);

alter table public.companies add column reliability_override text;
alter table public.companies
    add constraint companies_reliability_override check (reliability_override in ('reliable', 'unreliable'));

-- A cancellation records when and by whom; it is late when it comes inside
-- the free cancellation window. A move of the start counts as a reschedule,
-- a last-minute one inside the window.
CREATE OR REPLACE FUNCTION "public"."track_booking_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  window_hours integer;
begin
  select b.free_cancel_hours into window_hours from public.businesses b where b.id = new.business_id;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, 'business');
    new.late_cancel := new.cancelled_by = 'client'
        and new.cancelled_at > old.starts_at - make_interval(hours => window_hours);
  elsif new.status <> 'cancelled' and old.status = 'cancelled' then
    new.cancelled_at := null;
    new.cancelled_by := null;
    new.late_cancel := false;
  end if;
  if new.starts_at <> old.starts_at and new.status <> 'cancelled' then
    new.reschedule_count := old.reschedule_count + 1;
    if now() > old.starts_at - make_interval(hours => window_hours) then
      new.late_reschedules := old.late_reschedules + 1;
    end if;
    -- A moved visit is not confirmed yet
    new.confirmed_at := null;
  end if;
  return new;
end;
$$;

create or replace trigger track_booking_changes
    before update on public.bookings
    for each row execute function public.track_booking_changes();

-- The reliability of the clients of the current business over the last
-- twelve months, with the counts behind it. Security invoker: a member sees
-- their own business.
create or replace view public.client_reliability with (security_invoker = on) as
with history as (
    select b.client_id,
           count(*) filter (where b.status = 'completed') as visits,
           count(*) filter (where b.status = 'no_show') as no_shows,
           count(*) filter (where b.late_cancel) as late_cancels,
           coalesce(sum(b.late_reschedules), 0)::int as late_reschedules,
           count(*) filter (where b.late_minutes >= 15) as late_arrivals
    from public.bookings b
    where b.client_id is not null
      and b.starts_at > now() - interval '12 months'
      and b.starts_at < now() + interval '12 months'
    group by b.client_id
)
select c.id,
       c.business_id,
       coalesce(h.visits, 0)::int as visits,
       coalesce(h.no_shows, 0)::int as no_shows,
       coalesce(h.late_cancels, 0)::int as late_cancels,
       coalesce(h.late_reschedules, 0)::int as late_reschedules,
       coalesce(h.late_arrivals, 0)::int as late_arrivals,
       c.reliability_override,
       coalesce(c.reliability_override, case
           when coalesce(h.no_shows, 0) >= 2 or coalesce(h.no_shows, 0) + coalesce(h.late_cancels, 0) >= 3 then 'unreliable'
           when coalesce(h.no_shows, 0) = 1 or coalesce(h.late_cancels, 0) >= 2
                or coalesce(h.late_reschedules, 0) >= 2 or coalesce(h.late_arrivals, 0) >= 3 then 'watch'
           when coalesce(h.visits, 0) >= 3 then 'reliable'
           else 'regular'
       end) as level
from public.companies c
left join history h on h.client_id = c.id;

grant select on table public.client_reliability to authenticated;
grant all on table public.client_reliability to service_role;
grant all on function public.track_booking_changes() to authenticated;
grant all on function public.track_booking_changes() to service_role;
