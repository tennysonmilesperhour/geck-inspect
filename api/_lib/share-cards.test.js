import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_IMAGE,
  breederCard,
  isLinkPreviewBot,
  loadShareCard,
  passportCard,
  renderShareCard,
  shareTargetFor,
  waitlistCard,
} from './share-cards.js';
import middleware from '../../middleware.js';

const IMESSAGE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0';
const DISCORD = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';
const FACEBOOK = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PHOTO = 'https://mmuglfphhwlaluyfyxsp.supabase.co/storage/v1/object/public/geck-inspect-media/luna.jpg';

function fakeFetch(routes) {
  const calls = [];
  const impl = vi.fn(async (url) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([needle]) => url.includes(needle));
    if (!hit) return new Response('[]', { status: 200 });
    const [, body] = hit;
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return { impl, calls };
}

describe('who gets a preview card', () => {
  it('recognises iMessage, Facebook and Discord but never a browser or a search crawler', () => {
    expect(isLinkPreviewBot(IMESSAGE)).toBe(true);
    expect(isLinkPreviewBot(FACEBOOK)).toBe(true);
    expect(isLinkPreviewBot(DISCORD)).toBe(true);
    expect(isLinkPreviewBot('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')).toBe(true);
    expect(isLinkPreviewBot(CHROME)).toBe(false);
    expect(isLinkPreviewBot(GOOGLEBOT)).toBe(false);
    expect(isLinkPreviewBot('')).toBe(false);
  });

  it('does not mistake the Tumblr or Viber in-app browser for a fetcher', () => {
    // A person tapping a link inside these apps must get the app, not the card.
    expect(isLinkPreviewBot('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 Tumblr/38.4.0.110')).toBe(false);
    expect(isLinkPreviewBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Viber/22.8.0')).toBe(false);
  });

  it('looks a breeder up by the lowercase slug, as the breeder page does', () => {
    expect(shareTargetFor('/Breeder/Sunny-Geckos')).toMatchObject({ kind: 'breeder', key: 'sunny-geckos', path: '/Breeder/sunny-geckos' });
    // Passport codes keep their case: the passport page matches them exactly.
    expect(shareTargetFor('/passport/GI-AbC123')).toMatchObject({ key: 'GI-AbC123' });
  });

  it('only for the four shared page kinds, in their canonical spelling', () => {
    expect(shareTargetFor('/passport/GI-ABC123')).toMatchObject({ kind: 'passport', key: 'GI-ABC123' });
    expect(shareTargetFor('/Breeder/sunny-geckos')).toMatchObject({ kind: 'breeder', key: 'sunny-geckos' });
    expect(shareTargetFor('/store/sunny')).toMatchObject({ kind: 'store', key: 'sunny' });
    expect(shareTargetFor('/waitlist/spring-2027')).toMatchObject({ kind: 'waitlist', key: 'spring-2027' });
    for (const path of ['/passport/ABC/qr', '/breeder/x', '/Store/cart', '/passport/a%2Cb', '/passport/a.b', '/MorphGuide/harlequin']) {
      expect(shareTargetFor(path), path).toBeNull();
    }
  });
});

describe('card text', () => {
  it('describes a passport from its public fields', () => {
    const card = passportCard({ name: 'Luna', morphs_traits: 'Lilly White Harlequin', sex: 'Female', hatch_date: '2025-06-01', image_urls: [PHOTO] });
    expect(card.title).toBe('Luna: Crested Gecko Passport');
    expect(card.description).toBe('Lilly White Harlequin crested gecko, female, hatched 2025. Lineage, weights and ownership history on its Geck Inspect passport.');
    expect(card.image).toBe(PHOTO);
  });

  it('drops an image that is not https and escapes every field', () => {
    const card = { ...passportCard({ name: 'Bad "<script>"', image_urls: ['javascript:alert(1)', 'http://x/y.jpg'] }), url: 'https://geckinspect.com/passport/X' };
    expect(card.image).toBeNull();
    const html = renderShareCard(card);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain(`<meta property="og:image" content="${DEFAULT_IMAGE}">`);
    expect(html).not.toMatch(/[\u2013\u2014]/);
  });

  it('uses the breeder bio, or a sentence built from location and specialties', () => {
    expect(breederCard({ display_name: 'Sunny Geckos', bio: 'Small breeder of Lilly White and Axanthic lines.' }).description).toBe('Small breeder of Lilly White and Axanthic lines.');
    const built = breederCard({ display_name: 'Sunny Geckos', location: 'Ohio', specialty_morphs: ['Cappuccino', 'Harlequin'], banner_photo: PHOTO });
    expect(built.description).toBe('Crested geckos from Sunny Geckos in Ohio, working with Cappuccino, Harlequin. Pedigrees, photos and available geckos on Geck Inspect.');
    expect(built.image).toBe(PHOTO);
  });

  it('says when a waitlist is closed', () => {
    const now = new Date('2026-10-16T00:00:00Z');
    expect(waitlistCard({ title: 'Spring 2027', is_open: true, closes_at: '2026-10-01T00:00:00Z' }, null, now).description).toMatch(/^This waitlist is closed\./);
    expect(waitlistCard({ title: 'Spring 2027', is_open: true }, { name: 'Luna', image_urls: [PHOTO] }, now)).toMatchObject({
      title: 'Spring 2027: Waitlist',
      image: PHOTO,
    });
  });
});

describe('loading a card', () => {
  const opts = (impl) => ({ fetchImpl: impl, supabaseUrl: 'https://db.example', anonKey: 'anon' });

  it('asks only for public, published rows', async () => {
    const { impl, calls } = fakeFetch({ 'geckos?': [{ name: 'Luna', morphs_traits: 'Lilly White', image_urls: [PHOTO] }] });
    const card = await loadShareCard(shareTargetFor('/passport/GI-ABC123'), opts(impl));
    expect(card.url).toBe('https://geckinspect.com/passport/GI-ABC123');
    expect(calls[0]).toContain('passport_code=eq.GI-ABC123');
    expect(calls[0]).toContain('is_public=eq.true');
    expect(calls[0]).not.toMatch(/created_by|email|sold_price/);

    const store = fakeFetch({ breeder_store_pages: [{ title: 'Sunny', tagline: 'Lilly Whites' }] });
    await loadShareCard(shareTargetFor('/store/sunny'), opts(store.impl));
    expect(store.calls[0]).toContain('is_published=eq.true');
  });

  it('loads the waitlist gecko photo only when that gecko is public', async () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const { impl, calls } = fakeFetch({ gecko_waitlists: [{ title: 'Spring', is_open: true, gecko_id: id }], 'geckos?': [{ name: 'Luna', image_urls: [PHOTO] }] });
    const card = await loadShareCard(shareTargetFor('/waitlist/spring'), opts(impl));
    expect(card.image).toBe(PHOTO);
    expect(calls[1]).toContain(`id=eq.${id}`);
    expect(calls[1]).toContain('is_public=eq.true');
  });

  it('returns null for a missing row, an error, a timeout or no key', async () => {
    expect(await loadShareCard(shareTargetFor('/passport/NOPE'), opts(fakeFetch({}).impl))).toBeNull();
    expect(await loadShareCard(shareTargetFor('/passport/X'), opts(fakeFetch({ 'geckos?': new Error('down') }).impl))).toBeNull();
    const failing = vi.fn(async () => new Response('no', { status: 500 }));
    expect(await loadShareCard(shareTargetFor('/passport/X'), opts(failing))).toBeNull();
    expect(await loadShareCard(shareTargetFor('/passport/X'), { ...opts(failing), anonKey: '' })).toBeNull();
  });

  it('returns null instead of throwing when the runtime has no AbortSignal.timeout', async () => {
    const original = AbortSignal.timeout;
    AbortSignal.timeout = undefined;
    try {
      const { impl } = fakeFetch({ 'geckos?': [{ name: 'Luna' }] });
      await expect(loadShareCard(shareTargetFor('/passport/X'), opts(impl))).resolves.toBeNull();
    } finally {
      AbortSignal.timeout = original;
    }
  });

  it('queries the breeder by its lowercase slug', async () => {
    const { impl, calls } = fakeFetch({ breeder_profiles: [{ display_name: 'Sunny Geckos' }] });
    const card = await loadShareCard(shareTargetFor('/Breeder/Sunny-Geckos'), opts(impl));
    expect(calls[0]).toContain('custom_slug=eq.sunny-geckos');
    expect(card.url).toBe('https://geckinspect.com/Breeder/sunny-geckos');
  });
});

describe('middleware share cards', () => {
  const card = { title: 'Luna: Crested Gecko Passport', description: 'Lilly White crested gecko.', image: PHOTO, imageAlt: 'Luna', type: 'article', url: 'https://geckinspect.com/passport/GI-ABC123' };

  it('answers a preview fetcher with the gecko card', async () => {
    const loadCard = vi.fn(async () => card);
    const req = new Request('https://geckinspect.com/passport/GI-ABC123', { headers: { 'user-agent': IMESSAGE } });
    const res = await middleware(req, {}, { loadCard });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, max-age=300');
    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Luna: Crested Gecko Passport | Geck Inspect">');
    expect(html).toContain(`<meta property="og:image" content="${PHOTO}">`);
    expect(loadCard).toHaveBeenCalledWith(expect.objectContaining({ kind: 'passport', key: 'GI-ABC123' }));
  });

  it('leaves people, search crawlers and missing cards to the normal app', async () => {
    const loadCard = vi.fn(async () => card);
    const asChrome = await middleware(new Request('https://geckinspect.com/passport/GI-ABC123', { headers: { 'user-agent': CHROME } }), {}, { loadCard });
    expect(asChrome).toBeUndefined();
    const asGoogle = await middleware(new Request('https://geckinspect.com/Breeder/sunny', { headers: { 'user-agent': GOOGLEBOT } }), {}, { loadCard });
    expect(asGoogle).toBeUndefined();
    expect(loadCard).not.toHaveBeenCalled();
    const missing = await middleware(new Request('https://geckinspect.com/store/nope', { headers: { 'user-agent': DISCORD } }), {}, { loadCard: async () => null });
    expect(missing).toBeUndefined();
  });
});
