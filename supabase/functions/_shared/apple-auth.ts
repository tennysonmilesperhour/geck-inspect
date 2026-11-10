// Sign in with Apple, server side: swapping the one-time authorization code
// for a refresh token, and revoking that token when the account is deleted.
//
// Why: App Store Review Guideline 5.1.1(v) asks an app that offers Sign in
// with Apple to revoke the member's Apple tokens when they delete their
// account, through Apple's REST API. Revoking needs a token Apple issued
// to us, and the only way to get one is to swap the authorization code the
// phone receives at sign-in. apple-token does that swap and stores the
// refresh token; the delete functions call revokeStoredAppleToken before
// they delete the login.
//
// Apple authenticates these calls with a "client secret": a short-lived
// JWT signed (ES256) with a Sign in with Apple key from the Apple Developer
// account. Secrets (Supabase edge function secrets):
//   APPLE_TEAM_ID      the 10-character Team ID
//   APPLE_KEY_ID       the 10-character Key ID of the Sign in with Apple key
//   APPLE_PRIVATE_KEY  the whole .p8 file, BEGIN and END lines included
//   APPLE_CLIENT_ID    optional, defaults to the iOS bundle id
//
// Nothing here imports supabase-js, so the vitest suite can load it.

export const APPLE_AUDIENCE = "https://appleid.apple.com";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
export const DEFAULT_APPLE_CLIENT_ID = "com.geckinspect.app";
export const APPLE_TOKENS_TABLE = "apple_sign_in_tokens";

export type AppleConfig = {
  teamId: string;
  keyId: string;
  privateKey: string;
  clientId: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The Apple settings from the environment, or null when any is missing. */
export function appleConfigFromEnv(get: (name: string) => string | undefined): AppleConfig | null {
  const teamId = (get("APPLE_TEAM_ID") || "").trim();
  const keyId = (get("APPLE_KEY_ID") || "").trim();
  // Pasted secrets sometimes arrive with literal "\n" instead of line breaks.
  const privateKey = (get("APPLE_PRIVATE_KEY") || "").replace(/\\n/g, "\n").trim();
  const clientId = (get("APPLE_CLIENT_ID") || "").trim() || DEFAULT_APPLE_CLIENT_ID;
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey, clientId };
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlJson(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

/** The DER bytes inside a PEM (.p8) private key. */
export function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  if (!body) throw new Error("The Apple private key is empty.");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The client secret Apple expects: a JWT signed with ES256. WebCrypto's
 * ECDSA signature is already the raw r||s form a JWT uses. Apple allows up
 * to six months; five minutes is plenty for one request.
 */
export async function appleClientSecret(config: AppleConfig, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(config.privateKey).buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = { alg: "ES256", kid: config.keyId, typ: "JWT" };
  const claims = { iss: config.teamId, iat: nowSeconds, exp: nowSeconds + 300, aud: APPLE_AUDIENCE, sub: config.clientId };
  const signingInput = `${base64urlJson(header)}.${base64urlJson(claims)}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

async function appleError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return (data && (data.error_description || data.error)) || `HTTP ${res.status}`;
}

/**
 * The "sub" (Apple's id for the person) inside an id_token. The token came
 * straight from Apple over TLS in answer to our own signed request, so its
 * signature is not checked again here.
 */
export function idTokenSubject(idToken: string): string {
  const payload = (idToken || "").split(".")[1] || "";
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded));
    return typeof claims?.sub === "string" ? claims.sub : "";
  } catch {
    return "";
  }
}

/**
 * Swaps the one-time authorization code for Apple's refresh token, and
 * says whose it is (the id_token's sub), so the caller can check the code
 * belongs to the signed-in member.
 */
export async function exchangeAppleCode(
  code: string,
  config: AppleConfig,
  fetchImpl: FetchLike = fetch,
): Promise<{ refreshToken: string; sub: string }> {
  const form = new URLSearchParams({
    client_id: config.clientId,
    client_secret: await appleClientSecret(config),
    code,
    grant_type: "authorization_code",
  });
  const res = await fetchImpl(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Apple refused the authorization code: ${await appleError(res)}`);
  const data = await res.json().catch(() => ({}));
  const refreshToken = typeof data?.refresh_token === "string" ? data.refresh_token : "";
  if (!refreshToken) throw new Error("Apple did not return a refresh token.");
  return { refreshToken, sub: idTokenSubject(typeof data?.id_token === "string" ? data.id_token : "") };
}

/** Revokes a refresh token, which ends the app's Sign in with Apple link. */
export async function revokeAppleToken(
  refreshToken: string,
  config: AppleConfig,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const form = new URLSearchParams({
    client_id: config.clientId,
    client_secret: await appleClientSecret(config),
    token: refreshToken,
    token_type_hint: "refresh_token",
  });
  const res = await fetchImpl(APPLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Apple did not revoke the token: ${await appleError(res)}`);
}

export type AppleRevokeOutcome = "revoked" | "no_token" | "not_configured" | "failed";

// A service-role supabase-js client. Typed loosely so this file does not
// import supabase-js (the vitest suite loads it) and so either pinned
// version the delete functions use fits.
// deno-lint-ignore no-explicit-any
type TokenTableClient = { from: (table: string) => any };

/**
 * Revokes the member's stored Apple token, if there is one. Never throws:
 * a failure is logged and reported, and the deletion goes on, because
 * keeping an account the member asked to delete is worse than an Apple
 * link that outlives it. The stored row goes with the login (on delete
 * cascade), so call this before deleting the login.
 */
export async function revokeStoredAppleToken(
  admin: TokenTableClient,
  authUserId: string,
  {
    env = (name: string) => (globalThis as { Deno?: { env: { get: (n: string) => string | undefined } } }).Deno?.env.get(name),
    fetchImpl = fetch,
    log = console,
  }: {
    env?: (name: string) => string | undefined;
    fetchImpl?: FetchLike;
    log?: Pick<Console, "warn" | "error">;
  } = {},
): Promise<AppleRevokeOutcome> {
  if (!authUserId) return "no_token";
  try {
    const { data, error } = await admin.from(APPLE_TOKENS_TABLE).select("refresh_token").eq("user_id", authUserId).maybeSingle();
    if (error) {
      log.warn("apple revoke: could not read the stored token", error);
      return "failed";
    }
    const refreshToken = data?.refresh_token || "";
    if (!refreshToken) return "no_token";
    const config = appleConfigFromEnv(env);
    if (!config) {
      log.error("apple revoke: APPLE_TEAM_ID, APPLE_KEY_ID or APPLE_PRIVATE_KEY is not set; the token was not revoked");
      return "not_configured";
    }
    await revokeAppleToken(refreshToken, config, fetchImpl);
    return "revoked";
  } catch (error) {
    log.error("apple revoke: failed", error);
    return "failed";
  }
}
