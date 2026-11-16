-- The products list shows the days after which a service is repeated
create or replace view public.products_summary with (security_invoker = on) as
select
    p.id,
    p.business_id,
    p.created_at,
    p.kind,
    p.name,
    p.sku,
    p.unit_code,
    p.price,
    p.currency,
    p.vat_rate_code,
    p.barcodes,
    p.description,
    p.archived,
    coalesce((
        select sum(case when m.to_warehouse_id is not null and m.from_warehouse_id is null then m.quantity
                        when m.from_warehouse_id is not null and m.to_warehouse_id is null then -m.quantity
                        else 0 end)
        from public.stock_moves m
        where m.product_id = p.id
    ), 0) as quantity,
    (
        select round(sum(m.quantity * m.unit_cost) / nullif(sum(m.quantity), 0))::bigint
        from public.stock_moves m
        where m.product_id = p.id
          and m.kind = 'receipt'
          and not exists (select 1 from public.stock_moves r where r.reverses_id = m.id)
    ) as average_cost,
    p.duration_minutes,
    p.buffer_minutes,
    p.category,
    p.show_online,
    p.sort_order,
    p.is_addon,
    p.rebook_days
from public.products p;
