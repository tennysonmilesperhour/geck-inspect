-- Deleting a feeding group left its geckos pointing at a group that no
-- longer existed (22 geckos after three groups were deleted in Sep 2026).
-- Clear those links, then let the database do it from now on: deleting a
-- group sets feeding_group_id to null on its geckos.

update public.geckos g
   set feeding_group_id = null
 where g.feeding_group_id is not null
   and not exists (select 1 from public.feeding_groups f where f.id = g.feeding_group_id);

alter table public.geckos
  drop constraint if exists geckos_feeding_group_id_fkey;
alter table public.geckos
  add constraint geckos_feeding_group_id_fkey
  foreign key (feeding_group_id) references public.feeding_groups(id)
  on delete set null;

create index if not exists geckos_feeding_group_id_idx
  on public.geckos (feeding_group_id)
  where feeding_group_id is not null;
