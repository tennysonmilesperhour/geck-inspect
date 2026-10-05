import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rememberSignupCta, getSignupCta, signupCtaProperties } from '../attribution';
import { todayLocalISO } from '../dateUtils';
import { editorialFor, registerBlogPosts } from '../editorial';
import { possessive, careSignupCopy } from '@/components/public/ContentSignupPrompt';

// Plain Node: a minimal window + localStorage for the attribution helpers.
function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

describe('sign-up prompt attribution', () => {
  beforeEach(() => {
    globalThis.window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete globalThis.window;
  });

  it('remembers the last prompt clicked for 7 days', () => {
    const now = Date.UTC(2026, 9, 5);
    rememberSignupCta({ cta: 'morph_mid', page: '/MorphGuide/lilly-white', pageType: 'morph' }, now);
    expect(getSignupCta(now + 60_000)).toMatchObject({ cta: 'morph_mid', page: '/MorphGuide/lilly-white', page_type: 'morph' });
    expect(getSignupCta(now + 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('never stores a claim token from the page path', () => {
    rememberSignupCta({ cta: 'members_only', page: '/claim/secret-token', pageType: 'members_only' });
    expect(getSignupCta().page).toBe('/claim');
  });

  it('flattens into signup_completed properties', () => {
    expect(signupCtaProperties(null)).toEqual({ signup_cta: null });
    expect(signupCtaProperties({ cta: 'calculator', page: '/calculator', page_type: 'calculator' })).toEqual({
      signup_cta: 'calculator',
      signup_cta_page: '/calculator',
      signup_cta_page_type: 'calculator',
    });
  });
});

describe('content prompt copy helpers', () => {
  it('writes possessives the way a keeper would', () => {
    expect(possessive('Lilly White')).toBe("Lilly White's");
    expect(possessive('Super Dalmatians')).toBe("Super Dalmatians'");
  });

  it('has copy for every care category, with a fallback', () => {
    expect(careSignupCopy('breeding').headline).toMatch(/pairing/i);
    expect(careSignupCopy('unknown-category').headline).toBeTruthy();
  });
});

describe('main-script trims', () => {
  it('todayLocalISO pads month and day in local time', () => {
    expect(todayLocalISO(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('editorial dates for blog posts come from the registry, not a static import', () => {
    expect(editorialFor('/blog/not-registered').published).toBe(editorialFor('/blog').published);
    registerBlogPosts([{ slug: 'test-post', datePublished: '2026-04-20', dateModified: '2026-05-01' }]);
    expect(editorialFor('/blog/test-post')).toMatchObject({ published: '2026-04-20', modified: '2026-05-01' });
  });
});
