import { describe, expect, it } from 'vitest';
import {
  blueskyFacets, blueskyPostRecord, isDirectPlatform as serverIsDirect, normalizeBlueskyHandle,
  pickConnection, shouldChargePublish, trimForBluesky,
} from '../../../supabase/functions/_shared/promote';
import {
  PLATFORMS, isDirectPlatform, publishErrorMessage, connectionErrorMessage,
  normalizeBlueskyHandle as clientNormalize,
} from '../socialMedia';

describe('D8: Bluesky direct, everything else copy-out', () => {
  it('posts directly only to Bluesky, on both server and client', () => {
    for (const p of PLATFORMS) {
      expect(serverIsDirect(p.key)).toBe(p.key === 'bluesky');
      expect(isDirectPlatform(p.key)).toBe(p.key === 'bluesky');
    }
  });

  it('never charges a copy, and charges a real post for members only', () => {
    expect(shouldChargePublish({ statusOnSuccess: 'copied', isAdmin: false })).toBe(false);
    expect(shouldChargePublish({ statusOnSuccess: 'published', isAdmin: false })).toBe(true);
    expect(shouldChargePublish({ statusOnSuccess: 'published', isAdmin: true })).toBe(false);
  });
});

describe('pickConnection', () => {
  const pageA = { id: 'a', updated_date: '2026-09-01T00:00:00Z' };
  const pageB = { id: 'b', updated_date: '2026-09-20T00:00:00Z' };

  it('works with two Facebook Pages (the old maybeSingle bug)', () => {
    expect(pickConnection([pageA, pageB])?.id).toBe('b');
    expect(pickConnection([pageA, pageB], 'a')?.id).toBe('a');
  });

  it('returns null for none, or for a connection that is not the member\'s', () => {
    expect(pickConnection([])).toBeNull();
    expect(pickConnection(null)).toBeNull();
    expect(pickConnection([pageA], 'someone-else')).toBeNull();
  });
});

describe('Bluesky post record', () => {
  it('normalizes handles the same way on both sides', () => {
    for (const raw of ['@Lilly.bsky.social', ' lilly.bsky.social ', 'https://bsky.app/profile/lilly.bsky.social/post/1']) {
      expect(normalizeBlueskyHandle(raw)).toBe('lilly.bsky.social');
      expect(clientNormalize(raw)).toBe('lilly.bsky.social');
    }
  });

  it('keeps short text as is and trims long text to 300 graphemes', () => {
    expect(trimForBluesky('Harlequin hatchling')).toBe('Harlequin hatchling');
    const long = 'Lilly White '.repeat(40);
    const out = trimForBluesky(long);
    expect(Array.from(out).length).toBeLessThanOrEqual(300);
    expect(out.endsWith('…')).toBe(true);
  });

  it('counts an emoji as one character', () => {
    const text = '\u{1F98E}'.repeat(300);
    expect(trimForBluesky(text)).toBe(text);
  });

  it('makes hashtags and links clickable with UTF-8 byte offsets', () => {
    const text = 'Café Phantom #crestedgecko see https://geckinspect.com/p/1 #lillywhite';
    const facets = blueskyFacets(text);
    const bytes = new TextEncoder().encode(text);
    const slice = (f) => new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd));
    expect(facets.map(slice)).toEqual(['#crestedgecko', 'https://geckinspect.com/p/1', '#lillywhite']);
    expect(facets[0].features[0]).toEqual({ $type: 'app.bsky.richtext.facet#tag', tag: 'crestedgecko' });
    expect(facets[1].features[0].$type).toBe('app.bsky.richtext.facet#link');
  });

  it('builds a valid post record', () => {
    const rec = blueskyPostRecord('Axanthic #cresties', new Date('2026-10-03T00:00:00Z'));
    expect(rec.$type).toBe('app.bsky.feed.post');
    expect(rec.createdAt).toBe('2026-10-03T00:00:00.000Z');
    expect(rec.facets).toHaveLength(1);
    expect(blueskyPostRecord('No tags here').facets).toBeUndefined();
  });
});

describe('member-facing errors', () => {
  it('never shows raw codes or setup instructions', () => {
    expect(publishErrorMessage('publish_failed', 'bluesky_auth_failed: {"error":"AuthenticationRequired"}'))
      .toMatch(/Reconnect Bluesky/);
    expect(publishErrorMessage('platform_not_connected')).toMatch(/Connect your Bluesky/);
    expect(publishErrorMessage('weird_code')).not.toMatch(/weird_code/);
    expect(connectionErrorMessage('encryption_failed')).not.toMatch(/secret|Supabase|PLATFORM/i);
  });
});
