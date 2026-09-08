import { describe, it, expect, vi } from 'vitest';
import { safeExternalUrl, openExternalUrl } from '../safeExternalUrl';
import { imageStoragePath } from '../imageStoragePath';

describe('external navigation', () => {
  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.test', '/relative', 'http://vendor.test', 'https://user:password@vendor.test', 'java\nscript:alert(1)', null])('rejects unsafe destination %s', (url) => {
    expect(safeExternalUrl(url)).toBeNull();
  });
  it('opens valid HTTPS destinations with opener isolation only', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    try {
      openExternalUrl('javascript:alert(1)');
      expect(open).not.toHaveBeenCalled();
      openExternalUrl('https://vendor.test/product?id=3');
      expect(open).toHaveBeenCalledWith('https://vendor.test/product?id=3', '_blank', 'noopener,noreferrer');
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('image storage keys', () => {
  const owner = '12345678-1234-1234-1234-123456789abc';
  it('uses a random identifier and MIME-derived extension', () => {
    const key = imageStoragePath(owner, 'image/jpeg', 'geckos');
    expect(key).toMatch(new RegExp(`^geckos/${owner}/[a-f0-9-]{36}\\.jpg$`));
    expect(key).not.toBe(imageStoragePath(owner, 'image/jpeg', 'geckos'));
    expect(imageStoragePath(owner, 'image/webp')).toMatch(/\.webp$/);
  });
  it.each(['../other', 'a/b', '..', '%2f', '', null])('rejects path fragments in owner %s', (id) => {
    expect(() => imageStoragePath(id, 'image/png')).toThrow();
  });
  it.each(['../other', 'a/b', '..', '%2f', '', null])('rejects path fragments in folder %s', (folder) => {
    expect(() => imageStoragePath(owner, 'image/png', folder)).toThrow();
  });
  it.each(['image/svg+xml', 'text/html', '__proto__'])('rejects active or unknown content %s', (type) => {
    expect(() => imageStoragePath(owner, type)).toThrow();
  });
});
