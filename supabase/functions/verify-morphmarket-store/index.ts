// Supabase Edge Function: verify-morphmarket-store
//
// Proves a member owns a MorphMarket store (19 Oct 2026). MorphMarket has
// no sign-in for other apps and no public API, so the member pastes a code
// from Geck Inspect into their store's About text and this function looks
// for it on the public store page. The table and admin functions are in
// supabase/migrations/20261019233000_morphmarket_store_links.sql.
//
// Contract (signed-in members only; the gateway checks the session):
//
//   POST { action: 'start', store }
//     Saves the store (a link or handle) and returns the code to paste. The
//     same store keeps the same code, so asking again never invalidates a
//     code the member already pasted. A different store replaces the row.
//       { status: 'pending', store_slug, code }
//
//   POST { action: 'check' }
//     Fetches the store page and looks for the code:
//       { status: 'verified', store_slug }
//       { status: 'not_found', store_slug, code }    page read, no code
//       { status: 'no_store', store_slug }           MorphMarket says 404
//       { status: 'needs_review', store_slug, code } page could not be read;
//                                                    an admin checks by hand
//     One check per member every 20 seconds.
//
//   POST { action: 'remove' }
//     Deletes the member's row, which takes the badge off their page.
//
// On verification the store link is also saved to the member's profile
// (profiles.morphmarket_url) when that is empty.
//
// Secrets: none beyond SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "../_shared/supabase.ts";
import { signedInCaller } from "../_shared/caller.ts";
import { CORS_HEADERS, json, preflight } from "../_shared/http.ts";
import {
  looksBlocked,
  newVerifyCode,
  pageHasCode,
  parseStoreSlug,
  storeUrl,
} from "../_shared/morphmarketStore.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CHECK_GAP_MS = 20 * 1000;
const FETCH_TIMEOUT_MS = 10 * 1000;

const reply = (body: unknown, status = 200) => json(body, status, CORS_HEADERS);

type FetchResult = { kind: "page"; html: string } | { kind: "missing" } | { kind: "blocked"; detail: string };

async function fetchStorePage(slug: string): Promise<FetchResult> {
  try {
    const res = await fetch(storeUrl(slug), {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "GeckInspectStoreCheck/1.0 (+https://geckinspect.com)",
        Accept: "text/html",
      },
    });
    const html = await res.text();
    if (res.status === 404) return { kind: "missing" };
    if (looksBlocked(res.status, html) || !res.ok) {
      return { kind: "blocked", detail: `MorphMarket answered ${res.status}` };
    }
    return { kind: "page", html };
  } catch (err) {
    return { kind: "blocked", detail: `could not reach MorphMarket (${(err as Error).name})` };
  }
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);

  const caller = await signedInCaller(req, { supabaseUrl: SUPABASE_URL, apiKey: SERVICE_ROLE_KEY });
  if (!caller) return reply({ error: "Sign in first" }, 401);
  const userId = caller.user.id;

  let body: { action?: string; store?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Send JSON" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: row, error: readErr } = await admin
    .from("morphmarket_store_links")
    .select("store_slug, code, status, last_checked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) {
    console.error("read link failed", readErr);
    return reply({ error: "Could not load your MorphMarket store" }, 500);
  }

  if (body.action === "start") {
    const slug = parseStoreSlug(body.store);
    if (!slug) return reply({ error: "Paste your store link, like https://www.morphmarket.com/stores/yourstore/" }, 400);

    const { data: taken } = await admin
      .from("morphmarket_store_links")
      .select("user_id")
      .eq("store_slug", slug)
      .eq("status", "verified")
      .neq("user_id", userId)
      .maybeSingle();
    if (taken) return reply({ error: "That store is already verified to another Geck Inspect account. Contact us if it is yours." }, 409);

    if (row && row.store_slug === slug) {
      return reply({ status: row.status, store_slug: slug, code: row.code });
    }
    const code = newVerifyCode();
    const { error } = await admin.from("morphmarket_store_links").upsert({
      user_id: userId,
      store_slug: slug,
      code,
      status: "pending",
      needs_review: false,
      last_checked_at: null,
      last_check_result: null,
      verified_at: null,
      verified_method: null,
      updated_date: new Date().toISOString(),
    });
    if (error) {
      console.error("save link failed", error);
      return reply({ error: "Could not save your store" }, 500);
    }
    return reply({ status: "pending", store_slug: slug, code });
  }

  if (body.action === "remove") {
    const { error } = await admin.from("morphmarket_store_links").delete().eq("user_id", userId);
    if (error) return reply({ error: "Could not remove your store" }, 500);
    return reply({ status: "removed" });
  }

  if (body.action === "check") {
    if (!row) return reply({ error: "Add your store first" }, 400);
    if (row.status === "verified") return reply({ status: "verified", store_slug: row.store_slug });
    if (row.last_checked_at && Date.now() - new Date(row.last_checked_at).getTime() < CHECK_GAP_MS) {
      return reply({ error: "Give it a few seconds, then check again" }, 429);
    }

    const page = await fetchStorePage(row.store_slug);
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { last_checked_at: now, updated_date: now };
    let result: Record<string, unknown>;

    if (page.kind === "page" && pageHasCode(page.html, row.code)) {
      Object.assign(update, {
        status: "verified",
        needs_review: false,
        verified_at: now,
        verified_method: "automatic",
        last_check_result: "code found",
      });
      result = { status: "verified", store_slug: row.store_slug };
    } else if (page.kind === "page") {
      Object.assign(update, { needs_review: false, last_check_result: "code not on the page" });
      result = { status: "not_found", store_slug: row.store_slug, code: row.code };
    } else if (page.kind === "missing") {
      Object.assign(update, { needs_review: false, last_check_result: "store not found" });
      result = { status: "no_store", store_slug: row.store_slug };
    } else {
      Object.assign(update, { needs_review: true, last_check_result: page.detail });
      result = { status: "needs_review", store_slug: row.store_slug, code: row.code };
    }

    const { error } = await admin.from("morphmarket_store_links").update(update).eq("user_id", userId);
    if (error) {
      // The unique index refuses a second member verifying the same store.
      console.error("save check failed", error);
      return reply({ error: "That store is already verified to another Geck Inspect account." }, 409);
    }

    if (result.status === "verified" && caller.user.email) {
      await admin
        .from("profiles")
        .update({ morphmarket_url: storeUrl(row.store_slug) })
        .eq("email", caller.user.email)
        .or("morphmarket_url.is.null,morphmarket_url.eq.");
    }
    return reply(result);
  }

  return reply({ error: "Unknown action" }, 400);
});
