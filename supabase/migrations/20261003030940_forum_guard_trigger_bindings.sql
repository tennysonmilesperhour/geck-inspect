-- Plan steps 20 (Forum), 21 (notifications) and 16 (Support), 3 Oct 2026.
-- Applied to production in six parts because the migration tool stalls on
-- long scripts; read them in version order.
--
-- Part 3 of 6: attach the forum guards from part 2.

create or replace trigger forum_posts_guard_update
  before update on public.forum_posts
  for each row execute function public.guard_forum_post_update();

create or replace trigger forum_comments_guard_write
  before insert or update on public.forum_comments
  for each row execute function public.guard_forum_comment_write();
