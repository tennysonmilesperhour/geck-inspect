-- Explicit projection prevents future account columns becoming public by accident.
-- Email is retained for authenticated messaging and for callers who already know
-- the address. Anonymous directory browsing does not enumerate contact addresses.
create or replace function public.read_profiles(p_emails text[] default null)
returns setof public.profiles language sql stable security definer set search_path = '' as $$
  select r.* from public.profiles p
  cross join lateral jsonb_populate_record(null::public.profiles,
    case when p.email = auth.email() or public.is_admin() then to_jsonb(p)
    else jsonb_build_object(
      'id',p.id,'email',case when auth.uid() is not null or p.email = any(p_emails) then p.email else null end,
      'full_name',p.full_name,'business_name',p.business_name,'bio',p.bio,
      'profile_image_url',p.profile_image_url,'cover_image_url',p.cover_image_url,
      'website_url',p.website_url,'instagram_handle',p.instagram_handle,
      'facebook_url',p.facebook_url,'youtube_url',p.youtube_url,'tiktok_handle',p.tiktok_handle,
      'is_expert',p.is_expert,'is_public_profile',p.is_public_profile,
      'privacy_show_collection',p.privacy_show_collection,'privacy_show_activity',p.privacy_show_activity,
      'membership_tier',p.membership_tier,'total_points',p.total_points,
      'is_featured_breeder',p.is_featured_breeder,'store_policy',p.store_policy,
      'created_date',p.created_date,'looking_for',p.looking_for
    ) end
  ) r
  where (p.is_public_profile = true or p.email = auth.email() or public.is_admin())
    and (p_emails is null or p.email = any(p_emails));
$$;
revoke all on function public.read_profiles(text[]) from public;
grant execute on function public.read_profiles(text[]) to anon, authenticated;
