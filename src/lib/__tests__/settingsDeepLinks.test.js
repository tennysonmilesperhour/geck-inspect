// Pages that send a member to one control in Settings must name it, or the
// link opens the Account tab (Settings has had five tabs since 13 Nov 2026).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveSettingsTarget } from '@/components/settings/settingsTabs';

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const settings = read('pages/Settings.jsx');

describe('links into Settings from other pages', () => {
  it.each([
    ['pages/PublicProfile.jsx', 'blocked-users'],
    ['pages/Breeder.jsx', 'blocked-users'],
    ['pages/StorePage.jsx', 'blocked-users'],
    ['pages/CollectionInvite.jsx', 'collections'],
  ])('%s opens the tab that holds #%s', (file, anchor) => {
    const source = read(file);
    expect(source).toContain(`/Settings#${anchor}`);
    expect(source).not.toContain("createPageUrl('Settings')");
    expect(resolveSettingsTarget({ hash: `#${anchor}` })).toEqual({ tab: 'privacy', anchor, known: true });
    expect(settings).toContain(`<section id="${anchor}"`);
  });

  it('the quick search hint opens the Keeper mode switch', () => {
    expect(read('components/command-palette/CommandPalette.jsx')).toContain("go('/Settings#keeper-mode')");
    expect(resolveSettingsTarget({ hash: '#keeper-mode' })).toEqual({ tab: 'look', anchor: 'keeper-mode', known: true });
    expect(settings).toContain('<section id="keeper-mode"');
  });
});
