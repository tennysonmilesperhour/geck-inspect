-- RLS consolidation, batch 7: blog tables (5 Sep 2026).
-- Plan: docs/planning/rls-policy-consolidation.md
-- blog_categories, blog_posts and blog_tags had *_admin_all (FOR ALL,
-- is_blog_admin) plus *_public_read. Blog admins need to see drafts, so
-- the single SELECT is "public condition or blog admin"; admin write is
-- INSERT, UPDATE and DELETE. Idempotent.

drop policy if exists blog_categories_admin_all on public.blog_categories;
drop policy if exists blog_categories_public_read on public.blog_categories;
drop policy if exists blog_categories_select on public.blog_categories;
create policy blog_categories_select on public.blog_categories for select to anon, authenticated
  using (is_active = true or public.is_blog_admin());

drop policy if exists blog_tags_admin_all on public.blog_tags;
drop policy if exists blog_tags_public_read on public.blog_tags;
drop policy if exists blog_tags_select on public.blog_tags;
create policy blog_tags_select on public.blog_tags for select to anon, authenticated
  using (is_active = true or public.is_blog_admin());

drop policy if exists blog_posts_admin_all on public.blog_posts;
drop policy if exists blog_posts_public_read on public.blog_posts;
drop policy if exists blog_posts_select on public.blog_posts;
create policy blog_posts_select on public.blog_posts for select to anon, authenticated
  using (
    (status = 'published'::blog_post_status and (published_at is null or published_at <= now()))
    or public.is_blog_admin()
  );

do $$
declare
  t text;
begin
  foreach t in array array['blog_categories', 'blog_tags', 'blog_posts'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_admin', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_admin', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_admin', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_blog_admin())', t || '_insert_admin', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin())', t || '_update_admin', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_blog_admin())', t || '_delete_admin', t);
  end loop;
end $$;
