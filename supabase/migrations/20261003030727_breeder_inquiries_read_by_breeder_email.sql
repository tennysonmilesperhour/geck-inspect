-- Buyer inquiries inbox (step 10), 3 Oct 2026.
--
-- The existing read and update rules on breeder_inquiries match the
-- breeder by profiles.id = auth.uid(), but for 55 of 56 accounts the
-- legacy profiles.id is not the auth id, so breeders could not see their
-- own inquiries (My Listings always showed 0). These rules match on the
-- signed-in email instead. Additive: the old rules stay.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'breeder_inquiries'
                  and policyname = 'breeder_inquiries_read_by_breeder_email') then
    create policy "breeder_inquiries_read_by_breeder_email" on public.breeder_inquiries
      for select to authenticated
      using (lower(breeder_email) = lower((select auth.email())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'breeder_inquiries'
                  and policyname = 'breeder_inquiries_update_by_breeder_email') then
    create policy "breeder_inquiries_update_by_breeder_email" on public.breeder_inquiries
      for update to authenticated
      using (lower(breeder_email) = lower((select auth.email())))
      with check (lower(breeder_email) = lower((select auth.email())));
  end if;
end
$$;
