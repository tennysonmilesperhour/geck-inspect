-- Pin search_path on the trigger and helper functions the Supabase
-- security linter flagged as "role mutable search_path". Without a pinned
-- path a caller could, in theory, shadow now() or to_tsvector with their
-- own schema. All five only touch public tables and pg_catalog builtins.
-- Applied to production by hand as function_search_path_pins on 2026-09-05.

alter function public.store_products_update_search_vector() set search_path = public;
alter function public.admin_tasks_touch_updated_at() set search_path = public;
alter function public.app_settings_touch_updated_at() set search_path = public;
alter function public._blog_touch_updated_date() set search_path = public;
alter function public.next_unvoted_id_candidates(text, integer) set search_path = public;
