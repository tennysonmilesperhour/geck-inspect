import { affectedUsers, authorizationMatches, validEvent, type RevenueCatEvent } from "../_shared/revenuecat.ts";

type Dependencies = {
  authorization: string;
  apiKey: string;
  fetchEntitlements: (id: string, event: RevenueCatEvent) => Promise<unknown[]>;
  alreadyReceived: (id: string) => Promise<boolean>;
  applyEvent: (payload: unknown, rows: unknown[]) => Promise<boolean>;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

/** Commit the receipt and every affected owner together, or let RC retry. */
export function createWebhookHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!deps.authorization || !deps.apiKey) return json({ error: "server_misconfigured" }, 500);
    if (!authorizationMatches(req.headers.get("authorization") || "", deps.authorization)) {
      return json({ error: "unauthorized" }, 401);
    }
    let payload;
    try { payload = await req.json(); }
    catch { return json({ error: "invalid_json" }, 400); }
    if (!validEvent(payload?.event)) return json({ error: "invalid_event" }, 400);
    const event = payload.event;
    try {
      if (await deps.alreadyReceived(event.id)) return json({ ok: true, duplicate: true });
      // Dashboard TEST proves delivery and authorization, but must never grant membership.
      const users = event.type === "TEST" ? [] : affectedUsers(event);
      const rows = (await Promise.all(users.map((id) => deps.fetchEntitlements(id, event)))).flat();
      const applied = await deps.applyEvent(payload, rows);
      return json({ ok: true, duplicate: !applied, synced: applied ? rows.length : 0 });
    } catch (error) {
      console.error("[revenuecat-webhook] reconciliation failed", event.id, error instanceof Error ? error.message : "database error");
      return json({ error: "reconciliation_failed" }, 500);
    }
  };
}
