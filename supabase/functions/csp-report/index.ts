// Supabase Edge Function: csp-report
//
// Browsers post Content-Security-Policy violation reports here (launch
// review F43). The site has shipped a report-only policy since 4 Sep 2026,
// but report-only mode without a report endpoint reports to nobody: the
// violations only ever showed in the visitor's own console. Each report
// becomes a row in error_logs (created_by = 'csp-report', level 'warn')
// so the decision to enforce the policy can be made on real data:
//
//   select message, url, count(*) from error_logs
//    where created_by = 'csp-report' and created_date > now() - interval '7 days'
//    group by 1, 2 order by 3 desc;
//
// verify_jwt=false. A browser sends these reports on its own, with no
// session and no signature, so there is nothing to verify. Instead the
// function only accepts reports for geckinspect.com documents, keeps at
// most five reports per request, skips a violation already logged in the
// last hour, and the error_logs throttle trigger (audit batch A) caps
// inserts at 20 per reporter per minute. Nothing here returns data.
//
// Accepts both formats browsers use:
//   report-uri (legacy):  { "csp-report": { "document-uri": ..., ... } }
//   report-to (Reporting API): [ { "type": "csp-violation", "body": { "documentURL": ..., ... } } ]

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_DOCUMENT = /^https:\/\/(www\.)?geckinspect\.com(\/|$)/;
const MAX_REPORTS_PER_REQUEST = 5;

function pick(report: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = report[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const raw: unknown[] = Array.isArray(body)
    ? body.map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>).body : null))
    : [body && typeof body === "object" ? ((body as Record<string, unknown>)["csp-report"] ?? body) : null];
  const reports = raw.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object").slice(0, MAX_REPORTS_PER_REQUEST);
  if (reports.length === 0) {
    return new Response(null, { status: 204 });
  }

  // Two clients on purpose. The service role reads error_logs for the
  // dedup check (regular roles cannot read that table). The anon key does
  // the insert so the throttle trigger applies; it skips the service role.
  const reader = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const writer = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);

  for (const report of reports) {
    const documentUri = pick(report, "document-uri", "documentURL");
    if (!ALLOWED_DOCUMENT.test(documentUri)) continue;

    const directive = pick(report, "effective-directive", "violated-directive", "effectiveDirective").slice(0, 80) || "unknown";
    const blocked = pick(report, "blocked-uri", "blockedURL").slice(0, 300);
    const message = `CSP ${directive} blocked ${blocked || "(inline)"}`.slice(0, 1000);
    const url = documentUri.split("?")[0].slice(0, 500);

    // One row per distinct violation per page per hour is enough to decide
    // whether the policy is safe to enforce.
    const { data: recent } = await reader
      .from("error_logs")
      .select("id")
      .eq("created_by", "csp-report")
      .eq("message", message)
      .eq("url", url)
      .gte("created_date", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(1);
    if (recent && recent.length > 0) continue;

    await writer.from("error_logs").insert({
      level: "warn",
      message,
      url,
      user_agent: userAgent,
      context: {
        source: "csp-report",
        directive,
        blocked_uri: blocked,
        source_file: pick(report, "source-file", "sourceFile").slice(0, 300) || null,
        line_number: pick(report, "line-number", "lineNumber") || null,
        disposition: pick(report, "disposition") || null,
        original_policy_length: pick(report, "original-policy", "originalPolicy").length,
      },
      created_by: "csp-report",
    });
  }

  return new Response(null, { status: 204 });
});
