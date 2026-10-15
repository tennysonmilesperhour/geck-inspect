// The caller's IP address, for per-network rate limits.
//
// Supabase Edge Functions are reached through Cloudflare. Cloudflare sets
// cf-connecting-ip to the address the connection really came from and
// overwrites any value the caller sent, so it is the one header a caller
// cannot fake.
//
// x-forwarded-for is different: each proxy appends the address it saw to
// whatever list it was handed, so the FIRST entry is whatever the caller
// typed. Taking that entry (as send-breeder-inquiry and
// subscribe-and-send-guides used to) let a script send a new made-up
// address on every request and never hit the network limit. When
// cf-connecting-ip is missing we fall back to the LAST entry, the one
// added by the proxy closest to us, which the caller does not control.
// x-real-ip is ignored for the same reason as the first x-forwarded-for
// entry: nothing guarantees a proxy replaced it.
//
// Returns null when no address is known (a local call), in which case the
// network limit is simply not applied.
export function clientIp(headers: Headers): string | null {
  const cf = (headers.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const forwarded = (headers.get("x-forwarded-for") || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded.length > 0 ? forwarded[forwarded.length - 1] : null;
}
