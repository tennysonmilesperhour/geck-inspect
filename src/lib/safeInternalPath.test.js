import { describe, it, expect } from 'vitest';
import { safeInternalPath } from './safeInternalPath';

describe('safeInternalPath', () => {
  it('keeps ordinary in-app paths', () => {
    expect(safeInternalPath('/MyGeckos')).toBe('/MyGeckos');
    expect(safeInternalPath('/Messages?with=abc#latest')).toBe('/Messages?with=abc#latest');
  });

  it('rejects links that leave the site', () => {
    expect(safeInternalPath('//evil.example/login')).toBe('/');
    expect(safeInternalPath('/\\evil.example')).toBe('/');
    expect(safeInternalPath('https://evil.example')).toBe('/');
    expect(safeInternalPath('javascript:alert(1)')).toBe('/');
    expect(safeInternalPath('/ /evil')).toBe('/');
  });

  it('falls back for empty values', () => {
    expect(safeInternalPath(null)).toBe('/');
    expect(safeInternalPath('', '/Notifications')).toBe('/Notifications');
  });
});
