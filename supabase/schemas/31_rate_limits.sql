--
-- Rate limits of the public endpoints (website widget, booking page): how
-- many times a key (an IP address, a widget, a phone) did something in a
-- window of time. Read and written by the server only; rows older than a
-- day are dropped as new ones come in.
--

create table public.rate_limits (
    key text not null,
    window_start timestamp with time zone not null,
    hits integer not null default 1,
    primary key (key, window_start),
    constraint rate_limits_key_length check (length(key) between 1 and 200)
);

-- Counts one more hit of a key in the current window; true while the key
-- stays within p_max hits per p_window_seconds
CREATE OR REPLACE FUNCTION "public"."take_rate_limit"("p_key" "text", "p_max" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  started timestamp with time zone :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  total integer;
begin
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'A limit needs a positive count and window' using errcode = '22023';
  end if;
  insert into public.rate_limits as r (key, window_start)
  values (p_key, started)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into total;
  -- Now and then, drop windows of past days
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return total <= p_max;
end;
$$;

--
-- Access: the server only
--

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;
grant all on table public.rate_limits to service_role;
revoke all on function public.take_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, integer, integer) to service_role;
