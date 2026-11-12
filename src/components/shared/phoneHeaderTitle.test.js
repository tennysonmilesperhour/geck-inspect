// The phone header shows the open page's name where the menu button used
// to be, and the wordmark on Today (experience review B6 and decision 6).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, NAV_REGISTRY } from '@/lib/navItems';
import { phoneHeaderTitle } from '@/components/shared/phoneHeaderTitle';

describe('phoneHeaderTitle', () => {
  it('gives every menu page the name the menu uses', () => {
    for (const page of ['Dashboard', ...NAV_GROUPS.flatMap((g) => g.pages)]) {
      if (page === 'Today') continue;
      const label = NAV_REGISTRY.find((entry) => entry.page === page).sidebar.label;
      expect(phoneHeaderTitle(`/${page}`)).toBe(label);
    }
  });

  it('names Morph ID by its menu name, not its address', () => {
    expect(phoneHeaderTitle('/Recognition')).toBe('Morph ID');
  });

  it('uses the quick search name for a page that is not in the menu', () => {
    expect(phoneHeaderTitle('/Messages')).toBe('Messages');
    expect(phoneHeaderTitle('/Settings')).toBe('Settings');
    expect(phoneHeaderTitle('/FieldMode')).toBe('Field Mode');
  });

  it('reads only the first part of the address, in any letter case', () => {
    expect(phoneHeaderTitle('/GeckoDetail')).toBe('Gecko record');
    expect(phoneHeaderTitle('/calculator/learn')).toBe('Genetics Calculator');
    expect(phoneHeaderTitle('/mygeckos')).toBe(phoneHeaderTitle('/MyGeckos'));
  });

  it('returns null, for the wordmark, on Today, on the bare address and on a page with no name', () => {
    expect(phoneHeaderTitle('/Today')).toBeNull();
    expect(phoneHeaderTitle('/')).toBeNull();
    expect(phoneHeaderTitle('')).toBeNull();
    expect(phoneHeaderTitle('/SomethingNew')).toBeNull();
  });
});

// Layout.jsx is too large to render in a unit test, so the phone shell's
// promises are checked against its source, like phoneMenu.test.jsx does.
describe('the phone header and menu in Layout.jsx', () => {
  const layout = readFileSync(path.resolve(__dirname, '../../Layout.jsx'), 'utf8');
  const phoneHeader = layout.match(/<header ref=\{mobileHeaderRef\}[\s\S]*?<\/header>/)?.[0] || '';
  const laptopHeader = layout.match(/<header className="[^"]*hidden md:flex[\s\S]*?<\/header>/)?.[0] || '';
  const drawer = layout.match(/<Sidebar className=[\s\S]*?<\/Sidebar>/)?.[0] || '';

  it('the phone header has no menu button; it shows the title, search, Morph ID and the bell', () => {
    expect(phoneHeader).not.toBe('');
    expect(phoneHeader).not.toContain('toggleSidebar');
    expect(layout).not.toContain('Toggle Sidebar');
    expect(phoneHeader).toContain('{phoneTitle}');
    expect(phoneHeader).toContain('Geck Inspect');
    expect(phoneHeader).toContain('aria-label="Open quick search"');
    expect(phoneHeader).toMatch(/createPageUrl\("Recognition"\)[^>]*aria-label="Morph ID"/);
    expect(phoneHeader).toContain('<NotificationPopover');
  });

  it('Messages and Profile left the phone header only, and the phone bell carries the unread messages', () => {
    expect(phoneHeader).not.toContain('aria-label="Messages"');
    expect(phoneHeader).not.toContain('aria-label="Profile"');
    expect(phoneHeader).toContain('unreadMessages={unreadMessages}');
    expect(laptopHeader).toContain('aria-label="Messages"');
    expect(laptopHeader).toContain('aria-label="Profile"');
    expect(laptopHeader).not.toContain('unreadMessages={unreadMessages}');
  });

  it('a signed-out visitor and a guest both keep search and a way to an account', () => {
    expect(phoneHeader.match(/aria-label="Open quick search"/g)).toHaveLength(2);
    expect(phoneHeader).toContain('onClick={handleLogin}');
    expect(phoneHeader).toMatch(/isGuest && \(\s*<Link\s+to="\/AuthPortal\?mode=signup"/);
  });

  it('the phone menu is solid, says once that the demo saves nothing, and offers Send feedback', () => {
    expect(drawer).not.toBe('');
    const drawerClass = drawer.match(/<Sidebar className="([^"]*)"/)[1];
    expect(drawerClass).toContain('bg-slate-900');
    expect(drawerClass).not.toMatch(/bg-[a-z]+-\d+\/|backdrop-blur/);
    expect(drawer).toContain('Demo: look around, nothing is saved.');
    expect(drawer).toContain("new CustomEvent('open_feedback')");
    expect(drawer).toContain('Send feedback');
    // The "view only" pill stays off the phone menu.
    expect(layout).toMatch(/className="hidden md:inline [^"]*"\s+title="Guests can view this page but cannot save changes"/);
  });

  it('mounts no floating feedback button for phones and keeps the notices in one stack', () => {
    const widget = readFileSync(path.resolve(__dirname, '../feedback/FeedbackWidget.jsx'), 'utf8');
    expect(widget).toMatch(/data-feedback-trigger\s+className="hidden md:flex /);
    expect(layout).toMatch(/<FloatingNoticeStack>[\s\S]*<FeedingAlertSystem[\s\S]*<GuestDemoGuide \/>[\s\S]*<\/FloatingNoticeStack>/);
  });
});
