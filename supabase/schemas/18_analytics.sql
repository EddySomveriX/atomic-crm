--
-- Analytics of a business (the "Аналітика" module)
-- One call returns every figure of the analytics page for a period, computed
-- in the database: sales and bookings by month, attendance, busy hours, top
-- clients and services, load of the specialists, clients who stopped
-- coming, deals in progress, chats and stock. Security invoker: row level
-- security keeps it to the current business. Amounts are in minor units of
-- the business currency; deals in another currency are left out. Months and
-- hours follow the business time zone.
--
-- Revenue until payments exist (stage 4): won deals, by their closing date,
-- plus completed bookings at the price of their service.
--

CREATE OR REPLACE FUNCTION "public"."business_analytics"("p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  biz public.businesses;
  first_month date;
  result jsonb;
begin
  select * into biz from public.businesses where id = public.current_business_id();
  if biz.id is null then
    raise exception 'No current business' using errcode = '42501';
  end if;
  -- Twelve months ending with the month of the end of the period
  first_month := (date_trunc('month', (p_to - interval '1 second') at time zone biz.timezone) - interval '11 months')::date;

  with
  months as (
      select generate_series(first_month, first_month + interval '11 months', interval '1 month')::date as month
  ),
  sales as (
      -- Every sale: won deals and completed bookings, with its day and client
      select coalesce(d.expected_closing_date, (d.updated_at at time zone biz.timezone)::date) as day,
             coalesce(d.amount, 0) as amount, d.company_id as client_id, 'deal'::text as kind
      from public.deals d
      where d.business_id = biz.id and d.stage = 'won' and d.archived_at is null and d.currency = biz.currency
      union all
      select (b.starts_at at time zone biz.timezone)::date, coalesce(p.price, 0), b.client_id, 'booking'
      from public.bookings b
      join public.products p on p.id = b.product_id
      where b.business_id = biz.id and b.status = 'completed'
        and (p.price is null or p.currency = biz.currency)
  ),
  period_sales as (
      select * from sales
      where day >= (p_from at time zone biz.timezone)::date and day < (p_to at time zone biz.timezone)::date
  ),
  period_bookings as (
      select b.*, p.name as service, p.price
      from public.bookings b
      join public.products p on p.id = b.product_id
      where b.business_id = biz.id and b.starts_at >= p_from and b.starts_at < p_to
  ),
  clients as (
      select c.id, c.name, c.created_at
      from public.companies c
      where c.business_id = biz.id and 'client' = any(c.roles)
  ),
  waits as (
      -- Minutes from a client message the bot did not answer to the next
      -- answer of a person
      select extract(epoch from (
          select min(o.created_at) from public.messages o
          where o.conversation_id = m.conversation_id and o.direction = 'out'
            and o.sales_id is not null and o.created_at >= m.created_at
      ) - m.created_at) / 60 as minutes
      from public.messages m
      where m.business_id = biz.id and m.direction = 'in' and not m.handled_by_bot
        and m.created_at >= p_from and m.created_at < p_to
  )
  select jsonb_build_object(
    'currency', biz.currency,
    'timezone', biz.timezone,
    'kpis', jsonb_build_object(
        'revenue', (select coalesce(sum(amount), 0) from period_sales),
        'sales_count', (select count(*) from period_sales),
        'average_ticket', (select coalesce(round(avg(amount))::bigint, 0) from period_sales where amount > 0),
        'bookings', (select count(*) from period_bookings where status <> 'cancelled'),
        'completed', (select count(*) from period_bookings where status = 'completed'),
        'no_show', (select count(*) from period_bookings where status = 'no_show'),
        'cancelled', (select count(*) from period_bookings where status = 'cancelled'),
        'new_clients', (select count(*) from clients where created_at >= p_from and created_at < p_to),
        'clients_total', (select count(*) from clients),
        'conversations', (select count(*) from public.conversations cv
                          where cv.business_id = biz.id and cv.created_at >= p_from and cv.created_at < p_to),
        'waiting_now', (select count(*) from public.conversations cv
                        where cv.business_id = biz.id and cv.waiting_since is not null),
        'reply_minutes', (select round(percentile_cont(0.5) within group (order by minutes))::int from waits where minutes is not null)
    ),
    'sales_by_month', (
        select jsonb_agg(jsonb_build_object(
            'month', to_char(m.month, 'YYYY-MM'),
            'deals', coalesce((select sum(s.amount) from sales s where s.kind = 'deal' and date_trunc('month', s.day) = m.month), 0),
            'bookings', coalesce((select sum(s.amount) from sales s where s.kind = 'booking' and date_trunc('month', s.day) = m.month), 0)
        ) order by m.month)
        from months m
    ),
    'bookings_by_month', (
        select jsonb_agg(x.row order by x.month)
        from (
            select m.month, jsonb_build_object(
                'month', to_char(m.month, 'YYYY-MM'),
                'completed', count(b.id) filter (where b.status = 'completed'),
                'booked', count(b.id) filter (where b.status = 'booked'),
                'no_show', count(b.id) filter (where b.status = 'no_show'),
                'cancelled', count(b.id) filter (where b.status = 'cancelled')
            ) as row
            from months m
            left join public.bookings b on b.business_id = biz.id
                and date_trunc('month', b.starts_at at time zone biz.timezone)::date = m.month
            group by m.month
        ) x
    ),
    'clients_by_month', (
        select jsonb_agg(jsonb_build_object(
            'month', to_char(m.month, 'YYYY-MM'),
            'new_clients', (select count(*) from clients c where date_trunc('month', c.created_at at time zone biz.timezone)::date = m.month)
        ) order by m.month)
        from months m
    ),
    'busy_hours', (
        select coalesce(jsonb_agg(jsonb_build_object('weekday', weekday, 'hour', hour, 'bookings', total)), '[]'::jsonb)
        from (
            select extract(isodow from b.starts_at at time zone biz.timezone)::int as weekday,
                   extract(hour from b.starts_at at time zone biz.timezone)::int as hour,
                   count(*) as total
            from period_bookings b
            where b.status <> 'cancelled'
            group by 1, 2
        ) h
    ),
    'top_clients', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.revenue desc, t.visits desc), '[]'::jsonb)
        from (
            select c.id, c.name,
                   coalesce(sum(s.amount), 0) as revenue,
                   count(*) filter (where s.kind = 'booking') as visits,
                   max(s.day) as last_day
            from period_sales s
            join public.companies c on c.id = s.client_id
            group by c.id, c.name
            order by revenue desc, visits desc
            limit 10
        ) t
    ),
    'top_services', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.bookings desc), '[]'::jsonb)
        from (
            select b.product_id as id, b.service as name,
                   count(*) filter (where b.status <> 'cancelled') as bookings,
                   coalesce(sum(b.price) filter (where b.status = 'completed'), 0) as revenue
            from period_bookings b
            group by b.product_id, b.service
            order by bookings desc
            limit 10
        ) t
    ),
    'specialists', (
        select coalesce(jsonb_agg(row_to_json(t) order by t.booked_minutes desc), '[]'::jsonb)
        from (
            select s.id, trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')) as name,
                   coalesce((select round(sum(extract(epoch from (b.ends_at - b.starts_at)) / 60))
                             from period_bookings b where b.sales_id = s.id and b.status <> 'cancelled'), 0)::int as booked_minutes,
                   coalesce((select round(sum(extract(epoch from (w.ends_at - w.starts_at)) / 60))
                             from public.working_hours w
                             cross join generate_series((p_from at time zone biz.timezone)::date,
                                                        ((p_to at time zone biz.timezone) - interval '1 second')::date,
                                                        interval '1 day') as day
                             where w.business_id = biz.id and w.sales_id = s.id
                               and w.weekday = extract(isodow from day)), 0)::int as working_minutes
            from public.sales s
            where exists (select 1 from public.working_hours w where w.business_id = biz.id and w.sales_id = s.id)
               or exists (select 1 from period_bookings b where b.sales_id = s.id)
        ) t
    ),
    'dormant_clients', (
        -- Came at least once, last visit over 60 days ago, nothing booked ahead
        select coalesce(jsonb_agg(row_to_json(t) order by t.visits desc), '[]'::jsonb)
        from (
            select c.id, c.name, count(*) as visits,
                   max((b.starts_at at time zone biz.timezone)::date) as last_day
            from public.bookings b
            join public.companies c on c.id = b.client_id
            where b.business_id = biz.id and b.status = 'completed'
            group by c.id, c.name
            having max(b.starts_at) < now() - interval '60 days'
               and not exists (select 1 from public.bookings f
                               where f.client_id = c.id and f.status = 'booked' and f.starts_at > now())
            order by visits desc
            limit 10
        ) t
    ),
    'deals_by_stage', (
        select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
        from (
            select d.stage, count(*) as deals, coalesce(sum(d.amount), 0) as amount
            from public.deals d
            where d.business_id = biz.id and d.archived_at is null and d.stage not in ('won', 'lost')
              and d.currency = biz.currency
            group by d.stage
        ) t
    ),
    'channels', (
        select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
        from (
            select ch.kind, count(*) as conversations
            from public.conversations cv
            join public.channels ch on ch.id = cv.channel_id
            where cv.business_id = biz.id and cv.created_at >= p_from and cv.created_at < p_to
            group by ch.kind
        ) t
    ),
    'booking_sources', (
        select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
        from (
            select b.source, count(*) as bookings
            from period_bookings b
            where b.status <> 'cancelled'
            group by b.source
        ) t
    ),
    'stock', jsonb_build_object(
        'products', (select count(*) from public.products_summary p
                     where p.business_id = biz.id and p.kind <> 'service' and not p.archived),
        'in_stock', (select count(*) from public.products_summary p
                     where p.business_id = biz.id and p.kind <> 'service' and not p.archived and p.quantity > 0),
        'out_of_stock', (select count(*) from public.products_summary p
                         where p.business_id = biz.id and p.kind <> 'service' and not p.archived and p.quantity <= 0),
        'value', (select coalesce(round(sum(p.quantity * coalesce(p.average_cost, 0))), 0)::bigint
                  from public.products_summary p
                  where p.business_id = biz.id and p.kind <> 'service' and p.quantity > 0)
    )
  ) into result;
  return result;
end;
$$;
