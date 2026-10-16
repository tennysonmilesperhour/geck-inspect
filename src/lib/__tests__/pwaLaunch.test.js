import { describe, it, expect } from 'vitest';
import { pwaLaunchTarget } from '@/lib/pwaLaunch';

describe('where an installed app opens', () => {
  it('opens on Today on a phone, from the new start address and from old installs', () => {
    expect(pwaLaunchTarget('/Today', '', true)).toBeNull();
    expect(pwaLaunchTarget('/', '', true)).toBe('/Today');
    expect(pwaLaunchTarget('/Messages', '', true)).toBe('/Today');
    expect(pwaLaunchTarget('/MyGeckos', '', true)).toBe('/Today');
    expect(pwaLaunchTarget('/MyGeckos/', '', true)).toBe('/Today');
  });

  it('keeps desktop installs opening on My Geckos, even with the new start address', () => {
    expect(pwaLaunchTarget('/Today', '', false)).toBe('/MyGeckos');
    expect(pwaLaunchTarget('/', '', false)).toBe('/MyGeckos');
    expect(pwaLaunchTarget('/Messages', '', false)).toBe('/MyGeckos');
    expect(pwaLaunchTarget('/MyGeckos', '', false)).toBeNull();
  });

  it('leaves deep links and other pages alone', () => {
    expect(pwaLaunchTarget('/MyGeckos', '?id=g1', true)).toBeNull();
    expect(pwaLaunchTarget('/Today', '?retired=Promote', false)).toBeNull();
    expect(pwaLaunchTarget('/log', '?type=feeding', true)).toBeNull();
    expect(pwaLaunchTarget('/Breeding', '', false)).toBeNull();
  });
});
