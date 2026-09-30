-- Geck Data visit log: let signed-out visitors record events again
-- (30 Sep 2026).
--
-- The Geck Data site (geck-data.vercel.app) logs page views and errors
-- from the browser into geck_data.user_events and geck_data.error_logs.
-- Both tables have an "anyone insert" row policy, but since they moved into
-- the geck_data schema on 4 Sep the anon role had no INSERT grant, so every
-- signed-out visit was refused without a sound and the log has been empty
-- since 3 Sep. Reading stays admin-only (the existing SELECT policies).

grant insert on geck_data.user_events to anon;
grant insert on geck_data.error_logs to anon;
