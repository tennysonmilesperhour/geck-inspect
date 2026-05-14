// Supabase Edge Function — publish-social-post
//
// Publishes a social_post_variant to its target platform and bills the user.
// In v1 we directly post to Bluesky (app-password auth, no OAuth required).
// All other platforms are recorded as `status = 'copied'` and quotas are
// still deducted; copy-to-clipboard counts as a publish for billing
// purposes since the user committed to the post.
//
// Token decryption: access_token_ciphertext (+ access_token_iv) hold the
// AES-GCM encrypted app password from set-platform-connection. We fall
// back to plaintext access_token for legacy rows.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PLATFORM_KEY_B64 = Deno.env.get("PLATFORM_CONNECTIONS_KEY") || "";

const OVERAGE_CENTS_PER_POST = 50;

const TIER_INCLUDED: Record<string, number> = {
  free: 1,
  keeper: 4,
  breeder: 12,
  enterprise: 30,
};

const DIRECT_POST_PLATFORMS = new Set(["bluesky", "facebook_page", "instagram", "reddit"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function tierOf(profile: { membership_tier?: string | null; subscription_status?: string | null } | null): string {
  if (!profile) return "free";
  if (profile.subscription_status === "grandfathered") return "breeder";
  const t = profile.membership_tier || "";
  return ["free", "keeper", "breeder", "enterprise"].includes(t) ? t : "free";
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function decryptToken(ciphertextB64: string, ivB64: string): Promise<string> {
  if (!PLATFORM_KEY_B64) throw new Error("PLATFORM_CONNECTIONS_KEY not configured");
  const rawKey = b64decode(PLATFORM_KEY_B64);
  if (rawKey.byteLength !== 32) throw new Error("PLATFORM_CONNECTIONS_KEY must decode to 32 bytes");
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(ivB64) },
    key,
    b64decode(ciphertextB64),
  );
  return new TextDecoder().decode(pt);
}

// Post text to a Facebook Page using the page-specific access token
// returned from /me/accounts during OAuth. Photo posts would hit
// {page_id}/photos with a `url` field; v1 ships text-only since the
// composer doesn't pass an image URL through yet.
async function postToFacebookPage(
  pageId: string,
  pageToken: string,
  message: string,
): Promise<{ id: string; postUrl: string }> {
  const params = new URLSearchParams({ message, access_token: pageToken });
  const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`facebook_post_failed: ${err.slice(0, 300)}`);
  }
  const body = await res.json() as { id: string };
  // id is `{page_id}_{post_id}`. Derive the public URL.
  return { id: body.id, postUrl: `https://www.facebook.com/${body.id.replace("_", "/posts/")}` };
}

// Two-step IG publish: create a media container, then publish it.
// Requires a publicly-fetchable image URL — Meta will not accept binary
// uploads on this API. Caller must provide one or the post fails.
//
// IG convention: hashtags are dumped into the first comment rather than
// the caption itself, so the caption reads cleanly above the fold and
// the tags still register for discovery. If `firstCommentHashtags` is
// non-empty, we post it as a comment on the new media; failures there
// don't roll back the publish (the post itself already succeeded).
async function postToInstagram(
  igUserId: string,
  pageToken: string,
  caption: string,
  imageUrl: string,
  firstCommentHashtags: string,
): Promise<{ id: string; postUrl: string }> {
  // 1) create container
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: pageToken,
  });
  const containerRes = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: containerParams.toString(),
  });
  if (!containerRes.ok) {
    const err = await containerRes.text();
    throw new Error(`instagram_container_failed: ${err.slice(0, 300)}`);
  }
  const container = await containerRes.json() as { id: string };

  // 2) publish container
  const publishParams = new URLSearchParams({
    creation_id: container.id,
    access_token: pageToken,
  });
  const publishRes = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishParams.toString(),
  });
  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`instagram_publish_failed: ${err.slice(0, 300)}`);
  }
  const published = await publishRes.json() as { id: string };

  // Drop the hashtag block as comment #1 if we have one. Best-effort —
  // a failure here doesn't roll back the publish above.
  if (firstCommentHashtags.trim()) {
    try {
      const commentParams = new URLSearchParams({
        message: firstCommentHashtags.trim(),
        access_token: pageToken,
      });
      await fetch(`https://graph.facebook.com/v18.0/${published.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: commentParams.toString(),
      });
    } catch (e) {
      console.warn("ig_first_comment_failed", (e as Error).message);
    }
  }

  return { id: published.id, postUrl: `https://www.instagram.com/p/${published.id}` };
}

// Reddit posting. Uses the user's OAuth access_token to submit a
// self-post (text-only) to a target subreddit. If the access token is
// expired and we have a refresh_token, we trade for a fresh one first.
// Reddit requires a User-Agent header on every call.
const REDDIT_USER_AGENT = Deno.env.get("REDDIT_USER_AGENT") || "web:com.geckinspect:v1";
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID") || "";
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET") || "";

async function refreshRedditToken(refreshToken: string): Promise<string | null> {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) return null;
  const basic = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) return null;
  const body = await res.json() as { access_token?: string };
  return body.access_token || null;
}

async function postToReddit(
  accessToken: string,
  subreddit: string,
  title: string,
  body: string,
): Promise<{ id: string; postUrl: string }> {
  // Reddit's submit endpoint expects sr WITHOUT the r/ or u/ prefix
  // for subreddits, but with the u_ prefix for user profile posts.
  // The connection stores `default_subreddit` already in the right
  // form (e.g. "u_geckinspect" or "CrestedGecko").
  const sr = subreddit.replace(/^r\//, "").replace(/^u\//, "u_").trim();
  const params = new URLSearchParams({
    sr,
    kind: "self",
    title: title.slice(0, 300),
    text: body || "",
    api_type: "json",
    resubmit: "true",
  });
  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`reddit_post_failed: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json() as {
    json?: { errors?: string[][]; data?: { url?: string; id?: string; name?: string } };
  };
  const errors = data?.json?.errors || [];
  if (errors.length > 0) {
    throw new Error(`reddit_post_rejected: ${JSON.stringify(errors).slice(0, 300)}`);
  }
  const url = data?.json?.data?.url || "";
  const id = data?.json?.data?.name || data?.json?.data?.id || "";
  return { id, postUrl: url };
}

async function postToBluesky(
  identifier: string,
  appPassword: string,
  text: string,
): Promise<{ uri: string; cid: string; postUrl: string }> {
  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password: appPassword }),
  });
  if (!sessionRes.ok) {
    const err = await sessionRes.text();
    throw new Error(`bluesky_auth_failed: ${err.slice(0, 300)}`);
  }
  const session = await sessionRes.json() as { accessJwt: string; did: string; handle: string };

  const trimmed = text.length > 300 ? text.slice(0, 297) + "…" : text;

  const recordRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: trimmed,
        createdAt: new Date().toISOString(),
        langs: ["en"],
      },
    }),
  });
  if (!recordRes.ok) {
    const err = await recordRes.text();
    throw new Error(`bluesky_post_failed: ${err.slice(0, 300)}`);
  }
  const record = await recordRes.json() as { uri: string; cid: string };
  // uri looks like at://did:plc:xxxxx/app.bsky.feed.post/abc123 — derive a public URL
  const rkey = record.uri.split("/").pop();
  const postUrl = `https://bsky.app/profile/${session.handle}/post/${rkey}`;
  return { uri: record.uri, cid: record.cid, postUrl };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

interface PublishRequest {
  variant_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "no_jwt" }, 401);

  const supaAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await supaAuth.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "auth_failed" }, 401);
  const user = userData.user;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: PublishRequest;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body.variant_id) return json({ error: "variant_id_required" }, 400);

  // Load the variant + parent post + verify ownership.
  const { data: variant, error: variantErr } = await supabase
    .from("social_post_variants")
    .select("id, post_id, platform, content, hashtags, cta, image_ids, status")
    .eq("id", body.variant_id)
    .maybeSingle();
  if (variantErr || !variant) return json({ error: "variant_not_found" }, 404);
  if (variant.status === "published" || variant.status === "copied") {
    return json({ error: "variant_already_published" }, 409);
  }

  const { data: post } = await supabase
    .from("social_posts")
    .select("id, created_by_user_id, gecko_id")
    .eq("id", variant.post_id)
    .maybeSingle();
  if (!post) return json({ error: "post_not_found" }, 404);
  if (post.created_by_user_id !== user.id) return json({ error: "forbidden" }, 403);

  // Resolve the user's tier + Stripe state to decide if the Free-tier
  // payment-method gate should fire.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, membership_tier, subscription_status, social_post_credits, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  // Profiles use string id keyed off the auth user id. If the lookup above
  // missed (some legacy profiles key by email), retry by email.
  let resolvedProfile = profile;
  if (!resolvedProfile) {
    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id, email, role, membership_tier, subscription_status, social_post_credits, stripe_customer_id")
      .eq("email", user.email || "")
      .maybeSingle();
    resolvedProfile = byEmail || null;
  }

  const tier = tierOf(resolvedProfile as Record<string, unknown> | null);
  const includedPosts = TIER_INCLUDED[tier] ?? 1;
  const credits = Number(resolvedProfile?.social_post_credits || 0);
  // Admins bypass all billing gates (payment-method requirement, monthly
  // included caps, overage charging). Keeps the team able to test the
  // full publish path without hitting trial-offer modals or being charged.
  const isAdmin = (resolvedProfile as { role?: string } | null)?.role === "admin";

  // Compose the text we'll actually post (body + hashtags).
  const text = [variant.content, ...(variant.hashtags || []).map((h) => (h.startsWith("#") ? h : `#${h}`))]
    .filter(Boolean).join(variant.platform === "instagram" ? "\n\n" : " ");

  // Free-tier payment-method gate: if free, no credits, and would tip into
  // overage, block with a 402 so the frontend can show the trial offer.
  if (tier === "free" && !isAdmin) {
    const monthKey = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabase
      .from("social_post_usage")
      .select("posts_published, posts_included")
      .eq("user_id", user.id)
      .eq("month_key", monthKey)
      .maybeSingle();
    const used = Number(usage?.posts_published || 0);
    const wouldOverage = credits === 0 && used >= includedPosts;
    if (wouldOverage && !resolvedProfile?.stripe_customer_id) {
      return json({
        error: "payment_method_required",
        requires_payment_method: true,
        offer_keeper_trial: true,
      }, 402);
    }
  }

  // Run the publish step (or fake-publish for non-direct platforms).
  let publishResult: { url?: string; platform_post_id?: string; statusOnSuccess: "published" | "copied" } = {
    statusOnSuccess: "copied",
  };

  if (DIRECT_POST_PLATFORMS.has(variant.platform)) {
    const { data: conn } = await supabase
      .from("social_platform_connections")
      .select("id, platform, account_handle, account_id, access_token, access_token_ciphertext, access_token_iv, metadata, is_active")
      .eq("user_id", user.id)
      .eq("platform", variant.platform)
      .eq("is_active", true)
      .maybeSingle();
    if (!conn?.account_handle) {
      return json({ error: "platform_not_connected", platform: variant.platform }, 400);
    }

    let token: string | null = null;
    if (conn.access_token_ciphertext && conn.access_token_iv) {
      try {
        token = await decryptToken(conn.access_token_ciphertext, conn.access_token_iv);
      } catch (e) {
        return json({ error: "token_decrypt_failed", detail: (e as Error).message }, 500);
      }
    } else if (conn.access_token) {
      token = conn.access_token;
    }
    if (!token) {
      return json({ error: "platform_not_connected", platform: variant.platform }, 400);
    }

    try {
      if (variant.platform === "bluesky") {
        const r = await postToBluesky(conn.account_handle, token, text);
        publishResult = { url: r.postUrl, platform_post_id: r.uri, statusOnSuccess: "published" };
      } else if (variant.platform === "facebook_page") {
        const pageId = conn.account_id || (conn.metadata as { page_id?: string } | null)?.page_id;
        if (!pageId) throw new Error("missing_page_id");
        const r = await postToFacebookPage(pageId, token, text);
        publishResult = { url: r.postUrl, platform_post_id: r.id, statusOnSuccess: "published" };
      } else if (variant.platform === "reddit") {
        // Reddit caption convention is different: there's no hashtag
        // block, the title is what people see in feeds, and the body
        // can be longer-form. We treat the first paragraph (up to the
        // first blank line, max 300 chars) as the title and everything
        // after as the body. The connection's default_subreddit is the
        // target unless we add a per-post override later.
        const subreddit = (conn.metadata as { default_subreddit?: string } | null)?.default_subreddit
          || `u_${conn.account_handle}`;
        const splitAt = variant.content.indexOf("\n\n");
        const title = (splitAt === -1 ? variant.content : variant.content.slice(0, splitAt)).trim();
        const body = (splitAt === -1 ? "" : variant.content.slice(splitAt).trim());

        // Refresh the access token if it's stale and we have a refresh
        // token. Reddit access tokens expire in 1 hour; refresh tokens
        // (with duration=permanent) don't expire.
        let workingToken = token;
        let refreshed: string | null = null;
        if (conn.refresh_token_ciphertext && conn.refresh_token_iv) {
          try {
            const rt = await decryptToken(conn.refresh_token_ciphertext, conn.refresh_token_iv);
            refreshed = await refreshRedditToken(rt);
            if (refreshed) workingToken = refreshed;
          } catch (e) {
            console.warn("reddit_refresh_failed", (e as Error).message);
          }
        }

        const r = await postToReddit(workingToken, subreddit, title || "(post)", body);
        publishResult = { url: r.postUrl, platform_post_id: r.id, statusOnSuccess: "published" };

        // Persist the refreshed token so the next publish doesn't have
        // to refresh again. Best-effort.
        if (refreshed) {
          try {
            const { ciphertext, iv } = await (async () => {
              // We need to encrypt with the same key publish-social-post
              // can decrypt. Reuse the existing decryptToken infra by
              // calling out to the same AES setup.
              const raw = b64decode(Deno.env.get("PLATFORM_CONNECTIONS_KEY") || "");
              if (raw.byteLength !== 32) throw new Error("bad_key");
              const k = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
              const ivb = crypto.getRandomValues(new Uint8Array(12));
              const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivb }, k, new TextEncoder().encode(refreshed));
              let bin = "";
              new Uint8Array(ct).forEach((b) => (bin += String.fromCharCode(b)));
              let ivBin = "";
              ivb.forEach((b) => (ivBin += String.fromCharCode(b)));
              return { ciphertext: btoa(bin), iv: btoa(ivBin) };
            })();
            await supabase
              .from("social_platform_connections")
              .update({
                access_token_ciphertext: ciphertext,
                access_token_iv: iv,
                expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                updated_date: new Date().toISOString(),
              })
              .eq("id", conn.id);
          } catch (e) {
            console.warn("reddit_token_persist_failed", (e as Error).message);
          }
        }
      } else if (variant.platform === "instagram") {
        const igUserId = conn.account_id || (conn.metadata as { ig_business_account_id?: string } | null)?.ig_business_account_id;
        if (!igUserId) throw new Error("missing_ig_business_account_id");
        // Prefer images the user picked from the Promote library; fall
        // back to the gecko's primary photo if none picked. Either way
        // we need a publicly-fetchable URL (Meta won't accept signed).
        let imageUrl: string | null = null;
        const pickedIds = Array.isArray(variant.image_ids) ? variant.image_ids : [];
        if (pickedIds.length > 0) {
          const { data: imgRow } = await supabase
            .from("promote_images")
            .select("public_url")
            .eq("id", pickedIds[0])
            .maybeSingle();
          imageUrl = (imgRow as { public_url?: string } | null)?.public_url || null;
        }
        if (!imageUrl && post.gecko_id) {
          const { data: geckoRow } = await supabase
            .from("geckos")
            .select("image_urls")
            .eq("id", post.gecko_id)
            .maybeSingle();
          const imageUrls = (geckoRow as { image_urls?: string[] } | null)?.image_urls || [];
          imageUrl = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : null;
        }
        if (!imageUrl) throw new Error("instagram_requires_photo");
        const igHashtags = (variant.hashtags || [])
          .map((h: string) => (h.startsWith("#") ? h : `#${h}`))
          .join(" ");
        const r = await postToInstagram(igUserId, token, variant.content, imageUrl, igHashtags);
        publishResult = { url: r.postUrl, platform_post_id: r.id, statusOnSuccess: "published" };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("social_post_variants")
        .update({ status: "failed", publish_error: msg.slice(0, 500), updated_date: new Date().toISOString() })
        .eq("id", variant.id);
      return json({ error: "publish_failed", platform: variant.platform, detail: msg.slice(0, 300) }, 502);
    }
  }

  // Charge the publish (credit > included > overage). Skipped entirely
  // for admins so test publishes don't burn quota or trigger overage.
  let charge: unknown = null;
  if (!isAdmin) {
    const { data: chargeRows } = await supabase.rpc("charge_social_publish", {
      p_user_id: user.id,
      p_tier: tier,
      p_posts_included: includedPosts,
      p_overage_cents_per_post: OVERAGE_CENTS_PER_POST,
    });
    charge = Array.isArray(chargeRows) ? chargeRows[0] : chargeRows;
  }

  // Update the variant + post.
  await supabase
    .from("social_post_variants")
    .update({
      status: publishResult.statusOnSuccess,
      published_at: new Date().toISOString(),
      platform_post_id: publishResult.platform_post_id || null,
      platform_post_url: publishResult.url || null,
      publish_error: null,
      updated_date: new Date().toISOString(),
    })
    .eq("id", variant.id);

  await supabase
    .from("social_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      primary_variant_id: variant.id,
      updated_date: new Date().toISOString(),
    })
    .eq("id", variant.post_id);

  // Record image usage so we can suggest unposted photos next time.
  if (Array.isArray(variant.image_ids) && variant.image_ids.length > 0 && post.gecko_id) {
    const rows = (variant.image_ids as string[]).map((imageId) => ({
      user_id: user.id,
      gecko_id: post.gecko_id,
      gecko_image_id: imageId,
      variant_id: variant.id,
      platform: variant.platform,
    }));
    await supabase.from("social_post_photo_usage").insert(rows).select("id");
  }

  return json({
    ok: true,
    platform: variant.platform,
    status: publishResult.statusOnSuccess,
    platform_post_url: publishResult.url || null,
    charged: charge || null,
  });
});
