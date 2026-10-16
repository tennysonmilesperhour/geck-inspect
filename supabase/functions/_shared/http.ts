// JSON responses, CORS headers and the bearer token, shared by the edge
// functions.
//
// Before October 2026 each function wrote its own copy of these few lines
// (23 JSON helpers, as many CORS objects), with small differences in
// header names and in what an OPTIONS request got back. Functions changed
// since use these instead. A function keeps its own headers object when it
// needs different ones (csp-report only answers geckinspect.com, for
// example) and passes it in.

/** The CORS headers a browser call from the app needs. */
export const CORS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

/** A JSON response. `headers` are added to the JSON content type. */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/**
 * The answer to a browser's CORS preflight (an OPTIONS request), or null
 * for any other method so the caller goes on. The body is "ok", as the
 * functions have always answered.
 */
export function preflight(req: Request, headers: Record<string, string> = CORS_HEADERS): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers }) : null;
}

/**
 * The token from an "Authorization: Bearer <token>" header ("Bearer" in any
 * letter case), or "" when there is none.
 */
export function bearerToken(req: Request): string {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : "";
}
