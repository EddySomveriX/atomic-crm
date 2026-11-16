-- The client card reads the reliability choice, the personal discount and
-- the birthday through companies_summary
create or replace view public.companies_summary with (security_invoker = on) as
select
    c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    c.kind,
    c.roles,
    c.country_code,
    c.requisites,
    c.vat_id,
    c.vat_status,
    c.vat_checked_at,
    c.currency,
    c.payment_terms_days,
    c.credit_limit,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts,
    c.reliability_override,
    c.personal_discount,
    c.birth_date
from public.companies c
    left join public.deals d on c.id = d.company_id
    left join public.contacts co on c.id = co.company_id
group by c.id;
