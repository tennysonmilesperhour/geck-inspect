// Who is calling an edge function, shared by the functions.
//
// Two kinds of caller recur:
//   - a signed-in member, proven by the session token the app sends;
//   - the server itself: code holding the service-role key, or a database
//     trigger or scheduled job sending the notification dispatch secret
//     from the Vault (checked by verify_notification_dispatch_secret(),
//     which only the service role may run, so the secret never leaves the
//     database).
// Before October 2026 about twenty functions repeated these checks by
// hand. Functions changed since use these helpers.
import { createClient, type SupabaseClient, type User } from "./supabase.ts";
import { bearerToken } from "./http.ts";

/** Compares two secrets in time that does not depend on where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface SignedInCaller {
  user: User;
  token: string;
  /** A client that acts as this member, so database rules and auth.uid() apply. */
  client: SupabaseClient;
}

/**
 * The signed-in member making this request, or null. `apiKey` is the key
 * the member's client is made with: the anon key when the function then
 * calls database functions as the member, the service-role key when it
 * only needs to know who is asking. The token is checked with the auth
 * server, so an expired or forged token gives null.
 */
export async function signedInCaller(
  req: Request,
  { supabaseUrl, apiKey }: { supabaseUrl: string; apiKey: string },
): Promise<SignedInCaller | null> {
  const token = bearerToken(req);
  if (!token || !supabaseUrl || !apiKey) return null;
  const client = createClient(supabaseUrl, apiKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, token, client };
}

/**
 * True when the request comes from the server side: the service-role key,
 * or the notification dispatch secret the database's own jobs send. Any
 * failure of the check counts as "no".
 */
export async function isTrustedServerCaller(
  token: string,
  { supabaseUrl, serviceRoleKey }: { supabaseUrl: string; serviceRoleKey: string },
): Promise<boolean> {
  if (!token) return false;
  if (serviceRoleKey && constantTimeEqual(token, serviceRoleKey)) return true;
  if (!supabaseUrl || !serviceRoleKey) return false;
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc("verify_notification_dispatch_secret", { p_secret: token });
    if (error) {
      console.warn("dispatch secret check failed", error);
      return false;
    }
    return data === true;
  } catch (err) {
    console.warn("dispatch secret check threw", err);
    return false;
  }
}
