// Supabase Edge Function: market-value-snapshot
//
// Values every member's crested geckos against similar listings and writes
// one public.market_value_daily row per member for today (UTC). The
// Dashboard's Today card, the market brief and the Sunday digest read those
// rows to say how the market moved for the animals a member owns.
//
// It prices with src/lib/traitValuation.js, the same code the Portfolio and
// the gecko pages use, so the daily history and those pages agree. Only the
// market side is valued: each gecko's traits against Geck Data listings at
// its quality tier. Asking prices a member typed in and AI estimates are
// left out, because they do not move with the market.
//
// Callers: pg_cron through public.request_market_value_snapshot() (daily,
// and after a finished MorphMarket scrape), which sends the notifications
// dispatch secret from the Vault. The service-role key also works.
//
// Deploy: supabase functions deploy market-value-snapshot --no-verify-jwt
// (the function checks its caller itself, as send-email does).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import {
  buildTraitValueIndex,
  isCrestedGecko,
  qualityTierFor,
  valueFromTraitTable,
} from "../../../src/lib/traitValuation.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PAGE = 1000;

const GECKO_COLUMNS = [
  "id", "name", "created_by", "species", "sex", "weight_grams", "hatch_date",
  "estimated_hatch_year", "morph_tags", "morphs_traits", "pattern_grade",
  "quality_score", "status", "archived",
].join(",");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearerToken(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
}

// deno-lint-ignore no-explicit-any
async function isAuthorizedCaller(admin: any, provided: string): Promise<boolean> {
  if (!provided) return false;
  if (SERVICE_ROLE_KEY && constantTimeEq(provided, SERVICE_ROLE_KEY)) return true;
  const { data, error } = await admin.rpc("verify_notification_dispatch_secret", {
    p_secret: provided,
  });
  if (error) {
    console.warn("market-value-snapshot: dispatch secret check failed", error);
    return false;
  }
  return data === true;
}

// deno-lint-ignore no-explicit-any
async function pagedRpc(admin: any, fn: string): Promise<any[]> {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.rpc(fn).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// deno-lint-ignore no-explicit-any
async function loadGeckos(admin: any): Promise<any[]> {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("geckos")
      .select(GECKO_COLUMNS)
      .not("created_by", "is", null)
      .or("archived.is.null,archived.eq.false")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Not configured" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  if (!(await isAuthorizedCaller(admin, bearerToken(req)))) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const [tableRows, geckos] = await Promise.all([
      pagedRpc(admin, "trait_value_table"),
      loadGeckos(admin),
    ]);
    const index = buildTraitValueIndex(tableRows);
    if (index.traits.size === 0) {
      // An empty table means the market data failed, not that every gecko
      // is worth nothing. Writing zeros would read as a crash in value.
      return json({ error: "Trait value table came back empty" }, 503);
    }

    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const byOwner = new Map();
    for (const gecko of geckos) {
      if (String(gecko.status || "").toLowerCase() === "sold") continue;
      if (!isCrestedGecko(gecko)) continue;
      const email = String(gecko.created_by).trim().toLowerCase();
      if (!email) continue;
      let acc = byOwner.get(email);
      if (!acc) {
        acc = { geckos: 0, priced: 0, value: 0, low: 0, high: 0, details: [] };
        byOwner.set(email, acc);
      }
      acc.geckos += 1;
      const priced = valueFromTraitTable(gecko, index, qualityTierFor(gecko), now);
      if (!priced) continue;
      acc.priced += 1;
      acc.value += priced.value;
      acc.low += priced.band.p25;
      acc.high += priced.band.p75;
      acc.details.push({
        gecko_id: gecko.id,
        name: gecko.name || null,
        trait: priced.trait,
        level: priced.band.level,
        age_class: priced.ageClass,
        sex_class: priced.sexClass,
        n: priced.band.n,
        p25: priced.band.p25,
        p50: priced.band.p50,
        p75: priced.band.p75,
        value: round2(priced.value),
      });
    }

    const rows = [...byOwner.entries()].map(([email, acc]) => ({
      user_email: email,
      day,
      geckos: acc.geckos,
      priced: acc.priced,
      value: round2(acc.value),
      value_low: round2(acc.low),
      value_high: round2(acc.high),
      details: acc.details,
      updated_date: now.toISOString(),
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin
        .from("market_value_daily")
        .upsert(rows.slice(i, i + 200), { onConflict: "user_email,day" });
      if (error) throw error;
    }

    return json({
      day,
      members: rows.length,
      geckos: rows.reduce((s, r) => s + r.geckos, 0),
      priced: rows.reduce((s, r) => s + r.priced, 0),
    });
  } catch (err) {
    console.error("market-value-snapshot failed", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
