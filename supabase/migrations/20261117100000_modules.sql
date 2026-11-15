-- Modules of a business (see supabase/schemas/17_modules.sql)

alter table public.businesses add column modules text[];
alter table public.businesses
    add constraint businesses_modules check (modules <@ array['chats', 'booking', 'sales', 'stock', 'tasks', 'analytics']);
-- The modules a kind of business usually needs (TZ section 1, templates)
CREATE OR REPLACE FUNCTION "public"."default_modules"("p_business_type" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
    select case p_business_type
        when 'services' then array['chats', 'booking', 'tasks', 'analytics']
        when 'retail' then array['chats', 'sales', 'stock', 'analytics']
        when 'production' then array['sales', 'stock', 'tasks', 'analytics']
        when 'b2b' then array['chats', 'sales', 'tasks', 'analytics']
        else array['chats', 'booking', 'sales', 'stock', 'tasks', 'analytics']
    end
$$;

-- A new business gets the modules of its kind unless it chose them
CREATE OR REPLACE FUNCTION "public"."set_business_modules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.modules := coalesce(new.modules, public.default_modules(new.business_type));
  return new;
end;
$$;

create or replace trigger set_business_modules
    before insert on public.businesses
    for each row execute function public.set_business_modules();

-- Existing businesses get the modules of their kind
update public.businesses set modules = public.default_modules(business_type) where modules is null;
alter table public.businesses alter column modules set not null;

grant all on function public.default_modules(text) to authenticated;
grant all on function public.default_modules(text) to service_role;
grant all on function public.set_business_modules() to authenticated;
grant all on function public.set_business_modules() to service_role;
