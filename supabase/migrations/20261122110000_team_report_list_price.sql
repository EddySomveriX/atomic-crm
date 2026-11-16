-- The team report counts the list price of bookings made before the price
-- list, like the analytics do
CREATE OR REPLACE FUNCTION "public"."team_report"("p_from" "date", "p_to" "date") RETURNS TABLE("sales_id" bigint, "first_name" "text", "last_name" "text", "visits" bigint, "no_shows" bigint, "revenue" bigint, "commission_percent" numeric, "commission" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    with business as (
        select b.id, b.timezone from public.businesses b where b.id = public.current_business_id()
    ),
    visits as (
        select bk.sales_id,
               count(*) filter (where bk.status = 'completed') as visits,
               count(*) filter (where bk.status = 'no_show') as no_shows,
               -- Bookings made before the price list keep no price: the list price counts
               coalesce(sum(coalesce(bk.price, p.price)) filter (where bk.status = 'completed'), 0)::bigint as revenue
        from public.bookings bk
        join business on bk.business_id = business.id
        left join public.products p on p.id = bk.product_id
        where true
          and (bk.starts_at at time zone business.timezone)::date between p_from and p_to
        group by bk.sales_id
    )
    select s.id, s.first_name, s.last_name,
           coalesce(v.visits, 0), coalesce(v.no_shows, 0), coalesce(v.revenue, 0),
           m.commission_percent,
           round(coalesce(v.revenue, 0) * coalesce(m.commission_percent, 0) / 100)::bigint
    from public.members m
    join business on business.id = m.business_id
    join public.sales s on s.user_id = m.user_id
    left join visits v on v.sales_id = s.id
    where (not m.disabled or v.visits > 0)
      and (public.can_manage_booking() or s.user_id = auth.uid())
    order by coalesce(v.revenue, 0) desc, s.first_name
$$;
