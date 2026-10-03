// Disabled. This slug briefly held a one-shot admin utility for ending the
// trial on a single subscription. It was never invoked, and its capability
// token is void. Nothing here touches Stripe or the database.
//
// Safe to delete from the Supabase dashboard (Edge Functions -> admin-end-trial).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() =>
  new Response(JSON.stringify({ error: "This function is disabled." }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
