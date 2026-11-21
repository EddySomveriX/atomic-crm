-- Indexes on business_id where row level security filters without one, and
-- member actions closed to visitors who are not signed in

create index if not exists certificate_uses_business_id_idx on public.certificate_uses using btree (business_id);
create index if not exists client_packages_business_id_idx on public.client_packages using btree (business_id);
create index if not exists packages_business_id_idx on public.packages using btree (business_id);
create index if not exists price_history_business_id_idx on public.price_history using btree (business_id);
create index if not exists specialist_prices_business_id_idx on public.specialist_prices using btree (business_id);
create index if not exists messages_business_id_idx on public.messages using btree (business_id);
create index if not exists post_targets_business_id_idx on public.post_targets using btree (business_id);
create index if not exists staff_link_codes_business_id_idx on public.staff_link_codes using btree (business_id);
create index if not exists staff_notifications_business_id_idx on public.staff_notifications using btree (business_id);
create index if not exists user_invitations_business_id_idx on public.user_invitations using btree (business_id);

revoke all on function public.team_report(date, date) from public, anon;
grant execute on function public.team_report(date, date) to authenticated, service_role;
revoke all on function public.close_day(date) from public, anon;
grant execute on function public.close_day(date) to authenticated, service_role;
revoke all on function public.set_member_commission(bigint, numeric) from public, anon;
grant execute on function public.set_member_commission(bigint, numeric) to authenticated, service_role;
revoke all on function public.create_staff_link_code() from public, anon;
grant execute on function public.create_staff_link_code() to authenticated, service_role;
