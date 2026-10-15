// The shareable Morph ID result card (plan item E2 17): the words on the
// card, the public page that social apps read, the sign-up credit, and
// the one-free-a-month allowance agreeing across the app, the edge
// function and the database.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canShareAnalysis,
  cardFromAnalysis,
  isLinkPreviewFetcher,
  shareCardMeta,
  shareCardView,
  shareErrorMessage,
  shareImageUrl,
  shareInviteHref,
  shareUrl,
} from '../morphShareCard';
import { createHandler, shareIdFromRequest, countsAsView } from '../../../api/morph-share.js';
import { TIER_LIMITS } from '../tierLimits';
import { functionSource } from './edgeHarness';

const DASHES = new RegExp('[\\u2013\\u2014]');

// The shapes Morph ID stored in production in October 2026 (scores and
// ids only; every real answer that month was "tentative").
const TENTATIVE_LEAD = {
  primary_morph: 'harlequin',
  genetic_traits: [],
  candidate_morphs: [
    { morph: 'harlequin', score: 58 },
    { morph: 'dalmatian', score: 25 },
    { morph: 'partial_pinstripe', score: 30 },
  ],
  assessment_status: 'tentative',
  confidence_score: 58,
};
const TENTATIVE_TIE = {
  primary_morph: 'pinstripe',
  genetic_traits: [],
  candidate_morphs: [
    { morph: 'pinstripe', score: 62 },
    { morph: 'partial_pinstripe', score: 62 },
    { morph: 'tricolor', score: 13 },
  ],
  assessment_status: 'tentative',
  confidence_score: 62,
};
const STRONG_LILLY = {
  primary_morph: 'harlequin',
  genetic_traits: ['lily_white'],
  candidate_morphs: [{ morph: 'harlequin', score: 88 }, { morph: 'flame', score: 20 }],
  assessment_status: 'best_match',
  confidence_score: 88,
};

describe('the words on a card', () => {
  it('names a clear leader as likely and the rest as possible, without numbers', () => {
    const view = shareCardView(TENTATIVE_LEAD);
    expect(view.headline).toBe('Likely Harlequin');
    expect(view.likely).toEqual(['Harlequin']);
    expect(view.possible).toEqual(['Partial Pinstripe', 'Dalmatian']);
    expect(view.confidence.word).toBe('Moderate confidence');
    expect(view.disclaimer).toBe('Visual traits, not proven genes');
    expect(JSON.stringify(view)).not.toMatch(/\d+\s*%|58|25/);
  });

  it('calls nothing likely when two looks are level', () => {
    const view = shareCardView(TENTATIVE_TIE);
    expect(view.likely).toEqual([]);
    expect(view.headline).toBe('Possibly Pinstripe or Partial Pinstripe');
    expect(view.confidence.level).toBe('low');
    // 13 is too weak to list.
    expect(view.possible).not.toContain('Tricolor');
  });

  it('puts a photo-read gene in likely only when the whole answer is strong', () => {
    const strong = shareCardView(STRONG_LILLY);
    expect(strong.headline).toBe('Likely Lilly White');
    expect(strong.likely).toEqual(['Harlequin', 'Lilly White']);
    expect(strong.confidence.word).toBe('Strong visual match');

    const weak = shareCardView({ ...STRONG_LILLY, assessment_status: 'tentative', candidate_morphs: [{ morph: 'harlequin', score: 55 }] });
    expect(weak.likely).toEqual(['Harlequin']);
    expect(weak.possible).toContain('Lilly White');
  });

  it('drops the percentage some taxonomy labels carry', () => {
    const view = shareCardView({ candidate_morphs: [{ morph: 'full_pinstripe', score: 80 }], assessment_status: 'tentative' });
    expect(view.headline).toBe('Likely Full Pinstripe');
  });

  it('writes social preview text with the disclaimer and no dashes', () => {
    const { title, description } = shareCardMeta(TENTATIVE_LEAD);
    expect(title).toBe('Likely Harlequin crested gecko | Geck Inspect Morph ID');
    expect(description).toContain('Visual traits, not proven genes.');
    expect(description).toContain('Likely: Harlequin.');
    expect(description).toContain('Try Morph ID free');
    for (const card of [TENTATIVE_LEAD, TENTATIVE_TIE, STRONG_LILLY]) {
      expect(JSON.stringify(shareCardMeta(card))).not.toMatch(DASHES);
    }
  });
});

describe('what goes on a card', () => {
  it('keeps ids and scores, never the model text or a bad id', () => {
    const card = cardFromAnalysis({
      ...TENTATIVE_LEAD,
      genetic_traits: ['lily_white', 'Not An Id', '<b>'],
      candidate_morphs: [
        { morph: 'harlequin', score: 58, why: 'private reasoning' },
        { morph: '<script>', score: 99 },
        { morph: 'flame', score: 'NaN-ish' },
      ],
      explanation: 'long text',
    });
    expect(card.genetic_traits).toEqual(['lily_white']);
    expect(card.candidate_morphs).toEqual([{ morph: 'harlequin', score: 58 }]);
    expect(JSON.stringify(card)).not.toMatch(/private|long text|script/);
  });

  it('refuses to share "better photos needed" or an empty answer', () => {
    expect(canShareAnalysis({ ...TENTATIVE_LEAD, assessment_status: 'insufficient_evidence' })).toBe(false);
    expect(canShareAnalysis({ assessment_status: 'tentative' })).toBe(false);
    expect(canShareAnalysis(null)).toBe(false);
    expect(canShareAnalysis(TENTATIVE_LEAD)).toBe(true);
  });

  it('turns database refusals into plain words', () => {
    expect(shareErrorMessage({ message: 'morph_share_bad_photo' })).toMatch(/photo/);
    expect(shareErrorMessage({ message: 'morph_share_rate_limited' })).toMatch(/tomorrow/);
    expect(shareErrorMessage({ message: 'network down' })).toMatch(/try again/i);
  });
});

describe('links', () => {
  it('builds the card address and an invite that carries the card id and UTM tags', () => {
    expect(shareUrl('0123456789abcdef')).toBe('https://geckinspect.com/morph-id/r/0123456789abcdef');
    const href = shareInviteHref('0123456789abcdef', '/AuthPortal', { mode: 'signup' });
    const params = new URL(href, 'https://x.test').searchParams;
    expect(new URL(href, 'https://x.test').pathname).toBe('/AuthPortal');
    expect(params.get('mode')).toBe('signup');
    expect(params.get('ms')).toBe('0123456789abcdef');
    expect(params.get('utm_source')).toBe('morph_id_card');
    // Never the member referral parameter, which means a referral code.
    expect(params.has('ref')).toBe(false);
  });

  it('builds the photo address from the stored path and refuses a climb out', () => {
    expect(shareImageUrl('https://p.supabase.co/', 'uploads/u 1/a.webp'))
      .toBe('https://p.supabase.co/storage/v1/object/public/geck-inspect-media/uploads/u%201/a.webp');
    expect(shareImageUrl('https://p.supabase.co', '../secret')).toBeNull();
    expect(shareImageUrl('https://p.supabase.co', '')).toBeNull();
  });

  it('tells link previews apart from people', () => {
    expect(isLinkPreviewFetcher('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
    expect(isLinkPreviewFetcher('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)')).toBe(true);
    expect(isLinkPreviewFetcher('WhatsApp/2.23.20.0')).toBe(true);
    expect(isLinkPreviewFetcher('')).toBe(true);
    const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const facebookApp = `${iphoneSafari} [FBAN/FBIOS;FBAV/480.0.0.0;FBBV/1;FBDV/iPhone15,2]`;
    expect(isLinkPreviewFetcher(iphoneSafari)).toBe(false);
    // Someone tapping the link inside the Facebook app is a person.
    expect(isLinkPreviewFetcher(facebookApp)).toBe(false);
  });
});

describe('the public share page (api/morph-share.js)', () => {
  const ID = '0123456789abcdef';
  const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const share = {
    id: ID,
    image_path: `uploads/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.webp`,
    card: TENTATIVE_LEAD,
    created_date: '2026-10-16T00:00:00Z',
  };

  function run(answer, ua = SAFARI, path = `/api/morph-share?id=${ID}`) {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
      const out = await answer();
      return new Response(JSON.stringify(out.body), { status: out.status || 200 });
    });
    const handler = createHandler({ fetchImpl, supabaseUrl: 'https://p.supabase.co', anonKey: 'anon' });
    const req = new Request(`https://geckinspect.com${path}`, { headers: { 'user-agent': ua } });
    return { calls, res: handler(req) };
  }

  it('serves the card with a social preview, the disclaimer and an invite', async () => {
    const { calls, res } = run(() => ({ body: share }));
    const response = await res;
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    const html = await response.text();
    expect(html).toContain('<meta property="og:title" content="Likely Harlequin crested gecko | Geck Inspect Morph ID">');
    expect(html).toContain(`<meta property="og:image" content="https://p.supabase.co/storage/v1/object/public/geck-inspect-media/${share.image_path}">`);
    expect(html).toContain(`<meta property="og:url" content="https://geckinspect.com/morph-id/r/${ID}">`);
    expect(html).toContain('Visual traits, not proven genes.');
    expect(html).toContain('Moderate confidence');
    expect(html).toContain(`/Recognition?ms=${ID}&amp;utm_source=morph_id_card`);
    expect(html).toContain(`/AuthPortal?mode=signup&amp;ms=${ID}`);
    expect(html).not.toMatch(DASHES);
    expect(html).not.toContain('<script');
    // Read through the public function with the anon key, counting a person's view.
    expect(calls[0].url).toBe('https://p.supabase.co/rest/v1/rpc/get_morph_id_share');
    expect(calls[0].body).toEqual({ p_id: ID, p_count_view: true });
  });

  it('reads the card for a link preview without counting a view', async () => {
    const { calls, res } = run(() => ({ body: share }), 'facebookexternalhit/1.1');
    expect((await res).status).toBe(200);
    expect(calls[0].body.p_count_view).toBe(false);
  });

  it('does not count a crawler or a prefetch', async () => {
    expect(countsAsView(new Request('https://x.test/', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }))).toBe(false);
    expect(countsAsView(new Request('https://x.test/', { headers: { 'user-agent': SAFARI, 'sec-purpose': 'prefetch' } }))).toBe(false);
    expect(countsAsView(new Request('https://x.test/', { method: 'HEAD', headers: { 'user-agent': SAFARI } }))).toBe(false);
    expect(countsAsView(new Request('https://x.test/', { headers: { 'user-agent': SAFARI } }))).toBe(true);
  });

  it('escapes whatever the card holds', async () => {
    const evil = { ...share, card: { candidate_morphs: [{ morph: '"><script>alert(1)</script>', score: 90 }], assessment_status: 'tentative' } };
    const html = await (await run(() => ({ body: evil }))).res.then((r) => r.text());
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;Script&gt;');
  });

  it('says plainly when a card was deleted, and when it could not load', async () => {
    const gone = await (await run(() => ({ body: null }))).res;
    expect(gone.status).toBe(404);
    expect(await gone.text()).toContain('This card is no longer shared');

    const down = await (await run(() => ({ status: 500, body: { message: 'boom' } }))).res;
    expect(down.status).toBe(503);
    expect(await down.text()).toContain('could not load right now');
  });

  it('never queries the database for a malformed id', async () => {
    const { calls, res } = run(() => ({ body: share }), SAFARI, '/api/morph-share?id=../../etc');
    expect((await res).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('reads the id from the rewritten query or the original path', () => {
    expect(shareIdFromRequest(new URL(`https://x.test/api/morph-share?id=${ID}`))).toBe(ID);
    expect(shareIdFromRequest(new URL(`https://x.test/morph-id/r/${ID}`))).toBe(ID);
    expect(shareIdFromRequest(new URL('https://x.test/morph-id/r/NOTANID'))).toBeNull();
  });
});

describe('routing for the share page', () => {
  it('rewrites /morph-id/r/<id> to the share function before the app shell', () => {
    const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
    const sources = config.rewrites.map((r) => r.source);
    const share = config.rewrites.find((r) => r.source === '/morph-id/r/:id');
    expect(share?.destination).toBe('/api/morph-share?id=:id');
    expect(sources.indexOf('/morph-id/r/:id')).toBeLessThan(sources.indexOf('/(.*)'));
  });

  it('is on the middleware allowlist, so it is not answered with a 404', async () => {
    const { isKnownAppPath } = await import('../../../api/_lib/known-paths.js');
    expect(isKnownAppPath('/morph-id/r/0123456789abcdef')).toBe(true);
  });
});

describe('one free identification a month agrees everywhere', () => {
  const migration = readFileSync(
    new URL('../../../supabase/migrations/20261016120000_morph_id_share_card.sql', import.meta.url),
    'utf8',
  );

  it('is 1 a month on Free in the app, the edge function and the database', () => {
    expect(TIER_LIMITS.free.monthlyMorphIDCredits).toBe(1);
    expect(TIER_LIMITS.free).not.toHaveProperty('lifetimeFreeMorphIDs');
    const edge = functionSource('recognize-gecko-morph');
    const table = edge.match(/const TIER_MORPH_ID_CREDITS[^{]*\{([^}]*)\}/)[1];
    const edgeCredits = Object.fromEntries([...table.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
    for (const tier of ['free', 'keeper', 'breeder', 'enterprise']) {
      expect(edgeCredits[tier]).toBe(TIER_LIMITS[tier].monthlyMorphIDCredits);
    }
    // The database uses 1 for Free whatever the caller passes, and the
    // paid numbers match the app.
    expect(migration).toMatch(/when v_free then 1\s/);
    expect(migration).toMatch(/if v_free then\s+v_monthly := 1;/);
    for (const tier of ['keeper', 'breeder', 'enterprise']) {
      expect(migration).toContain(`when '${tier}' then ${TIER_LIMITS[tier].monthlyMorphIDCredits}`);
    }
  });

  it('grants every new function explicitly', () => {
    for (const fn of ['create_morph_id_share', 'get_morph_id_share', 'record_morph_id_share_signup', 'morph_id_share_card_from']) {
      expect(migration).toMatch(new RegExp(`grant execute on function public\\.${fn}\\(`));
    }
    expect(migration).not.toMatch(DASHES);
  });
});

describe('carrying the card to sign-up (src/lib/morphShareRef.js)', () => {
  let store;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('window', {
      location: { href: 'https://geckinspect.com/AuthPortal?mode=signup&ms=0123456789abcdef&utm_source=morph_id_card' },
      history: { state: null, replaceState: vi.fn() },
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the card id for 30 days and strips it from the address bar', async () => {
    const ref = await import('../morphShareRef');
    expect(ref.captureMorphShareRef(1_000)).toBe('0123456789abcdef');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/AuthPortal?mode=signup&utm_source=morph_id_card');
    expect(ref.getMorphShareRef(1_000 + 29 * 86_400_000)).toBe('0123456789abcdef');
    expect(ref.getMorphShareRef(1_000 + 31 * 86_400_000)).toBeNull();
  });

  it('ignores a malformed id', async () => {
    window.location.href = 'https://geckinspect.com/?ms=<script>';
    const ref = await import('../morphShareRef');
    expect(ref.captureMorphShareRef()).toBeNull();
    expect(ref.getMorphShareRef()).toBeNull();
  });

  it('credits the sign-up once through the database and then forgets the card', async () => {
    const ref = await import('../morphShareRef');
    ref.captureMorphShareRef();
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await ref.creditMorphShareSignup({ rpc })).toBe(true);
    expect(rpc).toHaveBeenCalledWith('record_morph_id_share_signup', { p_share_id: '0123456789abcdef' });
    expect(ref.getMorphShareRef()).toBeNull();
    // Nothing left to credit.
    expect(await ref.creditMorphShareSignup({ rpc })).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('keeps the card when the database call fails, so a later session can retry', async () => {
    const ref = await import('../morphShareRef');
    ref.captureMorphShareRef();
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'offline' } }));
    expect(await ref.creditMorphShareSignup({ rpc })).toBe(false);
    expect(ref.getMorphShareRef()).toBe('0123456789abcdef');
  });
});
