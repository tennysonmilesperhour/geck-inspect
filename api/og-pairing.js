/**
 * Temporary static Open Graph preview for shared pairing links.
 *
 * The vulnerable renderer is disabled until its patched replacement is
 * verified on Vercel Edge. Existing share URLs and pairing calculations
 * continue to work; this endpoint sends preview crawlers to the site's
 * static Open Graph image.
 */
export const config = { runtime: 'edge' };

export default function handler(req) {
  return Response.redirect(new URL('/og-image.png', req.url), 307);
}
