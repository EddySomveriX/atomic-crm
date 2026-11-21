--
-- The weekly report of a business in Telegram: the owner chooses the day,
-- the hour (business time zone) and the members who receive it. The bot of
-- the business sends it to the Telegram chats those members linked
-- (staff_telegram). last_sent_week keeps one report per week.
--

create table public.weekly_reports (
    business_id uuid not null default public.current_business_id() primary key,
    created_at timestamp with time zone not null default now(),
    enabled boolean not null default false,
    -- 1 = Monday ... 7 = Sunday
    weekday smallint not null default 1,
    hour smallint not null default 9,
    -- Members (sales.id) who receive the report
    recipients bigint[] not null default '{}',
    -- Monday of the last week a report was sent about
    last_sent_week date,
    constraint weekly_reports_weekday check (weekday between 1 and 7),
    constraint weekly_reports_hour check (hour between 0 and 23),
    constraint weekly_reports_recipients_count check (cardinality(recipients) <= 50)
);

alter table public.weekly_reports
    add constraint weekly_reports_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

--
-- Access: the team sees the settings, only the owner changes them
--

alter table public.weekly_reports enable row level security;

create policy "Business read" on public.weekly_reports for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Owner insert" on public.weekly_reports for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.is_admin()));
create policy "Owner update" on public.weekly_reports for update to authenticated using (business_id = (select public.current_business_id()) and (select public.is_admin())) with check (business_id = (select public.current_business_id()));

grant select, insert, update on table public.weekly_reports to authenticated;
grant all on table public.weekly_reports to service_role;
