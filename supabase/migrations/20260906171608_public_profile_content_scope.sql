-- Resolve public content by profile ID without exposing its private account row
-- or accidentally dropping an undefined email filter on an anonymous profile.
create or replace function public.public_profile_content(p_profile_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles; g jsonb := '[]'; b jsonb := '[]'; s jsonb;
begin
  select * into p from public.profiles where id=p_profile_id and (is_public_profile=true or email=auth.email() or public.is_admin());
  if p.id is null then return null; end if;
  if p.privacy_show_collection is distinct from false then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into g from public.geckos x where x.created_by=p.email and x.is_public=true and x.archived is distinct from true;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into b from public.breeding_plans x where x.created_by=p.email and x.is_public=true;
  end if;
  select jsonb_build_object('slug',slug,'is_published',is_published,'title',title) into s
    from public.breeder_store_pages where owner_email=p.email and is_published=true limit 1;
  return jsonb_build_object('geckos',g,'breeding_plans',b,'store_page',s);
end $$;
revoke all on function public.public_profile_content(text) from public;
grant execute on function public.public_profile_content(text) to anon, authenticated;
