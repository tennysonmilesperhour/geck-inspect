import { describe, expect, it } from 'vitest';
import {
  readUpgradeReturn, rememberUpgradeReturn, takeUpgradeReturn, upgradeReturnPath,
} from '../upgradeReturn';

function memoryStore() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

describe('the page to return to after an upgrade', () => {
  it('keeps a path inside the app, with its query and hash', () => {
    expect(upgradeReturnPath('/MyGeckos?view=grid#rack-2')).toBe('/MyGeckos?view=grid#rack-2');
    expect(upgradeReturnPath('/Recognition')).toBe('/Recognition');
  });

  it('refuses other websites, odd links and the plans page itself', () => {
    for (const bad of [
      'https://evil.example/MyGeckos', '//evil.example/MyGeckos', '/\\evil.example', 'javascript:alert(1)',
      'MyGeckos', '', null, undefined, 42, '/Membership', '/membership?from_prompt=geckos', '/Membership/',
      `/${'a'.repeat(2100)}`,
    ]) {
      expect(upgradeReturnPath(bad)).toBeNull();
    }
  });

  it('remembers a page, hands it back once, then forgets it', () => {
    const store = memoryStore();
    expect(rememberUpgradeReturn('/Breeding?tab=eggs', 1000, store)).toBe(true);
    expect(readUpgradeReturn(2000, store)).toBe('/Breeding?tab=eggs');
    expect(takeUpgradeReturn(3000, store)).toBe('/Breeding?tab=eggs');
    expect(takeUpgradeReturn(4000, store)).toBeNull();
  });

  it('does not remember an off-site page, and keeps the earlier one', () => {
    const store = memoryStore();
    rememberUpgradeReturn('/MyGeckos', 1000, store);
    expect(rememberUpgradeReturn('https://evil.example', 2000, store)).toBe(false);
    expect(readUpgradeReturn(3000, store)).toBe('/MyGeckos');
  });

  it('ignores a stored value that was tampered with, and one over an hour old', () => {
    const store = memoryStore();
    store.setItem('geck_upgrade_return_path', JSON.stringify({ path: '//evil.example/x', at: 1000 }));
    expect(readUpgradeReturn(2000, store)).toBeNull();
    store.setItem('geck_upgrade_return_path', 'not json');
    expect(readUpgradeReturn(2000, store)).toBeNull();
    rememberUpgradeReturn('/MyGeckos', 1000, store);
    expect(readUpgradeReturn(1000 + 61 * 60 * 1000, store)).toBeNull();
  });
});
