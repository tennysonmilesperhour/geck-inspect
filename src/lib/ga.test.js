import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from './ga';

describe('sanitizeUrl', () => {
  it('drops everything after # so sign-in tokens never reach analytics', () => {
    expect(sanitizeUrl('https://geckinspect.com/#access_token=abc&refresh_token=def'))
      .toBe('https://geckinspect.com/');
  });

  it('redacts token-like query values and member emails', () => {
    expect(sanitizeUrl('/AuthPortal?code=xyz&next=/MyGeckos'))
      .toBe('/AuthPortal?code=redacted&next=/MyGeckos');
    expect(sanitizeUrl('/PublicProfile?email=a@b.com'))
      .toBe('/PublicProfile?email=redacted');
  });

  it('leaves ordinary paths alone', () => {
    expect(sanitizeUrl('/MorphGuide/lilly-white?tab=genetics'))
      .toBe('/MorphGuide/lilly-white?tab=genetics');
    expect(sanitizeUrl('/AuthPortal?mode=signup&redirect=%2FMyGeckos%3Fadd%3D1'))
      .toBe('/AuthPortal?mode=signup&redirect=%2FMyGeckos%3Fadd%3D1');
    // Names that only start like a token parameter are not touched.
    expect(sanitizeUrl('/Search?tab=market&type=recovery&confirmed=1'))
      .toBe('/Search?tab=market&type=recovery&confirmed=1');
  });

  it('redacts claim and invite tokens in the path', () => {
    expect(sanitizeUrl('https://geckinspect.com/claim/CLAIMTOK?x=1')).toBe('https://geckinspect.com/claim/redacted?x=1');
    expect(sanitizeUrl('/collection-invite/INVITETOK')).toBe('/collection-invite/redacted');
    expect(sanitizeUrl('/AuthPortal?redirect=/claim/CLAIMTOK')).toBe('/AuthPortal?redirect=/claim/redacted');
  });

  // Review of 16 Oct 2026: CollectionInvite.jsx sends a signed-out invitee
  // to /AuthPortal?next=%2Fcollection-invite%2F<token>, and the plain-slash
  // pattern let the token through to GA's page_path and PostHog's
  // $current_url.
  it('redacts claim and invite tokens carried percent-encoded inside ?next= or ?redirect=', () => {
    expect(sanitizeUrl('https://geckinspect.com/AuthPortal?next=%2Fcollection-invite%2FINVITETOKEN42'))
      .toBe('https://geckinspect.com/AuthPortal?next=%2Fcollection-invite%2Fredacted');
    expect(sanitizeUrl('/AuthPortal?redirect=%2Fclaim%2FCLAIMTOK&mode=signup'))
      .toBe('/AuthPortal?redirect=%2Fclaim%2Fredacted&mode=signup');
    expect(sanitizeUrl('/AuthPortal?next=%2fclaim%2fCLAIMTOK%3Fx%3D1'))
      .toBe('/AuthPortal?next=%2fclaim%2fredacted%3Fx%3D1');
    // Encoded twice (a link inside a link inside a link).
    expect(sanitizeUrl('/AuthPortal?next=%252Fcollection-invite%252FINVITETOK'))
      .toBe('/AuthPortal?next=%252Fcollection-invite%252Fredacted');
  });

  it('redacts unsubscribe and waitlist confirmation tokens', () => {
    expect(sanitizeUrl('https://geckinspect.com/Unsubscribe?t=UNSUBTOK'))
      .toBe('https://geckinspect.com/Unsubscribe?t=redacted');
    expect(sanitizeUrl('/waitlist/lilly-white-pairing?confirm=WAITTOK&utm_source=email'))
      .toBe('/waitlist/lilly-white-pairing?confirm=redacted&utm_source=email');
  });

  it('redacts tokens and emails inside an encoded ?next= value', () => {
    expect(sanitizeUrl('/AuthPortal?next=%2FAuthPortal%3Ftoken_hash%3DHASHTOK%26type%3Drecovery'))
      .toBe('/AuthPortal?next=%2FAuthPortal%3Ftoken_hash%3Dredacted%26type%3Drecovery');
    expect(sanitizeUrl('/AuthPortal?redirect=%2FPublicProfile%3Femail%3Dkeeper%2540example.com'))
      .toBe('/AuthPortal?redirect=%2FPublicProfile%3Femail%3Dredacted');
  });
});
