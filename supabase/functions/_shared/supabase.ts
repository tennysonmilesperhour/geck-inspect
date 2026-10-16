// The one supabase-js the edge functions import, at one pinned version.
//
// Until October 2026 the functions imported supabase-js four ways from two
// registries (esm.sh at 2 and at 2.43.4, JSR at 2 and at 2.103.0), so two
// functions could run different library versions, and an unpinned "@2"
// changed version on its own whenever a function was redeployed. New and
// changed functions import createClient from here instead.
//
// 2.103.0 is the version revenuecat-webhook and revenuecat-sync already run
// in production. To move every function to a newer one, change the version
// below, run `deno check` on each function that imports this file, and
// merge: the Supabase GitHub integration redeploys the functions declared in
// supabase/config.toml. A function that is not declared there keeps the
// version it was last deployed with until someone deploys it.
export { createClient } from "jsr:@supabase/supabase-js@2.103.0";
export type { SupabaseClient, User } from "jsr:@supabase/supabase-js@2.103.0";
