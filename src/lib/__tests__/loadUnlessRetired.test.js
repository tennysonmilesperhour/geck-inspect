import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isPageRetired, loadUnlessRetired } from '../retiredPages';

describe('loadUnlessRetired', () => {
  it('skips the load while the page is retired', async () => {
    expect(isPageRetired('OtherReptiles')).toBe(true);
    const load = vi.fn(async () => [{ id: 'r1' }]);
    await expect(loadUnlessRetired('OtherReptiles', load)).resolves.toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('runs the load for a live page', async () => {
    const load = vi.fn(async () => [{ id: 'g1' }]);
    await expect(loadUnlessRetired('MyGeckos', load)).resolves.toEqual([{ id: 'g1' }]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('the Dashboard and the feeding pop-ups read Other Reptiles through it', () => {
    for (const file of ['../../components/dashboard/NextActions.jsx', '../../components/feeding/FeedingAlertSystem.jsx']) {
      const source = readFileSync(resolve(__dirname, file), 'utf8');
      expect(source).toMatch(/loadUnlessRetired\('OtherReptiles', \(\) => OtherReptile\.filter/);
    }
  });
});
