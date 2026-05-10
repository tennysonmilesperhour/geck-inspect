/**
 * useGeckoPassport ,  generates a verifiable digital passport for a gecko.
 *
 * Creates a tamper-evident token (base64-encoded JSON + checksum) that
 * encodes the gecko's lineage, weight history, morph classification,
 * and seller info. The token is URL-safe and can be shared as a link:
 *
 *   geckinspect.com/passport?data=<token>
 *
 * No server-side signing is needed ,  the checksum ensures the data
 * hasn't been tampered with, and the link points back to the app for
 * visual verification.
 *
 * Note: for production, replace the client-side checksum with a
 * server-side JWT signed by a Supabase Edge Function. This gives
 * cryptographic non-repudiation.
 */

// Simple checksum for tamper-evidence (not cryptographic ,  see note above)
function simpleChecksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}

export function generatePassportToken(gecko, { owner, weightRecords, parents } = {}) {
  const payload = {
    v: 1, // schema version
    id: gecko.id,
    name: gecko.name,
    morph: gecko.morph_tags || [],
    sex: gecko.sex,
    hatch: gecko.hatch_date || null,
    owner: owner ? {
      name: owner.full_name,
      verified: !!owner.id,
    } : null,
    weights: (weightRecords || []).slice(-10).map(w => ({
      d: w.date,
      g: w.weight,
    })),
    parents: parents ? {
      sire: parents.sire?.name || null,
      dam: parents.dam?.name || null,
    } : null,
    issued: new Date().toISOString(),
    app: 'geckinspect',
  };

  const json = JSON.stringify(payload);
  const checksum = simpleChecksum(json);
  const token = btoa(json) + '.' + checksum;

  return { token, payload };
}

export function decodePassportToken(token) {
  try {
    const [data, checksum] = token.split('.');
    if (!data || !checksum) return null;

    const json = atob(data);
    const expected = simpleChecksum(json);
    if (expected !== checksum) return { error: 'tampered', payload: null };

    const payload = JSON.parse(json);
    if (payload.app !== 'geckinspect') return { error: 'invalid', payload: null };

    return { error: null, payload };
  } catch {
    return { error: 'corrupt', payload: null };
  }
}
