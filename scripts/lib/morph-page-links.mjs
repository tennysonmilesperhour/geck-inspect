/**
 * The general links at the end of a Morph Guide page's server HTML (the
 * "Keep exploring" list in scripts/prerender.mjs) and the breeding fact
 * for super forms breeders avoid making.
 *
 * Why a module of its own: prerender.mjs needs a built dist/ to run, so a
 * test cannot import it. Keeping these rules here lets a test check them.
 *
 * Before 16 Oct 2026 every morph page offered the price guide and Morph ID,
 * so /MorphGuide/super-lilly-white sent crawlers to "what each morph sells
 * for" and "identify your gecko from a photo" for an animal that never
 * survives. The live page already leaves those out (src/lib/morphNotBred.js).
 *
 * Relative imports only, so Node scripts can import it.
 */
import { notBredStatus } from '../../src/lib/morphNotBred.js';

/** "Breeding: lethal, avoid." for a do-not-breed super, else null. */
export function morphBreedingFact(morph) {
  const status = notBredStatus(morph);
  return status ? `Breeding: ${status.fact.toLowerCase()}.` : null;
}

/**
 * The site-wide links for one morph page, in order. A do-not-breed super
 * gets the safer pairing instead of the price guide and Morph ID, and a
 * lethal one also skips the Quality Scale (no living gecko to grade).
 */
export function morphGeneralLinks(morph) {
  const status = notBredStatus(morph);
  const safe = status
    ? {
      name: status.safeLabel ? `${status.safeLabel}, the safer pairing` : 'Genetics calculator',
      href: status.pairingHref || (status.parent ? `/calculator/${status.parent.slug}` : '/calculator'),
      note: status.safeText || status.title,
    }
    : null;
  return [
    // Anchor text that names the search the Genetics Guide should win.
    { name: 'Crested gecko genetics guide', href: '/GeneticsGuide', note: 'which morphs follow a Punnett square and which are polygenic' },
    safe,
    status ? null : { name: 'Crested gecko price guide', href: '/crested-gecko-price', note: 'what each morph and quality grade sells for' },
    status?.reason === 'lethal' ? null : { name: 'Quality Scale', href: '/QualityScale', note: 'grade your gecko from 0 to 10' },
    status ? null : { name: 'Morph ID', href: '/Recognition', note: 'identify your gecko from a top and a side photo' },
  ].filter(Boolean);
}
